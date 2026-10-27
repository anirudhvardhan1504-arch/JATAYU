import { Router, Request, Response } from 'express';
import { AlertService } from '../services/alert.service.js';
import { replayService } from '../services/replay.service.js';

export const alertRouter = Router();
const alertService = new AlertService();

function parseCoordinates(req: Request): { lat: number; lon: number; name: string } {
  const latStr = req.query.lat as string;
  const lonStr = req.query.lon as string;
  const name = (req.query.name as string) || 'Operational Sector';

  const lat = latStr ? parseFloat(latStr) : 19.076;
  const lon = lonStr ? parseFloat(lonStr) : 72.8777;

  if (isNaN(lat) || isNaN(lon)) {
    throw { statusCode: 400, message: 'Latitude and longitude must be valid numeric values.' };
  }

  if (lat < -90 || lat > 90) {
    throw { statusCode: 400, message: `Latitude ${lat} is out of valid range [-90, 90].` };
  }

  if (lon < -180 || lon > 180) {
    throw { statusCode: 400, message: `Longitude ${lon} is out of valid range [-180, 180].` };
  }

  return { lat, lon, name };
}

alertRouter.get('/', async (req: Request, res: Response) => {
  const attemptedAt = new Date().toISOString();
  try {
    if (replayService.isReplayRequested(req)) {
      const scenarioId = replayService.resolveScenarioId(req);
      const replayAlerts = replayService.getAlerts(scenarioId);
      if (replayAlerts) {
        res.status(200).json(replayAlerts);
        return;
      }
    }

    const { lat, lon, name } = parseCoordinates(req);
    const feedResponse = await alertService.getAlerts(lat, lon, name);
    res.status(200).json(feedResponse);
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('upstream') || err.message?.includes('Network') ? 502 : 500);
    const code = statusCode === 400 ? 'INVALID_COORDINATES' : 'UPSTREAM_ERROR';

    res.status(statusCode).json({
      error: err.message || 'Failed to fetch disaster alerts.',
      code,
      attemptedAt,
      location: {
        lat: req.query.lat,
        lon: req.query.lon,
        name: req.query.name,
      },
    });
  }
});
