import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('JATAYU Phase 3H: Controlled Demo Replay & Offline Resilience', () => {
  const app = createApp();

  describe('1. Scenario Discovery Endpoint (/api/demo/scenarios)', () => {
    it('lists versioned historical disaster scenarios with metadata', async () => {
      const res = await request(app).get('/api/demo/scenarios');
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThanOrEqual(3);
      expect(Array.isArray(res.body.scenarios)).toBe(true);

      const scenarioIds = res.body.scenarios.map((s: any) => s.scenarioId);
      expect(scenarioIds).toContain('chennai_deluge_2023');
      expect(scenarioIds).toContain('hyderabad_musi_2020');
      expect(scenarioIds).toContain('mumbai_monsoon_2023');
    });

    it('returns full scenario details on /api/demo/scenario/:id', async () => {
      const res = await request(app).get('/api/demo/scenario/chennai_deluge_2023');
      expect(res.status).toBe(200);
      expect(res.body.scenarioId).toBe('chennai_deluge_2023');
      expect(res.body.weather).toBeDefined();
      expect(res.body.risk).toBeDefined();
      expect(res.body.alerts).toBeDefined();
      expect(res.body.facilities).toBeDefined();
    });

    it('returns 404 SCENARIO_NOT_FOUND for unknown scenario', async () => {
      const res = await request(app).get('/api/demo/scenario/unknown_disaster_xyz');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('SCENARIO_NOT_FOUND');
    });
  });

  describe('2. Transparent Separation between Replay and Live Data', () => {
    it('returns DEMO_DATA on /api/weather/current when ?demo=replay query is present', async () => {
      const res = await request(app).get('/api/weather/current?demo=replay');
      expect(res.status).toBe(200);
      expect(res.body.sourceType).toBe('DEMO_DATA');
      expect(res.body.sourceAttribution).toContain('Recorded Demo Replay');
    });

    it('returns DEMO_DATA on /api/weather/current when X-Jatayu-Replay-Mode header is set', async () => {
      const res = await request(app)
        .get('/api/weather/current')
        .set('X-Jatayu-Replay-Mode', 'true');
      expect(res.status).toBe(200);
      expect(res.body.sourceType).toBe('DEMO_DATA');
      expect(res.body.location.name).toContain('Chennai');
    });

    it('returns DEMO_REPLAY on /api/alerts?demo=replay', async () => {
      const res = await request(app).get('/api/alerts?demo=replay');
      expect(res.status).toBe(200);
      expect(res.body.feedStatus).toBe('DEMO_REPLAY');
      expect(res.body.alerts.length).toBeGreaterThanOrEqual(1);
      expect(res.body.alerts[0].sourceType).toBe('DEMO_DATA');
    });

    it('returns DEMO_DATA on /api/risk/assessment?demo=replay', async () => {
      const res = await request(app).get('/api/risk/assessment?demo=replay');
      expect(res.status).toBe(200);
      expect(res.body.sourceType).toBe('DEMO_DATA');
      expect(res.body.overallRiskLevel).toBe('CRITICAL');
      expect(res.body.riskScore).toBe(88);
    });
  });

  describe('3. Shelter Availability Integrity Mandate', () => {
    it('enforces that ALL emergency facilities strictly report UNKNOWN availability with call verification mandate', async () => {
      const res = await request(app).get('/api/route/facilities?demo=replay');
      expect(res.status).toBe(200);
      expect(res.body.facilities.length).toBeGreaterThanOrEqual(1);
      expect(res.body.verificationMandate).toContain('Call 112 / 1913');

      for (const facility of res.body.facilities) {
        expect(facility.currentAvailability).toBe('UNKNOWN');
        expect(facility.currentAvailability).not.toBe('AVAILABLE');
        expect(facility.currentAvailability).not.toBe('OCCUPIED');
      }
    });
  });

  describe('4. Multi-Scenario Replay Switching', () => {
    it('switches to Hyderabad Musi cloudburst scenario when specified via header', async () => {
      const res = await request(app)
        .get('/api/weather/forecast')
        .set('X-Jatayu-Replay-Mode', 'true')
        .set('X-Jatayu-Replay-Scenario', 'hyderabad_musi_2020');

      expect(res.status).toBe(200);
      expect(res.body.location.name).toContain('Hyderabad');
      expect(res.body.accumulations.past24hRainfallMm).toBe(192.0);
    });

    it('switches to Mumbai monsoon surge scenario when specified via query', async () => {
      const res = await request(app).get('/api/risk/assessment?demo=replay&scenario=mumbai_monsoon_2023');
      expect(res.status).toBe(200);
      expect(res.body.location.name).toContain('Mumbai');
      expect(res.body.metrics.past24hRainfallMm).toBe(215.0);
      expect(res.body.overallRiskLevel).toBe('CRITICAL');
    });
  });
});
