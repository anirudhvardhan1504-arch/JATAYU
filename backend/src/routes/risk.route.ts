import { Router, Request, Response } from 'express';
import { RiskService } from '../services/risk.service.js';
import { replayService } from '../services/replay.service.js';

export const riskRouter = Router();
const riskService = new RiskService();

function parseCoordinates(req: Request): { lat: number; lon: number; name: string } {
  const latStr = req.query.lat as string;
  const lonStr = req.query.lon as string;
  const name = (req.query.name as string) || 'Operational Target';

  if (!latStr || !lonStr) {
    throw { statusCode: 400, message: 'Latitude and longitude parameters are required.' };
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

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

riskRouter.get('/assessment', async (req: Request, res: Response) => {
  const attemptedAt = new Date().toISOString();
  try {
    if (replayService.isReplayRequested(req)) {
      const scenarioId = replayService.resolveScenarioId(req);
      const replayRisk = replayService.getRisk(scenarioId);
      if (replayRisk) {
        res.status(200).json(replayRisk);
        return;
      }
    }

    const { lat, lon, name } = parseCoordinates(req);
    const assessment = await riskService.assessRisk(lat, lon, name);
    res.status(200).json(assessment);
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('upstream') ? 502 : 500);
    const code = statusCode === 400 ? 'INVALID_COORDINATES' : 'UPSTREAM_ERROR';

    res.status(statusCode).json({
      error: err.message || 'Failed to generate indicative flood risk assessment.',
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
