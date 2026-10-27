import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { app, createApp } from '../app.js';
import { parseAllowedOrigins, config } from '../config.js';
import { createHealthRouter } from '../routes/health.route.js';
import { createShutdownHandler } from '../shutdown.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Stage 4.2 Backend Production Hardening & Health Telemetry', () => {
  describe('Task A: Configurable CORS Origin Policy', () => {
    it('allows browser requests matching configured allowed origin', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('rejects unexpected browser origins with HTTP 403 CORS_FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://malicious-attacker-domain.xyz');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CORS_FORBIDDEN');
      expect(res.body.error).toContain('CORS policy violation');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('permits requests without an Origin header (e.g. curl, uptime probes, server-to-server)', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('responds correctly to preflight OPTIONS requests from allowed origin', async () => {
      const res = await request(app)
        .options('/api/command/sectors')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Authorization, Content-Type');

      expect(res.status === 200 || res.status === 204).toBe(true);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-methods']).toContain('GET');
      expect(res.headers['access-control-allow-headers']).toContain('Authorization');
    });

    it('fails safely when production CORS configuration contains wildcards or is missing', () => {
      expect(() => parseAllowedOrigins('', 'production')).toThrow(
        /Production security requirement: CORS_ORIGIN/
      );
      expect(() => parseAllowedOrigins('*', 'production')).toThrow(
        /Wildcard \(\*\) or empty CORS_ORIGIN is prohibited in production/
      );
      expect(() => parseAllowedOrigins('https://valid.com, *', 'production')).toThrow(
        /Wildcard \(\*\) or empty CORS_ORIGIN is prohibited in production/
      );

      const valid = parseAllowedOrigins('https://jatayu.defense.gov.in, https://console.jatayu.defense.gov.in', 'production');
      expect(valid).toEqual(['https://jatayu.defense.gov.in', 'https://console.jatayu.defense.gov.in']);
    });
  });

  describe('Task B: Centralized Express Error Handling', () => {
    it('handles malformed JSON request bodies returning HTTP 400 INVALID_JSON', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid-json-body": ');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_JSON');
      expect(res.body.error).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
    });

    it('catches unhandled exceptions in routes and returns structured JSON', async () => {
      const testApp = express();
      testApp.get('/throw-test', () => {
        throw new Error('Database unexpected failure');
      });
      testApp.use(errorHandler);

      const res = await request(testApp).get('/throw-test');
      expect(res.status).toBe(500);
      expect(res.body.code).toBe('INTERNAL_ERROR');
      expect(res.body.timestamp).toBeDefined();
      // Verify no stack trace in response
      expect(res.body.stack).toBeUndefined();
    });

    it('does not leak internal exception details or stack traces when NODE_ENV is production', async () => {
      const originalEnv = config.nodeEnv;
      config.nodeEnv = 'production';

      const testApp = express();
      testApp.get('/production-error', () => {
        const err: any = new Error('Sensitive SQL statement: SELECT * FROM secret_passwords');
        throw err;
      });
      testApp.use(errorHandler);

      const res = await request(testApp).get('/production-error');
      config.nodeEnv = originalEnv;

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('An internal server error occurred. Please contact system support.');
      expect(res.body.error).not.toContain('secret_passwords');
      expect(res.body.stack).toBeUndefined();
    });
  });

  describe('Task C: Graceful Shutdown Implementation', () => {
    it('gracefully drains HTTP server and closes database connection', async () => {
      const mockCloseServer = vi.fn((cb) => cb(null));
      const mockServer: any = { close: mockCloseServer };
      const mockUserStore: any = { close: vi.fn() };
      const mockOnExit = vi.fn();

      const shutdown = createShutdownHandler(mockServer, {
        timeoutMs: 1000,
        exitProcess: true,
        onExit: mockOnExit,
        userStore: mockUserStore,
      });

      await shutdown('SIGTERM');

      expect(mockCloseServer).toHaveBeenCalledTimes(1);
      expect(mockUserStore.close).toHaveBeenCalledTimes(1);
      expect(mockOnExit).toHaveBeenCalledWith(0);
    });

    it('is idempotent: ignores duplicate signals arriving during an active shutdown', async () => {
      const mockCloseServer = vi.fn((cb) => cb(null));
      const mockServer: any = { close: mockCloseServer };
      const mockUserStore: any = { close: vi.fn() };
      const mockOnExit = vi.fn();

      const shutdown = createShutdownHandler(mockServer, {
        timeoutMs: 1000,
        exitProcess: true,
        onExit: mockOnExit,
        userStore: mockUserStore,
      });

      // Send SIGINT immediately after SIGTERM
      const p1 = shutdown('SIGTERM');
      const p2 = shutdown('SIGINT');

      await Promise.all([p1, p2]);

      expect(mockCloseServer).toHaveBeenCalledTimes(1);
      expect(mockUserStore.close).toHaveBeenCalledTimes(1);
      expect(mockOnExit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Task D: SQLite-Aware Health Check', () => {
    it('returns 200 OK with services.database ready when database responds', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.services.database).toBeDefined();
      expect(res.body.services.database.provider).toBe('SQLite (node:sqlite)');
      expect(res.body.services.database.status).toBe('ready');
      expect(res.body.services.weather.status).toBe('ready');

      // Verify no database paths or SQL statements are exposed
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('.db');
      expect(bodyStr).not.toContain('SELECT');
      expect(bodyStr).not.toContain('password');
    });

    it('returns 503 Service Unavailable with status degraded when database read fails', async () => {
      const mockBrokenStore: any = {
        db: {
          prepare: vi.fn(() => {
            throw new Error('SQLite database disk I/O error');
          }),
        },
      };

      const brokenHealthRouter = createHealthRouter({ userStore: mockBrokenStore });
      const testApp = express();
      testApp.use('/api/health', brokenHealthRouter);

      const res = await request(testApp).get('/api/health');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('degraded');
      expect(res.body.services.database.status).toBe('unavailable');
      expect(res.body.services.database.provider).toBe('SQLite (node:sqlite)');

      // Verify no error details or stack traces are leaked in response
      expect(JSON.stringify(res.body)).not.toContain('disk I/O error');
    });
  });
});
