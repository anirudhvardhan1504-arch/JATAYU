/**
 * Comprehensive Backend Authentication & RBAC Test Suite for JATAYU.
 * Validates role-based capability matrices, asynchronous password hashing,
 * hardened JWT token signing & verification, SQLite persistent storage,
 * durable token revocation, Express auth routes, and dual-layer rate limiting.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import {
  JATAYU_ROLES,
  JATAYU_PERMISSIONS,
  DEFAULT_PUBLIC_ROLE,
  hasPermission,
  isValidRole,
  isValidPermission,
} from '../auth/roles.js';
import {
  hashPassword,
  verifyPassword,
  hashPasswordSync,
  verifyPasswordSync,
  normalizePassword,
  validateHashFormat,
  needsRehash,
} from '../auth/passwords.js';
import { createTokenService, SUPPORTED_ALGORITHM } from '../auth/tokens.js';
import { createPersistentUserStore } from '../auth/userStore.js';
import { createAuthRouter } from '../routes/auth.route.js';
import express from 'express';

const TEST_SECRET = 'a-super-secret-key-that-is-at-least-32-chars-long-for-testing';
const TEST_PROVISIONING_KEY = 'a-super-secret-provisioning-key-of-32-chars-min';

describe('1. RBAC Matrix & Privilege Escalation Defenses', () => {
  it('enforces deny-by-default capabilities across roles', () => {
    expect(hasPermission(JATAYU_ROLES.CITIZEN, JATAYU_PERMISSIONS.VIEW_PUBLIC_MAP)).toBe(true);
    expect(hasPermission(JATAYU_ROLES.CITIZEN, JATAYU_PERMISSIONS.VIEW_OPERATIONAL_SECTORS)).toBe(false);
    expect(hasPermission(JATAYU_ROLES.CITIZEN, JATAYU_PERMISSIONS.MANAGE_USERS_ROLES)).toBe(false);

    expect(hasPermission(JATAYU_ROLES.RESPONDER, JATAYU_PERMISSIONS.VIEW_OPERATIONAL_SECTORS)).toBe(true);
    expect(hasPermission(JATAYU_ROLES.RESPONDER, JATAYU_PERMISSIONS.VIEW_3D_COMMAND_GLOBE)).toBe(false);

    expect(hasPermission(JATAYU_ROLES.RESEARCHER, JATAYU_PERMISSIONS.VIEW_3D_COMMAND_GLOBE)).toBe(true);
    expect(hasPermission(JATAYU_ROLES.RESEARCHER, JATAYU_PERMISSIONS.TRIGGER_SIMULATION_DRILLS)).toBe(false);

    expect(hasPermission(JATAYU_ROLES.ADMIN, JATAYU_PERMISSIONS.MANAGE_USERS_ROLES)).toBe(true);
    expect(hasPermission(JATAYU_ROLES.ADMIN, JATAYU_PERMISSIONS.VIEW_3D_COMMAND_GLOBE)).toBe(true);

    expect(hasPermission('UNKNOWN_ROLE', JATAYU_PERMISSIONS.VIEW_PUBLIC_MAP)).toBe(false);
    expect(hasPermission(JATAYU_ROLES.ADMIN, 'unknown:permission')).toBe(false);
    expect(hasPermission(null, null)).toBe(false);
  });

  it('validates role and permission types correctly', () => {
    expect(isValidRole('CITIZEN')).toBe(true);
    expect(isValidRole('ADMIN')).toBe(true);
    expect(isValidRole('HACKER')).toBe(false);

    expect(isValidPermission('map:view_2d')).toBe(true);
    expect(isValidPermission('root:takeover')).toBe(false);
    expect(DEFAULT_PUBLIC_ROLE).toBe('CITIZEN');
  });
});

describe('2. Password Security & Unicode Normalization', () => {
  it('hashes and verifies passwords asynchronously with PBKDF2-HMAC-SHA512', async () => {
    const password = 'StrongPassword!#2026';
    const hash = await hashPassword(password);

    expect(hash.startsWith('100000$')).toBe(true);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('WrongPassword123!', hash)).toBe(false);
  });

  it('handles Unicode NFKC normalization equivalence', async () => {
    const composed = 'Caf\u00E91234!';
    const decomposed = 'Cafe\u03011234!';

    expect(composed).not.toBe(decomposed);
    expect(normalizePassword(composed)).toBe(normalizePassword(decomposed));

    const hashFromComposed = await hashPassword(composed);
    expect(await verifyPassword(decomposed, hashFromComposed)).toBe(true);
  });

  it('fails safely on malformed hashes without throwing exceptions', async () => {
    expect(await verifyPassword('Password123!', 'invalid-hash')).toBe(false);
    expect(await verifyPassword('Password123!', '100000$shortsalt$shorthash')).toBe(false);
    expect(await verifyPassword('Password123!', '')).toBe(false);
  });

  it('detects outdated hash parameters requiring rehash', () => {
    const currentHash = `100000$${'a'.repeat(32)}$${'b'.repeat(128)}`;
    const oldHash = `50000$${'a'.repeat(32)}$${'b'.repeat(128)}`;

    expect(needsRehash(currentHash, 100000)).toBe(false);
    expect(needsRehash(oldHash, 100000)).toBe(true);
  });

  it('supports synchronous variants for utility use', () => {
    const pass = 'SyncPassword#123';
    const hash = hashPasswordSync(pass);
    expect(verifyPasswordSync(pass, hash)).toBe(true);
    expect(verifyPasswordSync('WrongPass', hash)).toBe(false);
  });
});

describe('3. Token Security & Algorithm Pinning', () => {
  const tokenService = createTokenService({
    secret: TEST_SECRET,
    defaultTtlSeconds: 900,
    clockSkewSeconds: 60,
  });

  it('signs and verifies valid HMAC-SHA256 tokens', () => {
    const token = tokenService.sign({ sub: 'usr-100', role: JATAYU_ROLES.CITIZEN, username: 'alice' });
    const verified = tokenService.verify(token);

    expect(verified.sub).toBe('usr-100');
    expect(verified.role).toBe('CITIZEN');
    expect(verified.username).toBe('alice');
    expect(typeof verified.exp).toBe('number');
  });

  it('rejects tokens specifying alg: "none"', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'usr-100', role: 'CITIZEN', exp: Math.floor(Date.now() / 1000) + 60, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
    const token = `${header}.${payload}.`;

    expect(() => tokenService.verify(token)).toThrow(/Invalid token algorithm: 'none'/);
  });

  it('rejects tokens specifying unsupported algorithms (RS256)', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'usr-100', role: 'CITIZEN', exp: Math.floor(Date.now() / 1000) + 60, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
    const fakeSig = Buffer.from('fakesig').toString('base64url');
    const token = `${header}.${payload}.${fakeSig}`;

    expect(() => tokenService.verify(token)).toThrow(/Invalid token algorithm: 'RS256'/);
  });

  it('rejects tampered signatures and modified payloads', () => {
    const validToken = tokenService.sign({ sub: 'usr-100', role: JATAYU_ROLES.CITIZEN });
    const parts = validToken.split('.');

    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'usr-100', role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 900, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
    const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    expect(() => tokenService.verify(forgedToken)).toThrow(/Invalid token signature/);
  });

  it('rejects expired tokens outside clock-skew tolerance', () => {
    const pastEpoch = Math.floor(Date.now() / 1000) - 100;
    const token = tokenService.sign({ sub: 'usr-100', role: JATAYU_ROLES.CITIZEN }, -10);

    expect(() => tokenService.verify(token, pastEpoch + 200)).toThrow(/Token has expired/);
  });

  it('rejects future-issued tokens outside clock-skew tolerance', () => {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'usr-100',
      role: 'CITIZEN',
      iat: now + 120, // 120s in future > 60s skew
      exp: now + 1000,
    })).toString('base64url');

    const sig = createHmac('sha256', TEST_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    const futureToken = `${header}.${payload}.${sig}`;

    expect(() => tokenService.verify(futureToken, now)).toThrow(/Token issued in future/);
  });

  it('enforces secret minimum length of 32 characters', () => {
    expect(() => createTokenService({ secret: 'short-secret' })).toThrow(/signing secret must be at least 32 characters/);
  });
});

describe('4. Persistent SQLite Store & Durable Revocation', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_vitest_auth.db');

  beforeAll(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  afterAll(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('public registration strictly assigns CITIZEN and rejects privileged roles', async () => {
    const store = createPersistentUserStore();
    try {
      await expect(
        store.registerUser({
          username: 'bad_actor',
          password: 'Password123!',
          role: 'ADMIN',
        })
      ).rejects.toThrow(/Privilege escalation rejected/);

      await expect(
        store.registerUser({
          username: 'bad_actor2',
          password: 'Password123!',
          role: 'GOVERNMENT',
        })
      ).rejects.toThrow(/Privilege escalation rejected/);

      const citizen = await store.registerUser({
        username: 'good_citizen',
        password: 'Password123!',
      });
      expect(citizen.role).toBe(DEFAULT_PUBLIC_ROLE);
      expect(citizen.role).toBe('CITIZEN');
    } finally {
      store.close();
    }
  });

  it('enforces unique username constraints in database', async () => {
    const store = createPersistentUserStore();
    try {
      await store.registerUser({ username: 'unique_user', password: 'Password123!' });
      await expect(
        store.registerUser({ username: 'unique_user', password: 'Password123!' })
      ).rejects.toThrow(/already taken/);
    } finally {
      store.close();
    }
  });

  it('administrative role assignment requires ADMIN authorization and increments session version', async () => {
    const store = createPersistentUserStore();
    try {
      const user = await store.registerUser({ username: 'operator', password: 'Password123!' });

      expect(() =>
        store.assignUserRole({
          targetUserId: user.id,
          newRole: JATAYU_ROLES.RESPONDER,
          authorizedByRole: 'CITIZEN',
        })
      ).toThrow(/Unauthorized/);

      const updated = store.assignUserRole({
        targetUserId: user.id,
        newRole: JATAYU_ROLES.RESPONDER,
        authorizedByRole: 'ADMIN',
      });

      expect(updated.role).toBe('RESPONDER');
      expect(updated.roleVersion).toBe(2);
    } finally {
      store.close();
    }
  });

  it('persists user credentials and role across database store reinitialization', async () => {
    // Session 1: write to file DB
    const store1 = createPersistentUserStore({ dbPath: testDbPath });
    const user = await store1.registerUser({
      username: 'persistent_hero',
      password: 'SafeP@ssword2026',
      displayName: 'Captain India',
    });
    store1.assignUserRole({
      targetUserId: user.id,
      newRole: JATAYU_ROLES.RESEARCHER,
      authorizedByRole: 'ADMIN',
    });
    store1.close();

    // Session 2: re-open file DB
    const store2 = createPersistentUserStore({ dbPath: testDbPath });
    try {
      const authenticated = await store2.authenticateUser('persistent_hero', 'SafeP@ssword2026');
      expect(authenticated).not.toBeNull();
      expect(authenticated?.username).toBe('persistent_hero');
      expect(authenticated?.role).toBe('RESEARCHER');
    } finally {
      store2.close();
    }
  });

  it('persists revoked tokens across database store reinitialization', () => {
    const sampleToken = 'header.payload.signature-vitest-revocation';
    const exp = Math.floor(Date.now() / 1000) + 3600;

    const store1 = createPersistentUserStore({ dbPath: testDbPath });
    store1.revokeToken(sampleToken, exp, 'User logout');
    expect(store1.isTokenRevoked(sampleToken)).toBe(true);
    store1.close();

    const store2 = createPersistentUserStore({ dbPath: testDbPath });
    try {
      expect(store2.isTokenRevoked(sampleToken)).toBe(true);
      expect(store2.isTokenRevoked('unrevoked.token.here')).toBe(false);
    } finally {
      store2.close();
    }
  });

  it('deactivating user immediately denies authentication and invalidates session', async () => {
    const store = createPersistentUserStore();
    try {
      const user = await store.registerUser({ username: 'discharged', password: 'Password123!' });
      expect(await store.authenticateUser('discharged', 'Password123!')).not.toBeNull();

      store.setUserDisabled(user.id, true, 'ADMIN');

      await expect(
        store.authenticateUser('discharged', 'Password123!')
      ).rejects.toThrow(/Account has been deactivated/);

      expect(store.validateUserSession(user.id)).toBeNull();
    } finally {
      store.close();
    }
  });
});

describe('5. Express Authentication API Routes (/api/auth)', () => {
  let app: express.Express;
  let userStore: ReturnType<typeof createPersistentUserStore>;
  let tokenService: ReturnType<typeof createTokenService>;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    userStore = createPersistentUserStore();
    tokenService = createTokenService({
      secret: TEST_SECRET,
      revocationChecker: (token) => userStore.isTokenRevoked(token),
    });

    const router = createAuthRouter({
      userStore,
      tokenService,
      trustProxy: false,
    });

    app.use('/api/auth', router);

    // Bootstrap test admin
    await userStore.provisionInitialAdmin({
      username: 'super_admin',
      password: 'AdminPassword123!',
      provisioningSecret: TEST_PROVISIONING_KEY,
      expectedSecret: TEST_PROVISIONING_KEY,
    });
  });

  afterAll(() => {
    userStore.close();
  });

  it('POST /api/auth/register rejects privilege escalation attempts with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'wannabe_admin', password: 'Password123!', role: 'ADMIN' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REGISTRATION_FAILED');
  });

  it('POST /api/auth/register creates citizen account with 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'citizen_doe', password: 'Password123!', displayName: 'John Doe' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('CITIZEN');
    expect(res.body.user.username).toBe('citizen_doe');
  });

  it('POST /api/auth/login verifies credentials and returns 200 with JWT', async () => {
    const badRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'citizen_doe', password: 'WrongPassword!' });
    expect(badRes.status).toBe(401);

    const goodRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'citizen_doe', password: 'Password123!' });

    expect(goodRes.status).toBe(200);
    expect(goodRes.body.token).toBeDefined();
    expect(goodRes.body.user.role).toBe('CITIZEN');
  });

  it('GET /api/auth/me returns current user profile when authenticated', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'citizen_doe', password: 'Password123!' });

    const token = loginRes.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.username).toBe('citizen_doe');
    expect(meRes.body.user.permissions).toContain('map:view_2d');
  });

  it('GET /api/auth/me returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  it('POST /api/auth/logout revokes session, blocking subsequent requests', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'citizen_doe', password: 'Password123!' });
    const token = loginRes.body.token;

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.code).toBe('SESSION_REVOKED');

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(401);
    expect(meRes.body.code).toBe('TOKEN_REVOKED');
  });

  it('POST /api/auth/admin/assign-role allows admin to promote users', async () => {
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'super_admin', password: 'AdminPassword123!' });
    const adminToken = adminLogin.body.token;

    const targetUser = userStore.getUserByUsername('citizen_doe');
    expect(targetUser).toBeDefined();

    const promoteRes = await request(app)
      .post('/api/auth/admin/assign-role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetUserId: targetUser!.id,
        newRole: 'RESPONDER',
      });

    expect(promoteRes.status).toBe(200);
    expect(promoteRes.body.user.role).toBe('RESPONDER');
  });

  it('locks out after 5 consecutive failed logins returning 429', async () => {
    const testIp = '198.51.100.77';

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'super_admin', password: 'BadPassword!' })
        .set('X-Forwarded-For', testIp); // Ignored when trustProxy=false
      expect(res.status).toBe(401);
    }

    // Next attempt triggers 429
    const lockedRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'super_admin', password: 'AdminPassword123!' });

    expect(lockedRes.status).toBe(429);
    expect(lockedRes.body.code).toBe('RATE_LIMITED');
  });
});
