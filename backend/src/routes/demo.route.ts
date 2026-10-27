import { Router, Request, Response } from 'express';
import { replayService } from '../services/replay.service.js';

export const demoRouter = Router();

// GET /api/demo/scenarios - List available pre-recorded historical disaster scenarios
demoRouter.get('/scenarios', (_req: Request, res: Response) => {
  const scenarios = replayService.listScenarios();
  res.status(200).json({
    replayModeGlobal: process.env.DEMO_REPLAY_MODE === 'true',
    count: scenarios.length,
    scenarios,
  });
});

// GET /api/demo/scenario/:id - Retrieve complete scenario package
demoRouter.get('/scenario/:id', (req: Request, res: Response) => {
  const scenario = replayService.getScenario(req.params.id);
  if (!scenario) {
    res.status(404).json({ error: `Scenario "${req.params.id}" not found.`, code: 'SCENARIO_NOT_FOUND' });
    return;
  }
  res.status(200).json(scenario);
});
