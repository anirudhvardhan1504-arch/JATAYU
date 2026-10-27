/**
 * Express Operational & Command Router for JATAYU.
 * Provides server-enforced privileged operational endpoints:
 * - GET  /api/command/sectors: Operational sector tracking (requires command:view_sectors)
 * - GET  /api/command/district-telemetry: High-resolution administrative interrogation (requires district:interrogate_telemetry)
 * - GET  /api/command/globe-context: 3D Cesium command globe configuration & session authorization (requires command3d:view_globe)
 * - POST /api/command/drills/trigger: Multi-agency synthetic disaster simulation drill (requires drill:trigger_simulation)
 */

import { Router, Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { JATAYU_PERMISSIONS } from '../auth/roles.js';
import { createAuthMiddleware, AuthMiddleware } from '../auth/middleware.js';
import { createPersistentUserStore, UserStore } from '../auth/userStore.js';
import { createTokenService, TokenService } from '../auth/tokens.js';
import { DistrictBoundaryService } from '../services/district.service.js';

export interface OperationalSector {
  id: string;
  name: string;
  label: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  status: string;
  tacticalZone: string;
  coverage: string;
  provenance: string;
}

export const OPERATIONAL_SECTORS: readonly OperationalSector[] = Object.freeze([
  {
    id: 'SEC-MUM-01',
    name: 'Mumbai Metropolitan Region',
    label: 'Mumbai Metro (West Coast)',
    coordinates: { lat: 19.076, lon: 72.8777 },
    status: 'ACTIVE_MONITORING',
    tacticalZone: 'WESTERN_COASTAL',
    coverage: 'Urban Coastal & Catchment',
    provenance: 'DataMeet Census 2011 & IMD Regional Meteorological Centre Mumbai',
  },
  {
    id: 'SEC-CHE-02',
    name: 'Chennai Coastal Basin',
    label: 'Chennai Coast (Bay of Bengal)',
    coordinates: { lat: 13.0827, lon: 80.2707 },
    status: 'ACTIVE_MONITORING',
    tacticalZone: 'EASTERN_LITTORAL',
    coverage: 'Coromandel Coastal Lowlands',
    provenance: 'DataMeet Census 2011 & IMD Regional Meteorological Centre Chennai',
  },
  {
    id: 'SEC-GHY-03',
    name: 'Brahmaputra Valley (Guwahati)',
    label: 'Assam Valley (Brahmaputra)',
    coordinates: { lat: 26.1445, lon: 91.7362 },
    status: 'ACTIVE_MONITORING',
    tacticalZone: 'NORTHEAST_RIVERINE',
    coverage: 'Alluvial Flood Basin',
    provenance: 'DataMeet Census 2011 & Central Water Commission Hydrological Grid',
  },
  {
    id: 'SEC-DED-04',
    name: 'Dehradun Hill Catchment',
    label: 'Uttarakhand Himalayan Foothills',
    coordinates: { lat: 30.3165, lon: 78.0322 },
    status: 'ACTIVE_MONITORING',
    tacticalZone: 'HIMALAYAN_OROGRAPHIC',
    coverage: 'Sub-Himalayan Slope & Drainage',
    provenance: 'DataMeet Census 2011 & IMD Dehradun Doppler Catchment Grid',
  },
  {
    id: 'SEC-CCU-05',
    name: 'Kolkata Deltaic Zone',
    label: 'Ganga-Brahmaputra Delta',
    coordinates: { lat: 22.5726, lon: 88.3639 },
    status: 'ACTIVE_MONITORING',
    tacticalZone: 'DELTAIC_ESTUARY',
    coverage: 'Tidal Delta Basin',
    provenance: 'DataMeet Census 2011 & Regional Specialised Meteorological Centre Kolkata',
  },
]);

export interface CommandRouterDependencies {
  userStore?: UserStore;
  tokenService?: TokenService;
  authMiddleware?: AuthMiddleware;
  districtService?: DistrictBoundaryService;
  trustProxy?: boolean;
}

export function createCommandRouter(deps: CommandRouterDependencies = {}): Router {
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

  const districtService = deps.districtService || new DistrictBoundaryService();

  // 1. GET /api/command/sectors
  // Requires: VIEW_OPERATIONAL_SECTORS (RESPONDER, RESEARCHER, GOVERNMENT, ADMIN)
  router.get(
    '/sectors',
    middleware.authenticate,
    middleware.requirePermission(JATAYU_PERMISSIONS.VIEW_OPERATIONAL_SECTORS),
    (req: Request, res: Response) => {
      res.status(200).json({
        sectors: OPERATIONAL_SECTORS,
        count: OPERATIONAL_SECTORS.length,
        telemetryTimestamp: new Date().toISOString(),
        requestedBy: {
          userId: req.user!.sub,
          role: req.user!.role,
        },
      });
    }
  );

  // 2. GET /api/command/district-telemetry
  // Requires: INTERROGATE_DISTRICT_TELEMETRY (RESPONDER, RESEARCHER, GOVERNMENT, ADMIN)
  router.get(
    '/district-telemetry',
    middleware.authenticate,
    middleware.requirePermission(JATAYU_PERMISSIONS.INTERROGATE_DISTRICT_TELEMETRY),
    (req: Request, res: Response) => {
      const latStr = req.query.lat as string | undefined;
      const lonStr = req.query.lon as string | undefined;

      if (!latStr || !lonStr) {
        res.status(400).json({
          error: 'Both latitude (lat) and longitude (lon) query parameters are required.',
          code: 'INVALID_COORDINATES',
        });
        return;
      }

      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);

      if (isNaN(lat) || isNaN(lon) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        res.status(400).json({
          error: 'Latitude and longitude must be valid numeric values.',
          code: 'INVALID_COORDINATES',
        });
        return;
      }

      if (lat < -90 || lat > 90) {
        res.status(400).json({
          error: `Latitude ${lat} is out of valid geographic range [-90, 90].`,
          code: 'INVALID_COORDINATES',
        });
        return;
      }

      if (lon < -180 || lon > 180) {
        res.status(400).json({
          error: `Longitude ${lon} is out of valid geographic range [-180, 180].`,
          code: 'INVALID_COORDINATES',
        });
        return;
      }

      const resolved = districtService.findDistrictByCoordinates(lat, lon);

      res.status(200).json({
        telemetryTimestamp: new Date().toISOString(),
        query: { lat, lon },
        operator: {
          userId: req.user!.sub,
          role: req.user!.role,
        },
        district: resolved,
      });
    }
  );

  // 3. GET /api/command/globe-context
  // Requires: VIEW_3D_COMMAND_GLOBE (RESEARCHER, GOVERNMENT, ADMIN)
  router.get(
    '/globe-context',
    middleware.authenticate,
    middleware.requirePermission(JATAYU_PERMISSIONS.VIEW_3D_COMMAND_GLOBE),
    (req: Request, res: Response) => {
      res.status(200).json({
        authorized: true,
        issuedAt: new Date().toISOString(),
        session: {
          subject: req.user!.sub,
          role: req.user!.role,
          terrainProvider: 'CesiumWorldTerrain',
          supportedImagery: ['ESRI_WORLD_IMAGERY', 'CARTO_DARK'],
          tacticalLayers: ['RADAR_REFLECTIVITY', 'FLOOD_INUNDATION', 'SHELTER_HUBS'],
          cameraDefault: {
            lat: 20.5937,
            lon: 78.9629,
            altitudeMeters: 5000000,
          },
          limits: {
            maxAltitudeMeters: 15000000,
            minAltitudeMeters: 100,
          },
          featureFlags: {
            volumetricRadar: true,
            terrainElevation: true,
            tacticalOverlays: true,
          },
          disclaimer: 'Indicative 3D Command Environment - Cesium authorization active',
        },
      });
    }
  );

  // 4. POST /api/command/drills/trigger
  // Requires: TRIGGER_SIMULATION_DRILLS (GOVERNMENT, ADMIN)
  router.post(
    '/drills/trigger',
    middleware.authenticate,
    middleware.requirePermission(JATAYU_PERMISSIONS.TRIGGER_SIMULATION_DRILLS),
    (req: Request, res: Response) => {
      const { scenarioType, sectorName, severity } = req.body || {};

      if (
        !scenarioType ||
        typeof scenarioType !== 'string' ||
        !sectorName ||
        typeof sectorName !== 'string' ||
        !severity ||
        typeof severity !== 'string'
      ) {
        res.status(400).json({
          error: 'Invalid drill scenario parameters. scenarioType, sectorName, and severity string fields are required.',
          code: 'INVALID_DRILL_PARAMETERS',
        });
        return;
      }

      const drillId = `DRILL-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;

      res.status(201).json({
        drillId,
        isSyntheticDrill: true,
        isOfficialWarning: false,
        warningNotice: 'SYNTHETIC OPERATIONAL DRILL ONLY. THIS IS NOT AN OFFICIAL GOVERNMENT WARNING.',
        status: 'INITIATED',
        scenario: {
          scenarioType: scenarioType.trim().toUpperCase(),
          sectorName: sectorName.trim(),
          severity: severity.trim().toUpperCase(),
        },
        triggeredBy: {
          userId: req.user!.sub,
          role: req.user!.role,
        },
        timestamp: new Date().toISOString(),
      });
    }
  );

  return router;
}

export const commandRouter = createCommandRouter();
