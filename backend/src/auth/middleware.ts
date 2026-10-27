/**
 * Server-Side Authentication & Authorization Middleware for Express.
 * Enforces deny-by-default role authorization, durable session revocation checks,
 * and secure client IP resolution.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { hasPermission, isValidPermission, isValidRole, JatayuPermission } from './roles.js';
import { TokenService, VerifiedClaims } from './tokens.js';
import { UserStore } from './userStore.js';

// Extend Express Request declaration to include authenticated user claims and raw token
declare global {
  namespace Express {
    interface Request {
      user?: VerifiedClaims;
      rawToken?: string;
    }
  }
}

/**
 * Safely extracts the client IP address.
 * Never trusts X-Forwarded-For unless trustProxy is explicitly enabled.
 */
export function getClientIp(req: Request, trustProxy = false): string {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      const parts = forwarded.split(',');
      const candidate = parts[0].trim();
      if (candidate) return candidate;
    }
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

export interface AuthMiddlewareOptions {
  tokenService: TokenService;
  userStore?: UserStore;
  trustProxy?: boolean;
}

export interface AuthMiddleware {
  getClientIp(req: Request): string;
  authenticate: RequestHandler;
  requirePermission(permission: string): RequestHandler;
  requireRoles(allowedRoles: readonly string[]): RequestHandler;
}

export function createAuthMiddleware({
  tokenService,
  userStore,
  trustProxy = false,
}: AuthMiddlewareOptions): AuthMiddleware {
  if (!tokenService) {
    throw new Error('TokenService is required for auth middleware');
  }

  function sendJson(res: Response, statusCode: number, data: object): void {
    res.status(statusCode).json(data);
  }

  return {
    getClientIp(req: Request): string {
      return getClientIp(req, trustProxy);
    },

    authenticate(req: Request, res: Response, next: NextFunction): void {
      const authHeader = req.headers.authorization || req.headers.Authorization;

      if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        sendJson(res, 401, {
          error: 'Authentication required. Missing or malformed Bearer token.',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      const token = authHeader.slice(7).trim();

      // Check durable revocation in database
      if (userStore && typeof userStore.isTokenRevoked === 'function') {
        if (userStore.isTokenRevoked(token)) {
          sendJson(res, 401, {
            error: 'Session has been revoked. Please log in again.',
            code: 'TOKEN_REVOKED',
          });
          return;
        }
      }

      try {
        const claims = tokenService.verify(token);

        // Check if user is still active and has not been deactivated or had role invalidated
        if (userStore && typeof userStore.validateUserSession === 'function') {
          const roleVersion = typeof claims.rv === 'number' ? claims.rv : null;
          const activeUser = userStore.validateUserSession(claims.sub, roleVersion);
          if (!activeUser) {
            sendJson(res, 401, {
              error: 'User session has expired or account has been deactivated.',
              code: 'SESSION_INVALIDATED',
            });
            return;
          }
          // Ensure claims role matches current database role
          claims.role = activeUser.role;
        }

        req.user = claims;
        req.rawToken = token;
        next();
      } catch {
        sendJson(res, 401, {
          error: 'Authentication failed. Invalid or expired token.',
          code: 'INVALID_CREDENTIALS',
        });
      }
    },

    requirePermission(permission: string): RequestHandler {
      if (!isValidPermission(permission)) {
        throw new Error(`Invalid permission configured in route: '${permission}'`);
      }

      return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
          sendJson(res, 401, {
            error: 'Authentication required prior to capability check.',
            code: 'AUTH_REQUIRED',
          });
          return;
        }

        const userRole = req.user.role;

        // Security check: Never trust client headers or body overrides for role
        if (!hasPermission(userRole, permission as JatayuPermission)) {
          sendJson(res, 403, {
            error: `Access denied. Role '${userRole}' lacks required capability '${permission}'.`,
            code: 'FORBIDDEN',
            requiredPermission: permission,
          });
          return;
        }

        next();
      };
    },

    requireRoles(allowedRoles: readonly string[]): RequestHandler {
      for (const role of allowedRoles) {
        if (!isValidRole(role)) {
          throw new Error(`Invalid role configured in route: '${role}'`);
        }
      }

      return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
          sendJson(res, 401, {
            error: 'Authentication required prior to role check.',
            code: 'AUTH_REQUIRED',
          });
          return;
        }

        const userRole = req.user.role;
        if (!allowedRoles.includes(userRole)) {
          sendJson(res, 403, {
            error: `Access denied. Role '${userRole}' is not authorized for this resource.`,
            code: 'FORBIDDEN',
            allowedRoles,
          });
          return;
        }

        next();
      };
    },
  };
}
