import dns from 'node:dns';

// Ensure IPv4 is prioritized for external providers in bridge networks
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignored in runtimes where not supported
}

import express, { Express } from 'express';
import cors from 'cors';
import { config, AppConfig } from './config.js';
import { healthRouter } from './routes/health.route.js';
import { weatherRouter } from './routes/weather.route.js';
import { riskRouter } from './routes/risk.route.js';
import { aiRouter } from './routes/ai.route.js';
import { alertRouter } from './routes/alert.route.js';
import { authRouter } from './routes/auth.route.js';
import { commandRouter } from './routes/command.route.js';
import { researchRouter } from './routes/research.route.js';
import { routeRouter } from './routes/route.route.js';
import { demoRouter } from './routes/demo.route.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalApiLimiter, authApiLimiter, heavyComputeLimiter } from './middleware/rateLimiter.js';

export function createApp(appConfig: AppConfig = config): Express {
  const app = express();

  // Standard Security Headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Configure CORS origin policy
  const allowedOrigins = appConfig.cors.allowedOrigins;

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. non-browser tools, curl, health probes, server-to-server)
        if (!origin) {
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        const msg = `CORS policy violation: Origin '${origin}' is not allowed by Access-Control-Allow-Origin.`;
        return callback(new Error(msg), false);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: false,
    })
  );

  app.use(express.json({ limit: '100kb' }));

  // Rate Limiting
  app.use('/api', generalApiLimiter);
  app.use('/api/auth/login', authApiLimiter);
  app.use('/api/ai/chat', heavyComputeLimiter);

  // API Routes
  app.use('/api/health', healthRouter);
  app.use('/api/weather', weatherRouter);
  app.use('/api/risk', riskRouter);
  app.use('/api/alerts', alertRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/command', commandRouter);
  app.use('/api/research', researchRouter);
  app.use('/api/route', routeRouter);
  app.use('/api/demo', demoRouter);

  // 404 handler for unrecognized endpoints
  app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
  });

  // Centralized Error Handling Middleware (must be registered last with 4 arguments)
  app.use(errorHandler);

  return app;
}

export const app = createApp();
