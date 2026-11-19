/**
 * JATAYU Dedicated Administrative Operations Router.
 * Endpoints for disaster alerts, civil defense facilities, external source health, and audit logs.
 * Strictly restricted to verified ADMIN users via backend RBAC middleware.
 */

import { Router, Request, Response } from 'express';
import { adminService } from '../services/admin.service.js';
import { getSharedUserStore } from '../auth/defaultStore.js';
import { createTokenService } from '../auth/tokens.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { config } from '../config.js';
import { JATAYU_ROLES } from '../auth/roles.js';

export function createAdminRouter(): Router {
  const router = Router();

  const userStore = getSharedUserStore();
  const tokenService = createTokenService({
    secret: config.auth.jwtSecret,
    defaultTtlSeconds: config.auth.jwtTtlSeconds,
    revocationChecker: (token) => userStore.isTokenRevoked(token),
  });

  const middleware = createAuthMiddleware({
    tokenService,
    userStore,
    trustProxy: config.auth.trustProxy,
  });

  // Enforce ADMIN role on all /api/admin routes
  router.use(middleware.authenticate);
  router.use(middleware.requireRoles([JATAYU_ROLES.ADMIN]));

  // 1. GET /api/admin/overview — Executive telemetry & statistics
  router.get('/overview', async (_req: Request, res: Response) => {
    try {
      const overview = await adminService.getOverview();
      res.status(200).json(overview);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch admin overview', code: 'ADMIN_OVERVIEW_ERROR' });
    }
  });

  // 2. Alert Management
  // GET /api/admin/alerts — List all alerts with optional status filter
  router.get('/alerts', (req: Request, res: Response) => {
    try {
      const statusFilter = req.query.status as string | undefined;
      const alerts = adminService.listAlerts(statusFilter);
      res.status(200).json({ alerts, count: alerts.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to list alerts', code: 'ALERTS_RETRIEVAL_ERROR' });
    }
  });

  // POST /api/admin/alerts — Create new administrative advisory alert
  router.post('/alerts', (req: Request, res: Response) => {
    try {
      const adminUsername = req.user?.username || 'admin';
      const { title, description, category, severity, affectedArea, expiresAt } = req.body || {};

      const alert = adminService.createAlert(
        { title, description, category, severity, affectedArea, expiresAt },
        adminUsername
      );

      res.status(201).json({ message: 'Alert created and published successfully', alert });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create alert', code: 'ALERT_CREATION_FAILED' });
    }
  });

  // PUT /api/admin/alerts/:id — Update existing alert details or severity
  router.put('/alerts/:id', (req: Request, res: Response) => {
    try {
      const adminUsername = req.user?.username || 'admin';
      const alertId = req.params.id;
      const { title, description, severity, status, expiresAt } = req.body || {};

      const updated = adminService.updateAlert(
        alertId,
        { title, description, severity, status, expiresAt },
        adminUsername
      );

      res.status(200).json({ message: 'Alert updated successfully', alert: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update alert', code: 'ALERT_UPDATE_FAILED' });
    }
  });

  // DELETE /api/admin/alerts/:id — Mark alert as withdrawn
  router.delete('/alerts/:id', (req: Request, res: Response) => {
    try {
      const adminUsername = req.user?.username || 'admin';
      const alertId = req.params.id;

      const withdrawn = adminService.withdrawAlert(alertId, adminUsername);
      res.status(200).json({ message: 'Alert withdrawn successfully', alert: withdrawn });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to withdraw alert', code: 'ALERT_WITHDRAW_FAILED' });
    }
  });

  // 3. Emergency Facility Management
  // GET /api/admin/facilities — List facilities with verification status filter
  router.get('/facilities', (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const category = req.query.category as string | undefined;
      const facilities = adminService.listFacilities({ status, category });
      res.status(200).json({ facilities, count: facilities.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to list facilities', code: 'FACILITIES_LIST_ERROR' });
    }
  });

  // POST /api/admin/facilities — Register new emergency facility
  router.post('/facilities', (req: Request, res: Response) => {
    try {
      const adminUsername = req.user?.username || 'admin';
      const {
        name,
        category,
        latitude,
        longitude,
        address,
        district,
        phone,
        responsibleAuthority,
        capacity,
        notes,
      } = req.body || {};

      const facility = adminService.createFacility(
        {
          name,
          category,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          address,
          district,
          phone,
          responsibleAuthority,
          capacity: capacity ? parseInt(capacity, 10) : undefined,
          notes,
        },
        adminUsername
      );

      res.status(201).json({ message: 'Facility registered successfully', facility });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to register facility', code: 'FACILITY_CREATION_FAILED' });
    }
  });

  // PUT /api/admin/facilities/:id — Update facility details
  router.put('/facilities/:id', (req: Request, res: Response) => {
    try {
      const adminUsername = req.user?.username || 'admin';
      const facilityId = req.params.id;
      const updated = adminService.updateFacility(facilityId, req.body || {}, adminUsername);
      res.status(200).json({ message: 'Facility updated successfully', facility: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update facility', code: 'FACILITY_UPDATE_FAILED' });
    }
  });

  // POST /api/admin/facilities/:id/verify — Verify or reject facility entry
  router.post('/facilities/:id/verify', (req: Request, res: Response) => {
    try {
      const adminUsername = req.user?.username || 'admin';
      const facilityId = req.params.id;
      const { status, notes } = req.body || {};

      if (!['VERIFIED', 'REJECTED', 'INACTIVE'].includes(status)) {
        res.status(400).json({
          error: 'Invalid verification status. Must be VERIFIED, REJECTED, or INACTIVE.',
          code: 'INVALID_VERIFICATION_STATUS',
        });
        return;
      }

      const verified = adminService.verifyFacility(facilityId, status, notes || '', adminUsername);
      res.status(200).json({ message: `Facility status updated to ${status}`, facility: verified });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Verification workflow failed', code: 'VERIFICATION_FAILED' });
    }
  });

  // 4. External Data Source Monitoring
  // GET /api/admin/sources — Retrieve connection status and freshness of all feeds
  router.get('/sources', async (_req: Request, res: Response) => {
    try {
      const sources = await adminService.getDataSourcesStatus();
      res.status(200).json({ sources, count: sources.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to inspect data sources', code: 'SOURCES_INSPECTION_ERROR' });
    }
  });

  // 5. Audit Logs
  // GET /api/admin/audit-logs — Retrieve administrative action trail
  router.get('/audit-logs', (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const logs = adminService.listAuditLogs(limit);
      res.status(200).json({ logs, count: logs.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to retrieve audit logs', code: 'AUDIT_LOGS_ERROR' });
    }
  });

  return router;
}

export const adminRouter = createAdminRouter();
