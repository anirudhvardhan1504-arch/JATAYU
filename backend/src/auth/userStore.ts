/**
 * Persistent SQLite User & Session Store for the JATAYU Auth Service.
 * Implements persistent identity, atomic transactions, durable token revocation,
 * dual-layer brute-force throttling, and server-enforced role assignments.
 */

// @ts-ignore - node:sqlite is natively available in Node.js 24 runtime
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { hashPassword, verifyPassword } from './passwords.js';
import {
  JATAYU_ROLES,
  DEFAULT_PUBLIC_ROLE,
  assertValidRole,
  JatayuRole,
} from './roles.js';

// Pre-computed dummy hash to prevent user enumeration via timing discrepancies
const DUMMY_HASH = `100000$00000000000000000000000000000000$${'0'.repeat(128)}`;

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15-minute temporary lockout
export const ATTEMPT_WINDOW_MS = 30 * 60 * 1000; // 30-minute attempt window

export interface UserRecord {
  id: string;
  username: string;
  password_hash: string;
  role: JatayuRole;
  display_name: string;
  is_disabled: number;
  role_version: number;
  created_at: string;
  updated_at: string;
}

export interface SanitizedUser {
  id: string;
  username: string;
  role: JatayuRole;
  displayName: string;
  roleVersion: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginAttemptRecord {
  key: string;
  failed_count: number;
  locked_until: number;
  last_attempt_at: number;
}

/**
 * Hash a JWT string to SHA-256 hex digest for bounded storage in the revocation table.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface PersistentUserStoreOptions {
  dbPath?: string;
}

export interface UserStore {
  db: any;
  close(): void;
  registerUser(params: {
    username: string;
    password: string;
    displayName?: string;
    role?: string;
  }): Promise<SanitizedUser>;
  authenticateUser(
    username: string,
    password: string,
    clientIp?: string
  ): Promise<SanitizedUser | null>;
  assignUserRole(params: {
    targetUserId: string;
    newRole: string;
    authorizedByRole: string;
  }): SanitizedUser;
  provisionInitialAdmin(params: {
    username: string;
    password: string;
    displayName?: string;
    provisioningSecret: string;
    expectedSecret?: string;
  }): Promise<SanitizedUser>;
  setUserDisabled(targetUserId: string, disabled: boolean, authorizedByRole: string): void;
  revokeToken(token: string, expiresAtEpochSeconds?: number, reason?: string): void;
  isTokenRevoked(token: string, nowEpochSeconds?: number): boolean;
  validateUserSession(userId: string, tokenRoleVersion?: number | null): SanitizedUser | null;
  getUserById(id: string): UserRecord | undefined;
  getUserByUsername(username: string): UserRecord | undefined;
  performCleanup(now?: number): void;
}

export function createPersistentUserStore({
  dbPath = ':memory:',
}: PersistentUserStoreOptions = {}): UserStore {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);

  // Initialize SQLite schema with write-ahead logging and strict constraints
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_disabled INTEGER NOT NULL DEFAULT 0,
      role_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revoked_tokens (
      token_hash TEXT PRIMARY KEY,
      revoked_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      reason TEXT
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      key TEXT PRIMARY KEY,
      failed_count INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0,
      last_attempt_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_revoked_expires ON revoked_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_attempts_locked ON login_attempts(locked_until);
  `);

  // Prepared SQL Statements
  const stmts = {
    insertUser: db.prepare(`
      INSERT INTO users (id, username, password_hash, role, display_name, is_disabled, role_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)
    `),
    getUserByUsername: db.prepare(`
      SELECT id, username, password_hash, role, display_name, is_disabled, role_version, created_at, updated_at
      FROM users WHERE username = ?
    `),
    getUserById: db.prepare(`
      SELECT id, username, password_hash, role, display_name, is_disabled, role_version, created_at, updated_at
      FROM users WHERE id = ?
    `),
    updateUserRole: db.prepare(`
      UPDATE users
      SET role = ?, role_version = role_version + 1, updated_at = ?
      WHERE id = ?
    `),
    setUserDisabled: db.prepare(`
      UPDATE users
      SET is_disabled = ?, role_version = role_version + 1, updated_at = ?
      WHERE id = ?
    `),
    insertRevokedToken: db.prepare(`
      INSERT OR REPLACE INTO revoked_tokens (token_hash, revoked_at, expires_at, reason)
      VALUES (?, ?, ?, ?)
    `),
    isTokenRevoked: db.prepare(`
      SELECT token_hash FROM revoked_tokens
      WHERE token_hash = ? AND expires_at > ?
    `),
    cleanupRevoked: db.prepare(`
      DELETE FROM revoked_tokens WHERE expires_at <= ?
    `),
    getLoginAttempt: db.prepare(`
      SELECT key, failed_count, locked_until, last_attempt_at
      FROM login_attempts WHERE key = ?
    `),
    upsertLoginAttempt: db.prepare(`
      INSERT INTO login_attempts (key, failed_count, locked_until, last_attempt_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        failed_count = excluded.failed_count,
        locked_until = excluded.locked_until,
        last_attempt_at = excluded.last_attempt_at
    `),
    deleteLoginAttempt: db.prepare(`
      DELETE FROM login_attempts WHERE key = ?
    `),
    cleanupLoginAttempts: db.prepare(`
      DELETE FROM login_attempts
      WHERE locked_until <= ? AND last_attempt_at <= ?
    `),
  };

  function checkThrottle(key: string, now = Date.now()): void {
    const record = stmts.getLoginAttempt.get(key) as LoginAttemptRecord | undefined;
    if (record && record.locked_until > now) {
      const waitSeconds = Math.ceil((record.locked_until - now) / 1000);
      throw new Error(`Too many failed attempts for ${key.startsWith('ip:') ? 'this IP' : 'this account'}. Locked out for ${waitSeconds} seconds.`);
    }
  }

  function recordFailure(key: string, now = Date.now()): void {
    const record = stmts.getLoginAttempt.get(key) as LoginAttemptRecord | undefined;
    let count = 1;
    let lockedUntil = 0;

    if (record) {
      if (now - record.last_attempt_at > ATTEMPT_WINDOW_MS) {
        count = 1;
      } else {
        count = record.failed_count + 1;
      }
    }

    if (count >= MAX_LOGIN_ATTEMPTS) {
      lockedUntil = now + LOCKOUT_DURATION_MS;
    }

    stmts.upsertLoginAttempt.run(key, count, lockedUntil, now);
  }

  function clearThrottle(key: string): void {
    stmts.deleteLoginAttempt.run(key);
  }

  return {
    db,

    close(): void {
      db.close();
    },

    async registerUser({ username, password, displayName, role }): Promise<SanitizedUser> {
      if (!username || typeof username !== 'string') {
        throw new Error('Username is required and must be a string');
      }

      if (!password || typeof password !== 'string') {
        throw new Error('Password is required and must be a string');
      }

      // Privilege Escalation Defense:
      // If the caller attempts to specify any role other than CITIZEN, strictly reject it.
      if (role && role !== DEFAULT_PUBLIC_ROLE) {
        throw new Error(`Privilege escalation rejected: Direct registration with role '${role}' is prohibited. Public registration is restricted to '${DEFAULT_PUBLIC_ROLE}'.`);
      }

      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername.length < 3 || cleanUsername.length > 50) {
        throw new Error('Username must be between 3 and 50 characters');
      }

      // Check unique username
      const existing = stmts.getUserByUsername.get(cleanUsername) as UserRecord | undefined;
      if (existing) {
        throw new Error(`Username '${cleanUsername}' is already taken`);
      }

      const passwordHash = await hashPassword(password);
      const userId = `usr_${Date.now()}_${randomBytes(4).toString('hex')}`;
      const nowIso = new Date().toISOString();
      const finalDisplayName = displayName?.trim() || cleanUsername;

      stmts.insertUser.run(
        userId,
        cleanUsername,
        passwordHash,
        DEFAULT_PUBLIC_ROLE,
        finalDisplayName,
        nowIso,
        nowIso
      );

      return {
        id: userId,
        username: cleanUsername,
        role: DEFAULT_PUBLIC_ROLE,
        displayName: finalDisplayName,
        roleVersion: 1,
        createdAt: nowIso,
      };
    },

    async authenticateUser(username: string, password: string, clientIp = '127.0.0.1'): Promise<SanitizedUser | null> {
      const now = Date.now();
      const cleanUsername = String(username || '').trim().toLowerCase();
      const ipKey = `ip:${clientIp}`;
      const userKey = `user:${cleanUsername}`;

      // 1. Check IP-level and account-level throttling before proceeding
      checkThrottle(ipKey, now);
      if (cleanUsername) {
        checkThrottle(userKey, now);
      }

      const user = cleanUsername ? (stmts.getUserByUsername.get(cleanUsername) as UserRecord | undefined) : undefined;

      // Timing-attack mitigation: always perform password verification even if user does not exist
      const hashToVerify = user ? user.password_hash : DUMMY_HASH;
      const isValidPassword = await verifyPassword(password, hashToVerify);

      if (!user || !isValidPassword) {
        recordFailure(ipKey, now);
        if (cleanUsername) {
          recordFailure(userKey, now);
        }
        return null;
      }

      // Fail-closed if account has been disabled
      if (user.is_disabled === 1) {
        throw new Error('Account has been deactivated. Please contact an administrator.');
      }

      // Success: clear failed attempt counters for both keys
      clearThrottle(ipKey);
      clearThrottle(userKey);

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.display_name,
        roleVersion: user.role_version,
      };
    },

    assignUserRole({ targetUserId, newRole, authorizedByRole }): SanitizedUser {
      if (authorizedByRole !== JATAYU_ROLES.ADMIN) {
        throw new Error(`Unauthorized: Role assignment requires '${JATAYU_ROLES.ADMIN}' role. Provided: '${authorizedByRole}'`);
      }

      assertValidRole(newRole);

      const user = stmts.getUserById.get(targetUserId) as UserRecord | undefined;
      if (!user) {
        throw new Error(`User with ID '${targetUserId}' not found`);
      }

      const nowIso = new Date().toISOString();
      stmts.updateUserRole.run(newRole, nowIso, targetUserId);

      const updated = stmts.getUserById.get(targetUserId) as unknown as UserRecord;
      return {
        id: updated.id,
        username: updated.username,
        role: updated.role,
        displayName: updated.display_name,
        roleVersion: updated.role_version,
        updatedAt: updated.updated_at,
      };
    },

    async provisionInitialAdmin({
      username,
      password,
      displayName = 'System Administrator',
      provisioningSecret,
      expectedSecret = process.env.PROVISIONING_KEY,
    }): Promise<SanitizedUser> {
      if (!expectedSecret || typeof expectedSecret !== 'string' || expectedSecret.length < 32) {
        throw new Error('Administrative provisioning error: valid PROVISIONING_KEY of at least 32 characters is required');
      }

      if (provisioningSecret !== expectedSecret) {
        throw new Error('Administrative provisioning error: invalid provisioning secret key');
      }

      const cleanUsername = username.trim().toLowerCase();
      const existing = stmts.getUserByUsername.get(cleanUsername) as UserRecord | undefined;
      if (existing) {
        throw new Error(`Administrative user '${cleanUsername}' already exists`);
      }

      const passwordHash = await hashPassword(password);
      const userId = `admin_${Date.now()}_${randomBytes(4).toString('hex')}`;
      const nowIso = new Date().toISOString();

      stmts.insertUser.run(
        userId,
        cleanUsername,
        passwordHash,
        JATAYU_ROLES.ADMIN,
        displayName,
        nowIso,
        nowIso
      );

      return {
        id: userId,
        username: cleanUsername,
        role: JATAYU_ROLES.ADMIN,
        displayName,
        roleVersion: 1,
        createdAt: nowIso,
      };
    },

    setUserDisabled(targetUserId: string, disabled: boolean, authorizedByRole: string): void {
      if (authorizedByRole !== JATAYU_ROLES.ADMIN) {
        throw new Error(`Unauthorized: Account management requires '${JATAYU_ROLES.ADMIN}' role`);
      }

      const user = stmts.getUserById.get(targetUserId) as UserRecord | undefined;
      if (!user) {
        throw new Error(`User with ID '${targetUserId}' not found`);
      }

      const nowIso = new Date().toISOString();
      stmts.setUserDisabled.run(disabled ? 1 : 0, nowIso, targetUserId);
    },

    revokeToken(token: string, expiresAtEpochSeconds?: number, reason = 'User logout'): void {
      if (!token || typeof token !== 'string') return;
      const tHash = hashToken(token);
      const nowSec = Math.floor(Date.now() / 1000);
      const expSec = expiresAtEpochSeconds || nowSec + 3600;

      stmts.insertRevokedToken.run(tHash, nowSec, expSec, reason);
    },

    isTokenRevoked(token: string, nowEpochSeconds = Math.floor(Date.now() / 1000)): boolean {
      if (!token || typeof token !== 'string') return true;
      const tHash = hashToken(token);
      const record = stmts.isTokenRevoked.get(tHash, nowEpochSeconds);
      return Boolean(record);
    },

    validateUserSession(userId: string, tokenRoleVersion: number | null = null): SanitizedUser | null {
      if (!userId) return null;
      const user = stmts.getUserById.get(userId) as UserRecord | undefined;
      if (!user || user.is_disabled === 1) {
        return null;
      }
      if (tokenRoleVersion !== null && user.role_version !== tokenRoleVersion) {
        return null; // Session invalidated due to role change or privilege revocation
      }
      return {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.display_name,
        roleVersion: user.role_version,
      };
    },

    getUserById(id: string): UserRecord | undefined {
      return stmts.getUserById.get(id) as UserRecord | undefined;
    },

    getUserByUsername(username: string): UserRecord | undefined {
      return stmts.getUserByUsername.get(String(username).trim().toLowerCase()) as UserRecord | undefined;
    },

    performCleanup(now = Date.now()): void {
      const nowSec = Math.floor(now / 1000);
      stmts.cleanupRevoked.run(nowSec);
      stmts.cleanupLoginAttempts.run(now, now - ATTEMPT_WINDOW_MS);
    },
  };
}
