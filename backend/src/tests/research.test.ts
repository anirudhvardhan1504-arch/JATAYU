import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { JATAYU_ROLES } from '../auth/roles.js';
import { createTokenService } from '../auth/tokens.js';
import { createPersistentUserStore } from '../auth/userStore.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { createResearchRouter } from '../routes/research.route.js';

const TEST_SECRET = 'a-super-secret-research-jwt-key-32chars!';
const TEST_ADMIN_KEY = 'admin-provisioning-secret-32chars-test!';

describe('JATAYU Research Simulation APIs & Data-Trust Tier', () => {
  let app: express.Express;
  let userStore: ReturnType<typeof createPersistentUserStore>;
  let tokenService: ReturnType<typeof createTokenService>;

  let citizenToken: string;
  let responderToken: string;
  let researcherToken: string;
  let governmentToken: string;
  let adminToken: string;

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

    app = express();
    app.use(express.json());
    app.use('/api/research', createResearchRouter({
      userStore,
      tokenService,
      authMiddleware,
      trustProxy: false,
    }));

    // Bootstrap Admin
    await userStore.provisionInitialAdmin({
      username: 'research_admin',
      password: 'AdminPassword123!',
      provisioningSecret: TEST_ADMIN_KEY,
      expectedSecret: TEST_ADMIN_KEY,
    });
    const adminUser = await userStore.authenticateUser('research_admin', 'AdminPassword123!');
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
  }, 30000);

  it('rejects unauthenticated requests with 401 AUTH_REQUIRED', async () => {
    const res = await request(app).get('/api/research/simulations/adyar-corridor-s2');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  it('rejects CITIZEN role with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get('/api/research/simulations/adyar-corridor-s2')
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('rejects RESPONDER role with 403 FORBIDDEN (operational personnel quarantined from raw research)', async () => {
    const res = await request(app)
      .get('/api/research/simulations/adyar-corridor-s2')
      .set('Authorization', `Bearer ${responderToken}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('authorizes RESEARCHER role with 200, trust tier badge, and GeoJSON payload', async () => {
    const res = await request(app)
      .get('/api/research/simulations/adyar-corridor-s2')
      .set('Authorization', `Bearer ${researcherToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['x-data-trust-tier']).toBe('EXPERIMENTAL_UNVALIDATED');
    expect(res.body.data_trust_tier).toBe('EXPERIMENTAL_UNVALIDATED');
    expect(res.body.trust_badge).toContain('EXPERIMENTAL SIMULATION');
    expect(res.body.metadata.horizon_hours).toBe(3);
    expect(res.body.metadata.status).toBe('EXPERIMENTAL_UNVALIDATED');
    expect(res.body.geojson).toBeDefined();
    expect(res.body.geojson.type).toBe('FeatureCollection');
    expect(res.body.geojson.features.length).toBeGreaterThan(0);
  });

  it('authorizes GOVERNMENT and ADMIN roles with 200', async () => {
    const govRes = await request(app)
      .get('/api/research/simulations/adyar-corridor-s2')
      .set('Authorization', `Bearer ${governmentToken}`);
    expect(govRes.status).toBe(200);
    expect(govRes.body.data_trust_tier).toBe('EXPERIMENTAL_UNVALIDATED');

    const adminRes = await request(app)
      .get('/api/research/simulations/adyar-corridor-s2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data_trust_tier).toBe('EXPERIMENTAL_UNVALIDATED');
  });
});
