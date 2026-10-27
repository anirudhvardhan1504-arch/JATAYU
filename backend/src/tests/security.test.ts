import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { WeatherService } from '../services/weather.service.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import express from 'express';

describe('JATAYU Phase 3H: Security, Input Validation & External Resilience', () => {
  const app = createApp();

  describe('1. Standard HTTP Security Headers & Boundaries', () => {
    it('sets standard defensive security headers on responses', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('rejects out-of-range coordinates on /api/route/facilities with 400', async () => {
      const res = await request(app).get('/api/route/facilities?lat=105.5&lon=80.2');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_COORDINATES');
    });

    it('rejects invalid longitude on /api/route/facilities with 400', async () => {
      const res = await request(app).get('/api/route/facilities?lat=13.0&lon=-200');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_COORDINATES');
    });

    it('rejects negative or excessive radius on /api/route/facilities with 400', async () => {
      const res = await request(app).get('/api/route/facilities?lat=13.0&lon=80.2&radius=-50');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_RADIUS');
    });

    it('rejects excessively long geocode queries with 400 QUERY_TOO_LONG', async () => {
      const longQuery = 'A'.repeat(260);
      const res = await request(app).get(`/api/route/geocode?q=${longQuery}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('QUERY_TOO_LONG');
    });

    it('rejects out-of-range coordinates on POST /api/route/plan with 400', async () => {
      const res = await request(app)
        .post('/api/route/plan')
        .send({
          origin: { latitude: 95.0, longitude: 80.2 },
          destination: { latitude: 13.0, longitude: 80.2 },
          travelMode: 'driving',
        });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_COORDINATES');
    });
  });

  describe('2. Rate Limiting Middleware', () => {
    it('enforces request thresholds and emits Retry-After header with 429', async () => {
      const testApp = express();
      const testLimiter = createRateLimiter({
        windowMs: 10000,
        maxRequests: 3,
        message: 'Test rate limit exceeded',
        skipInTest: false,
      });

      testApp.use(testLimiter);
      testApp.get('/test', (_req, res) => res.json({ ok: true }));

      // 1st request -> ok
      const r1 = await request(testApp).get('/test');
      expect(r1.status).toBe(200);

      // 2nd request -> ok
      const r2 = await request(testApp).get('/test');
      expect(r2.status).toBe(200);

      // 3rd request -> ok
      const r3 = await request(testApp).get('/test');
      expect(r3.status).toBe(200);

      // 4th request -> blocked 429
      const r4 = await request(testApp).get('/test');
      expect(r4.status).toBe(429);
      expect(r4.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(r4.headers['retry-after']).toBeDefined();
    });
  });

  describe('3. Weather Service In-Memory Caching & Stale Degraded Fallback', () => {
    it('falls back to cached observation with isStale=true when upstream fails', async () => {
      const weatherService = new WeatherService();
      const lat = 13.0827;
      const lon = 80.2707;

      // Mock global fetch with a current observation timestamp in Open-Meteo format (YYYY-MM-DDTHH:mm)
      const currentIsoMinute = new Date().toISOString().slice(0, 16);
      const mockSuccessData = {
        latitude: lat,
        longitude: lon,
        utc_offset_seconds: 0,
        current: {
          time: currentIsoMinute,
          interval: 900,
          temperature_2m: 29.5,
          relative_humidity_2m: 80,
          apparent_temperature: 33.0,
          precipitation: 5.0,
          rain: 5.0,
          showers: 0,
          weather_code: 61,
          surface_pressure: 1008.0,
          wind_speed_10m: 20.0,
          wind_direction_10m: 90,
          wind_gusts_10m: 35.0,
        },
        hourly: {
          soil_moisture_0_to_7cm: [0.35],
          soil_moisture_7_to_28cm: [0.30],
        },
      };

      const originalFetch = global.fetch;

      // 1. Initial successful fetch populates cache
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessData,
      } as any);

      const firstResult = await weatherService.getCurrentWeather(lat, lon, 'Chennai Central');
      expect(firstResult.temperatureC).toBe(29.5);
      expect(firstResult.isStale).toBe(false);

      // 2. Next call within TTL hits cache without hitting upstream
      const secondResult = await weatherService.getCurrentWeather(lat, lon, 'Chennai Central');
      expect(secondResult.temperatureC).toBe(29.5);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // 3. Upstream failure with cache present returns degraded observation with isStale: true
      // Force cache to be older than TTL by adjusting internal timestamp
      (weatherService as any).cacheTtlMs = 0; // immediate expiry

      global.fetch = vi.fn().mockRejectedValueOnce(new Error('ETIMEDOUT connecting to Open-Meteo'));

      const fallbackResult = await weatherService.getCurrentWeather(lat, lon, 'Chennai Central');
      expect(fallbackResult.temperatureC).toBe(29.5);
      expect(fallbackResult.isStale).toBe(true);
      expect(fallbackResult.sourceAttribution).toContain('STALE CACHED');

      global.fetch = originalFetch;
    });
  });
});
