import { describe, it, expect } from 'vitest';
import {
  VERIFIED_HISTORICAL_CYCLONES,
  CLASSIFICATION_COLORS,
  CycloneClassification,
} from '../services/cyclone';

describe('JATAYU Phase 4 Cyclone Service Unit Tests', () => {
  it('1. verifies historical archive contains Cyclone Michaung and Cyclone Remal', () => {
    expect(VERIFIED_HISTORICAL_CYCLONES.length).toBeGreaterThanOrEqual(2);

    const michaung = VERIFIED_HISTORICAL_CYCLONES.find((c) => c.id === 'michaung-2023');
    expect(michaung).toBeDefined();
    expect(michaung?.status).toBe('ARCHIVED');
    expect(michaung?.season).toBe(2023);
    expect(michaung?.maxClassification).toBe('SEVERE_CYCLONIC_STORM');
    expect(michaung?.maxWindKmh).toBe(110);
    expect(michaung?.track.length).toBeGreaterThan(0);

    const remal = VERIFIED_HISTORICAL_CYCLONES.find((c) => c.id === 'remal-2024');
    expect(remal).toBeDefined();
    expect(remal?.status).toBe('ARCHIVED');
    expect(remal?.season).toBe(2024);
    expect(remal?.maxWindKmh).toBe(115);
  });

  it('2. verifies chronological order and valid coordinate ranges in cyclone tracks', () => {
    for (const cyclone of VERIFIED_HISTORICAL_CYCLONES) {
      let previousTime = 0;
      for (const pt of cyclone.track) {
        const time = new Date(pt.timestamp).getTime();
        expect(time).toBeGreaterThan(previousTime);
        previousTime = time;

        // Coordinates within North Indian Ocean / Bay of Bengal basin
        expect(pt.lat).toBeGreaterThanOrEqual(0);
        expect(pt.lat).toBeLessThanOrEqual(35);
        expect(pt.lon).toBeGreaterThanOrEqual(60);
        expect(pt.lon).toBeLessThanOrEqual(100);

        // Wind speed invariants
        expect(pt.windKmh).toBeGreaterThan(0);
        expect(pt.gustKmh).toBeGreaterThanOrEqual(pt.windKmh);
        expect(pt.pressureHpa).toBeGreaterThan(900);
        expect(pt.pressureHpa).toBeLessThan(1020);
      }
    }
  });

  it('3. verifies all classifications have mapped colors and hexadecimal codes', () => {
    const classifications: CycloneClassification[] = [
      'LOW_PRESSURE_AREA',
      'DEPRESSION',
      'DEEP_DEPRESSION',
      'CYCLONIC_STORM',
      'SEVERE_CYCLONIC_STORM',
      'VERY_SEVERE_CYCLONIC_STORM',
      'EXTREMELY_SEVERE_CYCLONIC_STORM',
      'SUPER_CYCLONIC_STORM',
    ];

    for (const cls of classifications) {
      const color = CLASSIFICATION_COLORS[cls];
      expect(color).toBeDefined();
      expect(color.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(color.bg).toContain('bg-');
      expect(color.text).toContain('text-');
      expect(color.border).toContain('border-');
    }
  });

  it('4. ensures observed vs forecast tracks partition correctly with cone radii', () => {
    const michaung = VERIFIED_HISTORICAL_CYCLONES.find((c) => c.id === 'michaung-2023')!;
    const observed = michaung.track.filter((t) => t.type === 'OBSERVED');
    const forecast = michaung.track.filter((t) => t.type === 'FORECAST');

    expect(observed.length).toBeGreaterThan(0);
    expect(forecast.length).toBeGreaterThan(0);

    // Forecast points should have coneRadiusKm defined for uncertainty cone visualization
    for (const f of forecast) {
      expect(f.coneRadiusKm).toBeDefined();
      expect(f.coneRadiusKm).toBeGreaterThan(0);
    }
  });
});
