/**
 * Admin Module & RBAC Security Test Suite for JATAYU.
 * Tests:
 * 1. AdminService database operations (alerts CRUD, facilities register/verify, telemetry, audit logs).
 * 2. Admin Router RBAC authentication and authorization enforcement (denies CITIZEN, allows ADMIN).
 * 3. Complete alert lifecycle (draft -> publish -> update -> expire/delete).
 * 4. Verification state machine for emergency facilities.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { adminService } from '../services/admin.service.js';
import { createTokenService } from '../auth/tokens.js';
import { getSharedUserStore } from '../auth/defaultStore.js';
import { config } from '../config.js';
import { JATAYU_ROLES } from '../auth/roles.js';

describe('Admin Module & RBAC Authorization Suite', () => {
  let adminToken: string;
  let citizenToken: string;

  beforeAll(async () => {
    const userStore = getSharedUserStore();

    const testSecret = 'a-super-secret-provisioning-key-of-32-chars-min';
    let adminUser = userStore.getUserByUsername('admin_test_operator');
    if (!adminUser) {
      const created = await userStore.provisionInitialAdmin({
        username: 'admin_test_operator',
        password: 'AdminPassword123!',
        displayName: 'Admin Test Operator',
        provisioningSecret: testSecret,
        expectedSecret: testSecret,
      });
      adminUser = userStore.getUserById(created.id);
    }

    let citizenUser = userStore.getUserByUsername('citizen_test_citizen');
    if (!citizenUser) {
      const created = await userStore.registerUser({
        username: 'citizen_test_citizen',
        password: 'CitizenPassword123!',
        displayName: 'Citizen Test User',
        role: JATAYU_ROLES.CITIZEN,
      });
      citizenUser = userStore.getUserById(created.id);
    }

    const tokenService = createTokenService({
      secret: config.auth.jwtSecret,
      defaultTtlSeconds: 3600,
    });

    adminToken = tokenService.sign({
      sub: adminUser!.id,
      username: adminUser!.username,
      role: adminUser!.role,
    });

    citizenToken = tokenService.sign({
      sub: citizenUser!.id,
      username: citizenUser!.username,
      role: citizenUser!.role,
    });
  });

  describe('1. RBAC Gateway Route Protection', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/overview');
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('rejects non-admin (CITIZEN) requests with 403', async () => {
      const res = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    it('allows ADMIN requests to access /api/admin/overview with 200', async () => {
      const res = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(typeof (res.body.totalAlerts ?? res.body.activeAlerts)).toBe('number');
      expect(typeof res.body.totalFacilities).toBe('number');
    });
  });

  describe('2. Alert Management Workflow', () => {
    let createdAlertId: string;

    it('creates a new emergency administrative advisory', async () => {
      const payload = {
        title: 'Localized Waterlogging Warning - Saidapet Subway',
        description: 'Heavy precipitation causing 0.5m accumulation. Pumps deployed.',
        severity: 'WARNING',
        disasterType: 'FLOOD',
        affectedArea: 'Saidapet, Chennai',
        source: 'JATAYU Administrative Desk',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      const res = await request(app)
        .post('/api/admin/alerts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.alert).toBeDefined();
      expect(res.body.alert.title).toBe(payload.title);
      expect(res.body.alert.severity).toBe('WARNING');
      expect(res.body.alert.status).toBe('ACTIVE');
      createdAlertId = res.body.alert.id;
    });

    it('retrieves created alert via GET /api/admin/alerts', async () => {
      const res = await request(app)
        .get('/api/admin/alerts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.alerts)).toBe(true);
      const match = res.body.alerts.find((a: any) => a.id === createdAlertId);
      expect(match).toBeDefined();
      expect(match.title).toContain('Saidapet Subway');
    });

    it('updates alert severity and status via PUT /api/admin/alerts/:id', async () => {
      const res = await request(app)
        .put(`/api/admin/alerts/${createdAlertId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          severity: 'SEVERE',
          status: 'ACTIVE',
        });

      expect(res.status).toBe(200);
      expect(res.body.alert.severity).toBe('SEVERE');
    });

    it('marks alert as WITHDRAWN via DELETE /api/admin/alerts/:id', async () => {
      const res = await request(app)
        .delete(`/api/admin/alerts/${createdAlertId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.alert.status).toBe('WITHDRAWN');
    });
  });

  describe('3. Facility Management & Verification Workflow', () => {
    let createdFacilityId: string;

    it('registers a newly surveyed emergency shelter in PENDING_VERIFICATION state', async () => {
      const newFacility = {
        name: 'Velachery Community Hall Refuge',
        category: 'EMERGENCY_SHELTER',
        latitude: 12.9815,
        longitude: 80.218,
        address: '100 Feet Bypass Rd, Velachery, Chennai, Tamil Nadu 600042',
        district: 'Chennai',
        contactNumber: '+91 44 2244 5566',
        responsibleAuthority: 'Greater Chennai Corporation',
        verificationStatus: 'PENDING_VERIFICATION',
        capacity: 350,
        notes: 'High-elevation community hall with backup diesel gen-set.',
      };

      const res = await request(app)
        .post('/api/admin/facilities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newFacility);

      expect(res.status).toBe(201);
      expect(res.body.facility).toBeDefined();
      expect(res.body.facility.name).toBe(newFacility.name);
      expect(res.body.facility.verificationStatus).toBe('PENDING_VERIFICATION');
      createdFacilityId = res.body.facility.id;
    });

    it('authorizes and verifies the facility with post-audit update', async () => {
      const res = await request(app)
        .post(`/api/admin/facilities/${createdFacilityId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'VERIFIED',
          notes: 'Inspected on-site by District Collectorate inspector.',
        });

      expect(res.status).toBe(200);
      expect(res.body.facility.verificationStatus).toBe('VERIFIED');
      expect(res.body.facility.notes).toContain('Inspected on-site');
    });
  });

  describe('4. Data Sources Telemetry & Audit Logs', () => {
    it('retrieves telemetry health for integrated data sources', async () => {
      const res = await request(app)
        .get('/api/admin/sources')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.sources)).toBe(true);
      expect(res.body.sources.length).toBeGreaterThan(0);
      const imdSource = res.body.sources.find((s: any) => s.id === 'src_imd_rss');
      expect(imdSource).toBeDefined();
      expect(imdSource.name).toContain('IMD');
    });

    it('records and returns audit logs for tracking administrative actions', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.logs)).toBe(true);
      expect(res.body.logs.length).toBeGreaterThan(0);
      // Ensure one of the logs records our previous actions
      const actions = res.body.logs.map((l: any) => l.action);
      expect(actions).toContain('ALERT_CREATED');
      expect(actions).toContain('FACILITY_VERIFIED');
    });
  });
});
