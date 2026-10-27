/**
 * Express Authentication & Identity Router for JATAYU.
 * Provides endpoints for registration, login, logout, identity inspection, and administrative role assignment.
 */

import { Router, Request, Response } from 'express';
import { config } from '../config.js';
import {
  JATAYU_PERMISSIONS,
  getPermissionsForRole,
} from '../auth/roles.js';
import { createAuthMiddleware, AuthMiddleware } from '../auth/middleware.js';
import { createPersistentUserStore, UserStore } from '../auth/userStore.js';
import { createTokenService, TokenService } from '../auth/tokens.js';

export interface AuthRouterDependencies {
  userStore?: UserStore;
  tokenService?: TokenService;
  authMiddleware?: AuthMiddleware;
  trustProxy?: boolean;
}

export function createAuthRouter(deps: AuthRouterDependencies = {}): Router {
  const router = Router();

  const userStore = deps.userStore || createPersistentUserStore({ dbPath: config.auth.dbPath });
  const tokenService = deps.tokenService || createTokenService({
    secret: config.auth.jwtSecret,
    defaultTtlSeconds: config.auth.jwtTtlSeconds,
    revocationChecker: (token) => userStore.isTokenRevoked(token),
  });

  const middleware = deps.authMiddleware || createAuthMiddleware({
    tokenService,
    userStore,
    trustProxy: deps.trustProxy ?? config.auth.trustProxy,
  });

  // 1. POST /register (Public registration, strictly CITIZEN)
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { username, password, displayName, role } = req.body || {};
      const registered = await userStore.registerUser({
        username,
        password,
        displayName,
        role,
      });

      res.status(201).json({
        message: 'User registered successfully',
        user: registered,
      });
    } catch (err: any) {
      res.status(400).json({
        error: err.message || 'Registration failed',
        code: 'REGISTRATION_FAILED',
      });
    }
  });

  // 2. POST /login (Dual-throttled authentication)
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body || {};
      const clientIp = middleware.getClientIp(req);

      const authenticated = await userStore.authenticateUser(
        username,
        password,
        clientIp
      );

      if (!authenticated) {
        res.status(401).json({
          error: 'Invalid username or password',
          code: 'INVALID_CREDENTIALS',
        });
        return;
      }

      const token = tokenService.sign({
        sub: authenticated.id,
        username: authenticated.username,
        role: authenticated.role,
        rv: authenticated.roleVersion,
      });

      res.status(200).json({
        token,
        user: {
          id: authenticated.id,
          username: authenticated.username,
          role: authenticated.role,
          displayName: authenticated.displayName,
          permissions: getPermissionsForRole(authenticated.role),
        },
        expiresInSeconds: config.auth.jwtTtlSeconds,
      });
    } catch (err: any) {
      if (err.message?.includes('Too many failed attempts')) {
        res.status(429).json({
          error: err.message,
          code: 'RATE_LIMITED',
        });
      } else {
        res.status(401).json({
          error: err.message || 'Authentication failed',
          code: 'LOGIN_FAILED',
        });
      }
    }
  });

  // 3. POST /logout (Session Revocation)
  router.post('/logout', middleware.authenticate, (req: Request, res: Response) => {
    if (req.rawToken && req.user) {
      userStore.revokeToken(req.rawToken, req.user.exp, 'User logout');
    }
    res.status(200).json({
      message: 'Session successfully revoked',
      code: 'SESSION_REVOKED',
    });
  });

  // 4. GET /me (Current Authenticated User Identity)
  router.get('/me', middleware.authenticate, (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated', code: 'AUTH_REQUIRED' });
      return;
    }

    const profile = userStore.getUserById(req.user.sub);
    if (!profile) {
      res.status(404).json({ error: 'User profile not found', code: 'USER_NOT_FOUND' });
      return;
    }

    res.status(200).json({
      user: {
        id: profile.id,
        username: profile.username,
        role: profile.role,
        displayName: profile.display_name,
        permissions: getPermissionsForRole(profile.role),
        roleVersion: profile.role_version,
      },
    });
  });

  // 5. POST /admin/assign-role (Admin-Only Role Assignment)
  router.post(
    '/admin/assign-role',
    middleware.authenticate,
    middleware.requirePermission(JATAYU_PERMISSIONS.MANAGE_USERS_ROLES),
    async (req: Request, res: Response) => {
      try {
        const { targetUserId, newRole } = req.body || {};
        if (!req.user) {
          res.status(401).json({ error: 'Unauthenticated', code: 'AUTH_REQUIRED' });
          return;
        }

        const updated = userStore.assignUserRole({
          targetUserId,
          newRole,
          authorizedByRole: req.user.role,
        });

        res.status(200).json({
          message: 'Role updated successfully',
          user: updated,
        });
      } catch (err: any) {
        res.status(400).json({
          error: err.message || 'Role assignment failed',
          code: 'ROLE_ASSIGNMENT_FAILED',
        });
      }
    }
  );

  // 6. POST /admin/set-status (Admin-Only User Account Enabling / Disabling)
  router.post(
    '/admin/set-status',
    middleware.authenticate,
    middleware.requirePermission(JATAYU_PERMISSIONS.MANAGE_USERS_ROLES),
    async (req: Request, res: Response) => {
      try {
        const { targetUserId, disabled } = req.body || {};
        if (!req.user) {
          res.status(401).json({ error: 'Unauthenticated', code: 'AUTH_REQUIRED' });
          return;
        }

        if (typeof disabled !== 'boolean') {
          res.status(400).json({
            error: 'Invalid disabled status; boolean required.',
            code: 'INVALID_STATUS',
          });
          return;
        }

        userStore.setUserDisabled(targetUserId, disabled, req.user.role);

        res.status(200).json({
          message: `User status updated to ${disabled ? 'disabled' : 'enabled'} successfully`,
          targetUserId,
          disabled,
        });
      } catch (err: any) {
        res.status(400).json({
          error: err.message || 'User status update failed',
          code: 'STATUS_UPDATE_FAILED',
        });
      }
    }
  );

  return router;
}

export const authRouter = createAuthRouter();
