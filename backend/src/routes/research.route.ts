import { Router, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { JATAYU_ROLES } from '../auth/roles.js';
import { createAuthMiddleware, AuthMiddleware } from '../auth/middleware.js';
import { createPersistentUserStore, UserStore } from '../auth/userStore.js';
import { createTokenService, TokenService } from '../auth/tokens.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ResearchRouterDependencies {
  userStore?: UserStore;
  tokenService?: TokenService;
  authMiddleware?: AuthMiddleware;
  trustProxy?: boolean;
}

export function createResearchRouter(deps: ResearchRouterDependencies = {}): Router {
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

  // Allowed roles for research simulation access (RESEARCHER, GOVERNMENT, ADMIN)
  const ALLOWED_ROLES = [
    JATAYU_ROLES.RESEARCHER,
    JATAYU_ROLES.GOVERNMENT,
    JATAYU_ROLES.ADMIN,
  ] as const;

  router.get(
    '/simulations/adyar-corridor-s2',
    middleware.authenticate,
    middleware.requireRoles(ALLOWED_ROLES),
    (req: Request, res: Response) => {
      res.setHeader('X-Data-Trust-Tier', 'EXPERIMENTAL_UNVALIDATED');

      const possibleGeojsonPaths = [
        path.resolve(process.cwd(), 'data/research/pilot_che_02/processed/adyar_corridor_s2_inundation_contours.geojson'),
        path.resolve(process.cwd(), 'backend/data/research/adyar_corridor_s2_inundation_contours.geojson'),
        path.resolve(__dirname, '../data/research/adyar_corridor_s2_inundation_contours.geojson'),
        path.resolve(__dirname, '../../data/research/adyar_corridor_s2_inundation_contours.geojson'),
        path.resolve(__dirname, '../../../data/research/pilot_che_02/processed/adyar_corridor_s2_inundation_contours.geojson'),
      ];

      const possibleMetaPaths = [
        path.resolve(process.cwd(), 'data/research/pilot_che_02/processed/adyar_corridor_s2_meta.json'),
        path.resolve(process.cwd(), 'backend/data/research/adyar_corridor_s2_meta.json'),
        path.resolve(__dirname, '../data/research/adyar_corridor_s2_meta.json'),
        path.resolve(__dirname, '../../data/research/adyar_corridor_s2_meta.json'),
        path.resolve(__dirname, '../../../data/research/pilot_che_02/processed/adyar_corridor_s2_meta.json'),
      ];

      let meta = null;
      for (const p of possibleMetaPaths) {
        if (fs.existsSync(p)) {
          try {
            meta = JSON.parse(fs.readFileSync(p, 'utf-8'));
            break;
          } catch {
            // continue
          }
        }
      }

      let geojson = null;
      for (const p of possibleGeojsonPaths) {
        if (fs.existsSync(p)) {
          try {
            geojson = JSON.parse(fs.readFileSync(p, 'utf-8'));
            break;
          } catch {
            // continue
          }
        }
      }

      if (!geojson || !meta) {
        res.status(404).json({
          error: 'Simulation data not found or still generating',
          code: 'SIMULATION_NOT_FOUND',
          data_trust_tier: 'EXPERIMENTAL_UNVALIDATED',
        });
        return;
      }

      res.status(200).json({
        data_trust_tier: 'EXPERIMENTAL_UNVALIDATED',
        trust_badge: '⚠️ EXPERIMENTAL SIMULATION — NOT VALIDATED FOR OFFICIAL CIVIL DEFENSE',
        disclaimer: 'EXPERIMENTAL RESEARCH OUTPUT — Strictly quarantined from civil protection directives, alerts, and operational risk matrix.',
        requestedBy: {
          userId: req.user!.sub,
          role: req.user!.role,
        },
        metadata: meta,
        geojson,
      });
    }
  );

  return router;
}

export const researchRouter = createResearchRouter();
