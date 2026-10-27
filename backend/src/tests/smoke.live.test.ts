import { describe, it, expect } from 'vitest';
import { AlertService } from '../services/alert.service.js';
import { WeatherService } from '../services/weather.service.js';

const isLiveSmokeEnabled = process.env.RUN_LIVE_SMOKE === 'true';

describe('Live Upstream Smoke Tests (Optional / Separate from Deterministic CI)', () => {
  it.skipIf(!isLiveSmokeEnabled)(
    'LIVE SMOKE: inspects real IMD Nowcast RSS upstream feed when RUN_LIVE_SMOKE=true',
    async () => {
      const alertService = new AlertService();
      const raw = await alertService.fetchRawIMDAlerts();

      expect(['LIVE_VERIFIED', 'CACHED', 'UPSTREAM_FALLBACK']).toContain(raw.status);
      expect(raw.fetchedAt).toBeDefined();
      expect(Array.isArray(raw.alerts)).toBe(true);

      console.log(`[LIVE SMOKE] Fetched IMD Feed Status: ${raw.status}, Active Count: ${raw.alerts.length}`);
    },
    15000
  );

  it.skipIf(!isLiveSmokeEnabled)(
    'LIVE SMOKE: inspects real Open-Meteo weather upstream when RUN_LIVE_SMOKE=true',
    async () => {
      const weatherService = new WeatherService();
      const current = await weatherService.getCurrentWeather(19.076, 72.8777, 'Mumbai');

      expect(current.temperatureC).toBeDefined();
      expect(typeof current.temperatureC).toBe('number');
      expect(current.sourceAttribution).toContain('Open-Meteo');

      console.log(`[LIVE SMOKE] Open-Meteo Current Temp in Mumbai: ${current.temperatureC}°C`);
    },
    15000
  );
});
