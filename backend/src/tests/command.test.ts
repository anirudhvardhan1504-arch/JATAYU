/**
 * Comprehensive Operational Command APIs & Server-Enforced RBAC Test Suite for JATAYU.
 * Verifies:
 * 1. Public API Backward Compatibility (citizen endpoints remain open and functional)
 * 2. Unauthenticated Request Rejection (all command endpoints deny anonymous access)
 * 3. Server-Enforced RBAC across CITIZEN, RESPONDER, RESEARCHER, GOVERNMENT, and ADMIN
 * 4. Header Injection & Role Forgery Defenses
 * 5. Input Validation & Coordinate Boundary Enforcement
 * 6. Data Integrity, Provenance & Synthetic Drill Separation
 * 7. Token Lifecycle, Revocation, Account Deactivation & Role Version Invalidation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { app as productionApp } from '../app.js';
import { JATAYU_ROLES, JATAYU_PERMISSIONS } from '../auth/roles.js';
import { createTokenService } from '../auth/tokens.js';
import { createPersistentUserStore } from '../auth/userStore.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { createAuthRouter } from '../routes/auth.route.js';
import { createCommandRouter, OPERATIONAL_SECTORS } from '../routes/command.route.js';
import { DistrictBoundaryService } from '../services/district.service.js';

const TEST_SECRET = 'a-super-secret-command-test-jwt-key-32chars!';
const TEST_ADMIN_PROVISIONING_KEY = 'admin-provisioning-secret-32chars-test!';

describe('JATAYU Operational Command APIs & Server-Enforced RBAC', () => {
  let app: express.Express;
  let userStore: ReturnType<typeof createPersistentUserStore>;
  let tokenService: ReturnType<typeof createTokenService>;
  let districtService: DistrictBoundaryService;

  // Tokens for each role
  let citizenToken: string;
  let responderToken: string;
  let researcherToken: string;
  let governmentToken: string;
  let adminToken: string;
  let deactivatableToken: string;
  let deactivatableUserId: string;

  beforeAll(async () => {
    userStore = createPersistentUserStore();
    tokenService = createTokenService({
      secret: TEST_SECRET,
      defaultTtlSeconds: 3600,
      revocationChecker: (token) => userStore.isTokenRevoked(token),
    });

    const authMiddleware = createAuthMiddleware({
      tokenService,
      userStore,
      trustProxy: false,
    });

    districtService = new DistrictBoundaryService();

    app = express();
    app.use(express.json({ limit: '100kb' }));

    const authRouter = createAuthRouter({
      userStore,
      tokenService,
      authMiddleware,
      trustProxy: false,
    });

    const commandRouter = createCommandRouter({
      userStore,
      tokenService,
      authMiddleware,
      districtService,
      trustProxy: false,
    });

    app.use('/api/auth', authRouter);
    app.use('/api/command', commandRouter);

    // Bootstrap Admin
    await userStore.provisionInitialAdmin({
      username: 'command_admin',
      password: 'AdminPassword123!',
      provisioningSecret: TEST_ADMIN_PROVISIONING_KEY,
      expectedSecret: TEST_ADMIN_PROVISIONING_KEY,
    });
    const adminUser = await userStore.authenticateUser('command_admin', 'AdminPassword123!');
    adminToken = tokenService.sign({
      sub: adminUser!.id,
      role: adminUser!.role,
      name: adminUser!.displayName,
      rv: adminUser!.roleVersion,
    });

    // Register Citizen
    const citizenUser = await userStore.registerUser({
      username: 'citizen_john',
      password: 'CitizenPassword123!',
      displayName: 'John Citizen',
    });
    citizenToken = tokenService.sign({
      sub: citizenUser.id,
      role: citizenUser.role,
      name: citizenUser.displayName,
      rv: citizenUser.roleVersion,
    });

    // Register & promote Responder
    const respUser = await userStore.registerUser({
      username: 'responder_raj',
      password: 'ResponderPass123!',
      displayName: 'Raj Responder',
    });
    const promotedResp = userStore.assignUserRole({
      targetUserId: respUser.id,
      newRole: JATAYU_ROLES.RESPONDER,
      authorizedByRole: JATAYU_ROLES.ADMIN,
    });
    responderToken = tokenService.sign({
      sub: promotedResp.id,
      role: promotedResp.role,
      name: promotedResp.displayName,
      rv: promotedResp.roleVersion,
    });

    // Register & promote Researcher
    const resUser = await userStore.registerUser({
      username: 'researcher_meera',
      password: 'ResearcherPass123!',
      displayName: 'Dr. Meera',
    });
    const promotedRes = userStore.assignUserRole({
      targetUserId: resUser.id,
      newRole: JATAYU_ROLES.RESEARCHER,
      authorizedByRole: JATAYU_ROLES.ADMIN,
    });
    researcherToken = tokenService.sign({
      sub: promotedRes.id,
      role: promotedRes.role,
      name: promotedRes.displayName,
      rv: promotedRes.roleVersion,
    });

    // Register & promote Government
    const govUser = await userStore.registerUser({
      username: 'gov_official',
      password: 'GovPassword123!',
      displayName: 'Director Sharma',
    });
    const promotedGov = userStore.assignUserRole({
      targetUserId: govUser.id,
      newRole: JATAYU_ROLES.GOVERNMENT,
      authorizedByRole: JATAYU_ROLES.ADMIN,
    });
    governmentToken = tokenService.sign({
      sub: promotedGov.id,
      role: promotedGov.role,
      name: promotedGov.displayName,
      rv: promotedGov.roleVersion,
    });

    // User for deactivation / role version invalidation test
    const deactUser = await userStore.registerUser({
      username: 'temp_officer',
      password: 'TempPassword123!',
      displayName: 'Temporary Officer',
    });
    const promotedDeact = userStore.assignUserRole({
      targetUserId: deactUser.id,
      newRole: JATAYU_ROLES.RESPONDER,
      authorizedByRole: JATAYU_ROLES.ADMIN,
    });
    deactivatableUserId = promotedDeact.id;
    deactivatableToken = tokenService.sign({
      sub: promotedDeact.id,
      role: promotedDeact.role,
      name: promotedDeact.displayName,
      rv: promotedDeact.roleVersion,
    });
  }, 30000);

  afterAll(() => {
    userStore.close();
  });

  describe('1. Public API Backward Compatibility (No Auth Required)', () => {
    it('GET /api/health responds with 200 without authentication', async () => {
      const res = await request(productionApp).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /api/weather/current responds with 200 without authentication', async () => {
      const res = await request(productionApp).get('/api/weather/current?lat=19.076&lon=72.8777');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('temperatureC');
      expect(res.body.sourceType).toBe('OBSERVED');
    }, 20000);

    it('GET /api/weather/forecast responds with 200 without authentication', async () => {
      const res = await request(productionApp).get('/api/weather/forecast?lat=19.076&lon=72.8777');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('hourly');
      expect(res.body.dataSource.type).toBe('OFFICIAL_FORECAST');
    }, 20000);

    it('GET /api/alerts responds with 200 without authentication', async () => {
      const res = await request(productionApp).get('/api/alerts?lat=19.076&lon=72.8777');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('officialAlerts');
      expect(res.body).toHaveProperty('geographicResolution');
    }, 20000);

    it('GET /api/risk/assessment responds with 200 without authentication', async () => {
      const res = await request(productionApp).get('/api/risk/assessment?lat=19.076&lon=72.8777');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('overallRiskLevel');
      expect(res.body).toHaveProperty('riskScore');
    }, 20000);

    it('GET /api/ai/status responds with 200 without authentication', async () => {
      const res = await request(productionApp).get('/api/ai/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('configured');
    });
  });

  describe('2. Unauthenticated Access Protection (Deny Anonymous Calls)', () => {
    it('denies anonymous GET /api/command/sectors with 401 AUTH_REQUIRED', async () => {
      const res = await request(app).get('/api/command/sectors');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_REQUIRED');
    });

    it('denies anonymous GET /api/command/district-telemetry with 401 AUTH_REQUIRED', async () => {
      const res = await request(app).get('/api/command/district-telemetry?lat=19.076&lon=72.8777');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_REQUIRED');
    });

    it('denies anonymous GET /api/command/globe-context with 401 AUTH_REQUIRED', async () => {
      const res = await request(app).get('/api/command/globe-context');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_REQUIRED');
    });

    it('denies anonymous POST /api/command/drills/trigger with 401 AUTH_REQUIRED', async () => {
      const res = await request(app)
        .post('/api/command/drills/trigger')
        .send({ scenarioType: 'CYCLONE', sectorName: 'Mumbai', severity: 'SEVERE' });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('3. Citizen Role Restrictions (Deny Elevated Command Access)', () => {
    it('denies Citizen GET /api/command/sectors with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/command/sectors')
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.requiredPermission).toBe(JATAYU_PERMISSIONS.VIEW_OPERATIONAL_SECTORS);
    });

    it('denies Citizen GET /api/command/district-telemetry with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/command/district-telemetry?lat=19.076&lon=72.8777')
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.requiredPermission).toBe(JATAYU_PERMISSIONS.INTERROGATE_DISTRICT_TELEMETRY);
    });

    it('denies Citizen GET /api/command/globe-context with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/command/globe-context')
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.requiredPermission).toBe(JATAYU_PERMISSIONS.VIEW_3D_COMMAND_GLOBE);
    });

    it('denies Citizen POST /api/command/drills/trigger with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/command/drills/trigger')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ scenarioType: 'FLOOD', sectorName: 'Chennai', severity: 'MODERATE' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.requiredPermission).toBe(JATAYU_PERMISSIONS.TRIGGER_SIMULATION_DRILLS);
    });
  });

  describe('4. Responder Role Permissions (Tactical Ground Ops)', () => {
    it('allows Responder GET /api/command/sectors (200 OK)', async () => {
      const res = await request(app)
        .get('/api/command/sectors')
        .set('Authorization', `Bearer ${responderToken}`);
      expect(res.status).toBe(200);
      expect(res.body.sectors).toHaveLength(OPERATIONAL_SECTORS.length);
      expect(res.body.requestedBy.role).toBe(JATAYU_ROLES.RESPONDER);
    });

    it('allows Responder GET /api/command/district-telemetry (200 OK)', async () => {
      const res = await request(app)
        .get('/api/command/district-telemetry?lat=19.076&lon=72.8777')
        .set('Authorization', `Bearer ${responderToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('district');
      expect(res.body.operator.role).toBe(JATAYU_ROLES.RESPONDER);
    });

    it('denies Responder GET /api/command/globe-context with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/command/globe-context')
        .set('Authorization', `Bearer ${responderToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.requiredPermission).toBe(JATAYU_PERMISSIONS.VIEW_3D_COMMAND_GLOBE);
    });

    it('denies Responder POST /api/command/drills/trigger with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/command/drills/trigger')
        .set('Authorization', `Bearer ${responderToken}`)
        .send({ scenarioType: 'FLOOD', sectorName: 'Chennai', severity: 'MODERATE' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  describe('5. Researcher Role Permissions (3D Analytical Modeling)', () => {
    it('allows Researcher GET /api/command/sectors (200 OK)', async () => {
      const res = await request(app)
        .get('/api/command/sectors')
        .set('Authorization', `Bearer ${researcherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.sectors).toBeDefined();
    });

    it('allows Researcher GET /api/command/district-telemetry (200 OK)', async () => {
      const res = await request(app)
        .get('/api/command/district-telemetry?lat=26.1445&lon=91.7362')
        .set('Authorization', `Bearer ${researcherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.district).toBeDefined();
    });

    it('allows Researcher GET /api/command/globe-context (200 OK with Cesium Config)', async () => {
      const res = await request(app)
        .get('/api/command/globe-context')
        .set('Authorization', `Bearer ${researcherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.authorized).toBe(true);
      expect(res.body.session.terrainProvider).toBe('CesiumWorldTerrain');
      expect(res.body.session.supportedImagery).toContain('ESRI_WORLD_IMAGERY');
      expect(res.body.session.role).toBe(JATAYU_ROLES.RESEARCHER);
    });

    it('denies Researcher POST /api/command/drills/trigger with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/command/drills/trigger')
        .set('Authorization', `Bearer ${researcherToken}`)
        .send({ scenarioType: 'EARTHQUAKE', sectorName: 'Dehradun', severity: 'SEVERE' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  describe('6. Government Role Permissions (Crisis Management & Drills)', () => {
    it('allows Government GET /api/command/globe-context (200 OK)', async () => {
      const res = await request(app)
        .get('/api/command/globe-context')
        .set('Authorization', `Bearer ${governmentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.authorized).toBe(true);
      expect(res.body.session.role).toBe(JATAYU_ROLES.GOVERNMENT);
    });

    it('allows Government POST /api/command/drills/trigger (201 Created)', async () => {
      const res = await request(app)
        .post('/api/command/drills/trigger')
        .set('Authorization', `Bearer ${governmentToken}`)
        .send({
          scenarioType: 'CYCLONE',
          sectorName: 'Chennai Coastal Basin',
          severity: 'EXTREME',
        });
      expect(res.status).toBe(201);
      expect(res.body.isSyntheticDrill).toBe(true);
      expect(res.body.isOfficialWarning).toBe(false);
      expect(res.body.warningNotice).toMatch(/SYNTHETIC OPERATIONAL DRILL ONLY/);
      expect(res.body.status).toBe('INITIATED');
      expect(res.body.triggeredBy.role).toBe(JATAYU_ROLES.GOVERNMENT);
    });
  });

  describe('7. Admin Role Full Capability & Privilege Escalation Defenses', () => {
    it('allows Admin to access all command endpoints', async () => {
      const [secRes, telRes, globeRes, drillRes] = await Promise.all([
        request(app).get('/api/command/sectors').set('Authorization', `Bearer ${adminToken}`),
        request(app).get('/api/command/district-telemetry?lat=13.0827&lon=80.2707').set('Authorization', `Bearer ${adminToken}`),
        request(app).get('/api/command/globe-context').set('Authorization', `Bearer ${adminToken}`),
        request(app)
          .post('/api/command/drills/trigger')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ scenarioType: 'TSUNAMI', sectorName: 'Chennai Coast', severity: 'EXTREME' }),
      ]);

      expect(secRes.status).toBe(200);
      expect(telRes.status).toBe(200);
      expect(globeRes.status).toBe(200);
      expect(drillRes.status).toBe(201);
    });

    it('ignores client-supplied header/body role overrides and rejects forged escalation', async () => {
      // Citizen sends forged headers and body claiming to be ADMIN
      const res = await request(app)
        .get('/api/command/globe-context')
        .set('Authorization', `Bearer ${citizenToken}`)
        .set('X-Role', 'ADMIN')
        .set('Role', 'ADMIN')
        .set('X-Privilege-Override', 'true')
        .send({ role: 'ADMIN' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  describe('8. Input Validation & Geographic Boundary Checks', () => {
    it('returns 400 INVALID_COORDINATES when coordinates are missing', async () => {
      const res = await request(app)
        .get('/api/command/district-telemetry')
        .set('Authorization', `Bearer ${responderToken}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_COORDINATES');
    });

    it('returns 400 INVALID_COORDINATES for non-numeric coordinates', async () => {
      const res = await request(app)
        .get('/api/command/district-telemetry?lat=not-a-number&lon=72.8777')
        .set('Authorization', `Bearer ${responderToken}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_COORDINATES');
    });

    it('returns 400 INVALID_COORDINATES for out-of-bounds latitude (> 90)', async () => {
      const res = await request(app)
        .get('/api/command/district-telemetry?lat=95.5&lon=72.8777')
        .set('Authorization', `Bearer ${responderToken}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_COORDINATES');
    });

    it('returns 400 INVALID_COORDINATES for out-of-bounds longitude (> 180)', async () => {
      const res = await request(app)
        .get('/api/command/district-telemetry?lat=19.076&lon=205.12')
        .set('Authorization', `Bearer ${responderToken}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_COORDINATES');
    });

    it('returns 400 INVALID_DRILL_PARAMETERS when drill body is missing required fields', async () => {
      const res = await request(app)
        .post('/api/command/drills/trigger')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ scenarioType: 'FLOOD' }); // missing sectorName and severity
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_DRILL_PARAMETERS');
    });
  });

  describe('9. Session Lifecycle, Revocation & Account Deactivation on Command Routes', () => {
    it('rejects access after user logs out (durable token revocation)', async () => {
      // Create user and token
      const officer = await userStore.registerUser({
        username: 'officer_logged_out',
        password: 'Password123!',
      });
      userStore.assignUserRole({
        targetUserId: officer.id,
        newRole: JATAYU_ROLES.RESPONDER,
        authorizedByRole: JATAYU_ROLES.ADMIN,
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'officer_logged_out', password: 'Password123!' });
      const officerToken = loginRes.body.token;

      // Verify command access works initially
      const preLogout = await request(app)
        .get('/api/command/sectors')
        .set('Authorization', `Bearer ${officerToken}`);
      expect(preLogout.status).toBe(200);

      // Perform logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${officerToken}`);
      expect(logoutRes.status).toBe(200);

      // Verify command access is immediately blocked with 401 TOKEN_REVOKED
      const postLogout = await request(app)
        .get('/api/command/sectors')
        .set('Authorization', `Bearer ${officerToken}`);
      expect(postLogout.status).toBe(401);
      expect(postLogout.body.code).toBe('TOKEN_REVOKED');
    });

    it('rejects access immediately after account is deactivated by admin', async () => {
      // Prior to deactivation, deactivatableToken works
      const preDeact = await request(app)
        .get('/api/command/sectors')
        .set('Authorization', `Bearer ${deactivatableToken}`);
      expect(preDeact.status).toBe(200);

      // Admin deactivates the account via /api/auth/admin/set-status
      const disableRes = await request(app)
        .post('/api/auth/admin/set-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ targetUserId: deactivatableUserId, disabled: true });
      expect(disableRes.status).toBe(200);

      // Subsequent call to protected command route is rejected with SESSION_INVALIDATED
      const postDeact = await request(app)
        .get('/api/command/sectors')
        .set('Authorization', `Bearer ${deactivatableToken}`);
      expect(postDeact.status).toBe(401);
      expect(postDeact.body.code).toBe('SESSION_INVALIDATED');
    });

    it('rejects access when user role is updated (role_version mismatch invalidates session)', async () => {
      // Register new user, promote to RESPONDER
      const rotatingOfficer = await userStore.registerUser({
        username: 'rotating_officer',
        password: 'Password123!',
      });
      const initial = userStore.assignUserRole({
        targetUserId: rotatingOfficer.id,
        newRole: JATAYU_ROLES.RESPONDER,
        authorizedByRole: JATAYU_ROLES.ADMIN,
      });

      const initialToken = tokenService.sign({
        sub: rotatingOfficer.id,
        role: initial.role,
        name: initial.displayName,
        rv: initial.roleVersion,
      });

      // Valid initially
      const resInitial = await request(app)
        .get('/api/command/sectors')
        .set('Authorization', `Bearer ${initialToken}`);
      expect(resInitial.status).toBe(200);

      // Admin changes role (demotes to CITIZEN, which increments role_version)
      userStore.assignUserRole({
        targetUserId: rotatingOfficer.id,
        newRole: JATAYU_ROLES.CITIZEN,
        authorizedByRole: JATAYU_ROLES.ADMIN,
      });

      // The old token has rv=2, but database has role_version=3
      const resAfterDemotion = await request(app)
        .get('/api/command/sectors')
        .set('Authorization', `Bearer ${initialToken}`);
      expect(resAfterDemotion.status).toBe(401);
      expect(resAfterDemotion.body.code).toBe('SESSION_INVALIDATED');
    });

    it('rejects expired and malformed tokens with 401 INVALID_CREDENTIALS', async () => {
      // Malformed token
      const resMalformed = await request(app)
        .get('/api/command/sectors')
        .set('Authorization', 'Bearer not-a-real-jwt-token');
      expect(resMalformed.status).toBe(401);
      expect(resMalformed.body.code).toBe('INVALID_CREDENTIALS');

      // Expired token
      const expiredToken = tokenService.sign(
        { sub: 'test', role: 'ADMIN', name: 'Expired', rv: 1 },
        { expiresInSeconds: -100 }
      );
      const resExpired = await request(app)
        .get('/api/command/sectors')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(resExpired.status).toBe(401);
      expect(resExpired.body.code).toBe('INVALID_CREDENTIALS');
    });
  });
});
