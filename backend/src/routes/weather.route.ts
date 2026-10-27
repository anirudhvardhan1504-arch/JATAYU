import { Router, Request, Response } from 'express';
import { WeatherService } from '../services/weather.service.js';
import { replayService } from '../services/replay.service.js';

export const weatherRouter = Router();
const weatherService = new WeatherService();

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

weatherRouter.get('/current', async (req: Request, res: Response) => {
  const attemptedAt = new Date().toISOString();
  try {
    if (replayService.isReplayRequested(req)) {
      const scenarioId = replayService.resolveScenarioId(req);
      const observation = replayService.getWeather(scenarioId);
      if (observation) {
        res.status(200).json(observation);
        return;
      }
    }

    const { lat, lon, name } = parseCoordinates(req);
    const observation = await weatherService.getCurrentWeather(lat, lon, name);
    res.status(200).json(observation);
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('upstream') ? 502 : 500);
    const code = statusCode === 400 ? 'INVALID_COORDINATES' : 'UPSTREAM_ERROR';

    res.status(statusCode).json({
      error: err.message || 'Failed to fetch current weather telemetry.',
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

weatherRouter.get('/forecast', async (req: Request, res: Response) => {
  const attemptedAt = new Date().toISOString();
  try {
    if (replayService.isReplayRequested(req)) {
      const scenarioId = replayService.resolveScenarioId(req);
      const forecast = replayService.getForecast(scenarioId);
      if (forecast) {
        res.status(200).json(forecast);
        return;
      }
    }

    const { lat, lon, name } = parseCoordinates(req);
    const forecast = await weatherService.getForecast(lat, lon, name);
    res.status(200).json(forecast);
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('upstream') ? 502 : 500);
    const code = statusCode === 400 ? 'INVALID_COORDINATES' : 'UPSTREAM_ERROR';

    res.status(statusCode).json({
      error: err.message || 'Failed to fetch forecast telemetry.',
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

weatherRouter.get('/historical', async (req: Request, res: Response) => {
  const attemptedAt = new Date().toISOString();
  try {
    const { lat, lon, name } = parseCoordinates(req);
    const startDate = (req.query.startDate as string) || '2015-11-28';
    const endDate = (req.query.endDate as string) || '2015-12-04';

    // Validate YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      res.status(400).json({
        error: 'startDate and endDate must be in ISO format YYYY-MM-DD',
        code: 'INVALID_DATE_FORMAT',
      });
      return;
    }

    const historical = await weatherService.getHistoricalWeather(lat, lon, startDate, endDate, name);
    res.status(200).json(historical);
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('upstream') ? 502 : 500);
    const code = statusCode === 400 ? 'INVALID_REQUEST' : 'HISTORICAL_FETCH_ERROR';

    res.status(statusCode).json({
      error: err.message || 'Failed to fetch historical weather series.',
      code,
      attemptedAt,
      location: {
        lat: req.query.lat,
        lon: req.query.lon,
      },
    });
  }
});
