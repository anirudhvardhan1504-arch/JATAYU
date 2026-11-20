import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import { RouteService, facilityMatchesCategory } from '../services/route.service.js';
import { EmergencyFacility } from '../types/route.types.js';

const facilities: EmergencyFacility[] = JSON.parse(fs.readFileSync(new URL('../data/geo/verified_facilities.json', import.meta.url), 'utf8'));
const local = facilities.filter((f) => f.id.startsWith('fac_hyd_'));

afterEach(() => vi.restoreAllMocks());

describe('Hyderabad directory integrity', () => {
  it('ships sourced medical entries without claiming operational verification or availability', () => {
    expect(local.length).toBeGreaterThanOrEqual(9);
    expect(new Set(facilities.map((f) => f.id)).size).toBe(facilities.length);
    for (const f of local) {
      expect(f.sourceUrl).toMatch(/^https:\/\//);
      expect(f.coordinateSourceUrl).toMatch(/^https:\/\//);
      expect(f.sourceReviewedAt).toBe('2026-11-20');
      expect(f.verificationStatus).toBe('GENERAL_DIRECTORY');
      expect(f.currentAvailability).toBe('UNKNOWN');
      expect(f.location.latitude).toBeGreaterThan(17.2);
      expect(f.location.latitude).toBeLessThan(17.6);
      expect(f.location.longitude).toBeGreaterThan(78.2);
      expect(f.location.longitude).toBeLessThan(78.7);
    }
  });

  it('filters documented trauma and ambulance capabilities without relabeling hospitals', () => {
    const apollo = local.find((f) => f.id === 'fac_hyd_apollo_hyderguda')!;
    const osmania = local.find((f) => f.id === 'fac_hyd_osmania')!;
    expect(facilityMatchesCategory(apollo, 'TRAUMA_CENTRE')).toBe(true);
    expect(facilityMatchesCategory(apollo, 'AMBULANCE_SERVICE')).toBe(true);
    expect(facilityMatchesCategory(osmania, 'TRAUMA_CENTRE')).toBe(false);
    expect(apollo.category).toBe('HOSPITAL');
  });

  it('preserves distinct nearby facilities and each record’s verification status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ elements: [
      { type: 'node', id: 771, lat: 17.373, lon: 78.4735, tags: { amenity: 'hospital', name: 'Separate Clinic' } },
    ] })));
    const result = await new RouteService().discoverNearbyFacilities(17.37289, 78.47351, 1000, 'HOSPITAL');
    expect(result.facilities.some((f) => f.name === 'Separate Clinic')).toBe(true);
    expect(result.facilities.find((f) => f.id === 'fac_hyd_osmania')?.verificationStatus).toBe('GENERAL_DIRECTORY');
  });

  it('flags out-of-radius fallbacks and keeps their directory status when discovery fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline'));
    const result = await new RouteService().discoverNearbyFacilities(17.8, 78.8, 1000, 'HOSPITAL');
    expect(result.facilities.length).toBeGreaterThan(0);
    expect(result.facilities.every((f) => f.outsideSearchRadius && f.currentAvailability === 'UNKNOWN')).toBe(true);
  });
});
