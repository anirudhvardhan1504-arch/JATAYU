import { Router, Request, Response } from 'express';
import { OpenRouterService } from '../services/openrouter.service.js';
import { UserStore } from '../auth/userStore.js';
import { getSharedUserStore } from '../auth/defaultStore.js';

export interface HealthRouterDependencies {
  userStore?: UserStore | { db?: { prepare?: (sql: string) => { get: () => any } } };
  aiService?: { getStatus: () => any };
}

export function createHealthRouter(deps: HealthRouterDependencies = {}): Router {
  const router = Router();
  const aiService = deps.aiService || new OpenRouterService();

  router.get('/', (_req: Request, res: Response) => {
    const aiStatus = aiService.getStatus();
    let dbStatus = 'ready';
    let isDbHealthy = true;

    try {
      const store = deps.userStore || getSharedUserStore();
      if (!store || !store.db || typeof store.db.prepare !== 'function') {
        throw new Error('Database connection unavailable');
      }
      const check = store.db.prepare('SELECT 1 as healthy').get();
      if (!check) {
        throw new Error('Database check query returned no rows');
      }
    } catch {
      dbStatus = 'unavailable';
      isDbHealthy = false;
    }

    const overallStatus = isDbHealthy ? 'ok' : 'degraded';
    const httpStatusCode = isDbHealthy ? 200 : 503;

    res.status(httpStatusCode).json({
      status: overallStatus,
      platform: 'JATAYU Disaster Intelligence Platform',
      version: '0.1.0',
      phase: 'Phase 1 Scaffolding',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      services: {
        database: {
          provider: 'SQLite (node:sqlite)',
          status: dbStatus,
        },
        weather: {
          provider: 'Open-Meteo',
          status: 'ready',
        },
        ai: aiStatus,
      },
    });
  });

  return router;
}

export const healthRouter = createHealthRouter();
