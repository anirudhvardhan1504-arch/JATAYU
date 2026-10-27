import { Router, Request, Response } from 'express';
import { routeService, RoutingServiceError } from '../services/route.service.js';
import { replayService } from '../services/replay.service.js';
import { TravelMode } from '../types/route.types.js';

export const routeRouter = Router();

// 1. GET /api/route/facilities - Retrieve verified emergency facilities or discover nearby facilities
routeRouter.get('/facilities', async (req: Request, res: Response) => {
  const latStr = req.query.lat as string | undefined;
  const lonStr = req.query.lon as string | undefined;
  const category = req.query.category as string | undefined;
  const radiusStr = req.query.radius as string | undefined;

  const lat = latStr !== undefined ? parseFloat(latStr) : undefined;
  const lon = lonStr !== undefined ? parseFloat(lonStr) : undefined;
  const radius = radiusStr !== undefined ? parseFloat(radiusStr) : 5000;

  if (latStr !== undefined && (isNaN(lat!) || lat! < -90 || lat! > 90)) {
    res.status(400).json({
      error: 'Latitude must be a valid numeric value between -90 and 90.',
      code: 'INVALID_COORDINATES',
    });
    return;
  }

  if (lonStr !== undefined && (isNaN(lon!) || lon! < -180 || lon! > 180)) {
    res.status(400).json({
      error: 'Longitude must be a valid numeric value between -180 and 180.',
      code: 'INVALID_COORDINATES',
    });
    return;
  }

  if (radiusStr !== undefined && (isNaN(radius) || radius <= 0 || radius > 100000)) {
    res.status(400).json({
      error: 'Radius must be a positive numeric value between 1 and 100000 meters.',
      code: 'INVALID_RADIUS',
    });
    return;
  }

  if (replayService.isReplayRequested(req)) {
    const scenarioId = replayService.resolveScenarioId(req, lat, lon);
    const facilities = replayService.getFacilities(scenarioId);
    res.status(200).json({
      facilities,
      count: facilities.length,
      sourceProvenance: 'PRE_VERIFIED_OFFICIAL_REGISTRY',
      verificationMandate: 'Call 112 / 1913 before dispatch. Real-time vacancy is UNKNOWN.',
    });
    return;
  }

  try {
    const response = await routeService.discoverNearbyFacilities(lat, lon, radius, category);
    res.status(200).json(response);
  } catch (err: any) {
    res.status(500).json({
      error: err.message || 'Failed to retrieve facilities',
      code: 'FACILITIES_RETRIEVAL_ERROR',
    });
  }
});

// 2. GET /api/route/geocode - Geocode place name, landmark, or coordinates
routeRouter.get('/geocode', async (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  if (!q || typeof q !== 'string' || !q.trim()) {
    res.status(400).json({ error: 'Query parameter "q" is required.', code: 'MISSING_QUERY' });
    return;
  }

  if (q.length > 250) {
    res.status(400).json({ error: 'Query parameter "q" exceeds maximum length of 250 characters.', code: 'QUERY_TOO_LONG' });
    return;
  }

  try {
    const results = await routeService.geocodeAddress(q);
    res.status(200).json({
      query: q,
      results,
      count: results.length,
    });
  } catch (err: any) {
    res.status(500).json({
      error: err.message || 'Geocoding failed',
      code: 'GEOCODING_ERROR',
    });
  }
});

// 2b. GET /api/route/reverse-geocode - Reverse geocode latitude/longitude to place name
routeRouter.get('/reverse-geocode', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    res.status(400).json({
      error: 'Valid "lat" and "lon" query parameters are required.',
      code: 'INVALID_COORDINATES',
    });
    return;
  }

  try {
    const displayName = await routeService.reverseGeocode(lat, lon);
    res.status(200).json({
      latitude: lat,
      longitude: lon,
      displayName,
    });
  } catch (err: any) {
    res.status(500).json({
      error: err.message || 'Reverse geocoding failed',
      code: 'REVERSE_GEOCODING_ERROR',
    });
  }
});

// 3. POST /api/route/plan - Calculate route options with transparent hazard assessment
routeRouter.post('/plan', async (req: Request, res: Response) => {
  try {
    const { origin, destination, travelMode = 'driving' } = req.body || {};

    if (!origin || !destination) {
      res.status(400).json({
        error: 'Both origin and destination coordinates are required.',
        code: 'MISSING_ROUTE_POINTS',
      });
      return;
    }

    const validModes: TravelMode[] = ['driving', 'walking', 'cycling'];
    if (!validModes.includes(travelMode)) {
      res.status(400).json({
        error: `Invalid travelMode "${travelMode}". Allowed modes: ${validModes.join(', ')}`,
        code: 'INVALID_TRAVEL_MODE',
      });
      return;
    }

    const plan = await routeService.planSafeRoute({
      origin,
      destination,
      travelMode,
    });

    res.status(200).json(plan);
  } catch (err: any) {
    if (err instanceof RoutingServiceError) {
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
      });
      return;
    }

    res.status(500).json({
      error: err.message || 'Internal route planning failure',
      code: 'ROUTE_PLANNING_FAILED',
    });
  }
});
