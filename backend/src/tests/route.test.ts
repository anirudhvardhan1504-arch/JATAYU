import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { routeService, haversineDistanceMeters } from '../services/route.service.js';

describe('JATAYU SafeRoute API & Hazard Evaluation Service', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Haversine Distance Calculations', () => {
    it('calculates accurate distance between coordinates', () => {
      // Saidapet (80.2227, 13.0204) to Chennai Central (80.2755, 13.0827) ~ 9.0 km
      const dist = haversineDistanceMeters([80.2227, 13.0204], [80.2755, 13.0827]);
      expect(dist).toBeGreaterThan(8500);
      expect(dist).toBeLessThan(10000);
    });

    it('returns 0 for identical coordinates', () => {
      const dist = haversineDistanceMeters([80.2227, 13.0204], [80.2227, 13.0204]);
      expect(dist).toBe(0);
    });
  });

  describe('2. Emergency Facilities Endpoint (/api/route/facilities)', () => {
    it('returns verified emergency facilities with correct attribution and disclaimer', async () => {
      const res = await request(app).get('/api/route/facilities');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('facilities');
      expect(Array.isArray(res.body.facilities)).toBe(true);
      expect(res.body.count).toBeGreaterThan(0);
      expect(res.body.sourceAttribution).toContain('Greater Chennai Corporation');
      expect(res.body.disclaimer).toContain('UNKNOWN');

      const first = res.body.facilities[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('category');
      expect(first).toHaveProperty('location');
      expect(first).toHaveProperty('verificationStatus', 'OFFICIALLY_VERIFIED');
      expect(first).toHaveProperty('currentAvailability', 'UNKNOWN');
    });

    it('filters facilities by category (SHELTER)', async () => {
      const res = await request(app).get('/api/route/facilities?category=SHELTER');
      expect(res.status).toBe(200);
      expect(res.body.facilities.length).toBeGreaterThan(0);
      for (const f of res.body.facilities) {
        expect(f.category).toBe('SHELTER');
      }
    });

    it('calculates distance and sorts when lat and lon are provided', async () => {
      // Near Saidapet
      const res = await request(app).get('/api/route/facilities?lat=13.0204&lon=80.2227');
      expect(res.status).toBe(200);
      const facilities = res.body.facilities;
      expect(facilities.length).toBeGreaterThan(1);
      expect(facilities[0].distanceKm).toBeDefined();
      expect(facilities[0].distanceKm).toBeLessThan(facilities[facilities.length - 1].distanceKm);
    });

    it('enforces UNKNOWN availability and includes sourceProvenance for nationwide queries', async () => {
      const res = await request(app).get('/api/route/facilities?lat=28.6139&lon=77.2090&radius=10000');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.facilities)).toBe(true);
      expect(res.body.facilities.length).toBeGreaterThan(0);
      for (const fac of res.body.facilities) {
        expect(fac.currentAvailability).toBe('UNKNOWN');
        expect(['CURATED_SOURCE', 'COMMUNITY_MAPPED', 'OFFICIAL_SOURCE', 'UNVERIFIED']).toContain(
          fac.sourceProvenance || 'CURATED_SOURCE'
        );
      }
      expect(res.body.disclaimer).toContain('UNKNOWN');
    });
  });

  describe('3. Geocoding Endpoint (/api/route/geocode)', () => {
    it('rejects missing query with 400 MISSING_QUERY', async () => {
      const res = await request(app).get('/api/route/geocode');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_QUERY');
    });

    it('resolves direct coordinate input without external network call', async () => {
      const res = await request(app).get('/api/route/geocode?q=13.0827,80.2707');
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(1);
      expect(res.body.results[0].latitude).toBeCloseTo(13.0827, 4);
      expect(res.body.results[0].longitude).toBeCloseTo(80.2707, 4);
    });

    it('resolves well-known municipal landmarks offline', async () => {
      const res = await request(app).get('/api/route/geocode?q=saidapet');
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBeGreaterThan(0);
      expect(res.body.results[0].displayName).toContain('Saidapet');
      expect(res.body.results[0].latitude).toBeCloseTo(13.021, 2);
    });

    it('supports universal India-wide search without premature substring hijacking', async () => {
      const res = await request(app).get('/api/route/geocode?q=Connaught+Place');
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBeGreaterThan(0);
      expect(
        res.body.results.some(
          (r: any) =>
            r.displayName.toLowerCase().includes('connaught') ||
            r.displayName.toLowerCase().includes('delhi')
        )
      ).toBe(true);
    });
  });

  describe('4. SafeRoute Planning & Hazard Evaluation (/api/route/plan)', () => {
    it('rejects missing origin or destination with 400 MISSING_ROUTE_POINTS', async () => {
      const res = await request(app).post('/api/route/plan').send({
        origin: { latitude: 13.0827, longitude: 80.2755 },
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_ROUTE_POINTS');
    });

    it('rejects identical origin and destination with 400 IDENTICAL_POINTS', async () => {
      const res = await request(app)
        .post('/api/route/plan')
        .send({
          origin: { latitude: 13.0827, longitude: 80.2755 },
          destination: { latitude: 13.0827, longitude: 80.2755 },
        });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('IDENTICAL_POINTS');
    });

    it('rejects invalid travel mode with 400 INVALID_TRAVEL_MODE', async () => {
      const res = await request(app)
        .post('/api/route/plan')
        .send({
          origin: { latitude: 13.0827, longitude: 80.2755 },
          destination: { latitude: 13.021, longitude: 80.223 },
          travelMode: 'flying',
        });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TRAVEL_MODE');
    });

    it('returns typed RoutePlanResponse with evaluated hazards when OSRM returns routes', async () => {
      // Mock global fetch for OSRM route response
      const mockOsrmResponse = {
        code: 'Ok',
        routes: [
          {
            geometry: {
              type: 'LineString',
              coordinates: [
                [80.2755, 13.0827],
                [80.25, 13.05],
                [80.2227, 13.0204], // Passes directly through Saidapet Bridge Bottleneck!
                [80.210, 13.005],
              ],
            },
            distance: 9200,
            duration: 1250,
            legs: [{ summary: 'via Anna Salai' }],
          },
          {
            geometry: {
              type: 'LineString',
              coordinates: [
                [80.2755, 13.0827],
                [80.24, 13.07],
                [80.19, 13.04],
                [80.210, 13.005], // Bypasses Saidapet bridge via west corridor (>1.5km away)
              ],
            },
            distance: 10400,
            duration: 1450,
            legs: [{ summary: 'via Inner Ring Road' }],
          },
        ],
      };

      vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
        if (typeof url === 'string' && url.includes('/route/v1/')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockOsrmResponse,
          } as any;
        }
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as any;
      });

      const res = await request(app)
        .post('/api/route/plan')
        .send({
          origin: { latitude: 13.0827, longitude: 80.2755, name: 'Chennai Central' },
          destination: { latitude: 13.005, longitude: 80.210, name: 'Guindy / Alandur' },
          travelMode: 'driving',
        });

      expect(res.status).toBe(200);
      const plan = res.body;

      expect(plan).toHaveProperty('origin');
      expect(plan).toHaveProperty('destination');
      expect(plan.travelMode).toBe('driving');
      expect(plan.routes.length).toBe(2);

      // Primary Route should detect Saidapet Bridge Bottleneck
      const primary = plan.routes[0];
      expect(primary.isPrimary).toBe(true);
      expect(primary.distanceKm).toBe(9.2);
      expect(primary.durationMinutes).toBe(21);
      expect(primary.hazards.length).toBeGreaterThan(0);
      const saidapetHazard = primary.hazards.find((h: any) =>
        h.title.includes('Saidapet Maraimalai Adigal Bridge')
      );
      expect(saidapetHazard).toBeDefined();
      expect(saidapetHazard.severity).toBe('HIGH');
      expect(saidapetHazard.sourceProvenance).toBe('HISTORICAL_VULNERABILITY');

      // Alternative Route 1
      const alt = plan.routes[1];
      expect(alt.isPrimary).toBe(false);
      expect(alt.additionalDistanceKm).toBe(1.2);
      expect(alt.additionalDurationMinutes).toBe(3);
      expect(alt.hazardsAvoidedAgainstPrimary).toBeDefined();
      expect(alt.hazardsAvoidedAgainstPrimary?.length).toBeGreaterThan(0);

      // Plan metadata
      expect(plan.disclaimer).toContain('advisory assessments');
      expect(plan.knownLimitations.length).toBeGreaterThan(0);
      expect(plan.dataFreshness).toBeDefined();
    });

    it('returns 503 ROUTING_SERVICE_UNAVAILABLE when OSRM provider fails or is unreachable', async () => {
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        throw new Error('Connection refused to routing daemon');
      });

      const res = await request(app)
        .post('/api/route/plan')
        .send({
          origin: { latitude: 13.0827, longitude: 80.2755 },
          destination: { latitude: 13.021, longitude: 80.223 },
        });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('ROUTING_SERVICE_UNAVAILABLE');
      expect(res.body.error).toContain('Routing provider unreachable');
    });

    it('returns 404 NO_ROUTE_FOUND when OSRM returns zero traversable road routes (e.g. oceanic points)', async () => {
      const mockEmptyOsrm = {
        code: 'Ok',
        routes: [
          {
            geometry: {
              type: 'LineString',
              coordinates: [],
            },
            distance: 0,
            duration: 0,
            legs: [],
          },
        ],
      };

      vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
        if (typeof url === 'string' && url.includes('/route/v1/')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockEmptyOsrm,
          } as any;
        }
        return { ok: false, status: 404, json: async () => ({}) } as any;
      });

      const res = await request(app)
        .post('/api/route/plan')
        .send({
          origin: { latitude: 10.0, longitude: 70.0 }, // Arabian sea
          destination: { latitude: 10.1, longitude: 70.1 },
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NO_ROUTE_FOUND');
    });
  });

  describe('5. India-Wide Reverse Geocoding Endpoint (/api/route/reverse-geocode)', () => {
    it('rejects invalid or missing coordinates with 400 INVALID_COORDINATES', async () => {
      const res = await request(app).get('/api/route/reverse-geocode?lat=95&lon=80');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_COORDINATES');
    });

    it('returns structured location details for valid Indian coordinates', async () => {
      const res = await request(app).get('/api/route/reverse-geocode?lat=28.6139&lon=77.2090');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('displayName');
      expect(res.body).toHaveProperty('latitude', 28.6139);
      expect(res.body).toHaveProperty('longitude', 77.209);
    });
  });

  describe('6. India-Wide Municipal Landmark Resolution', () => {
    it('resolves key national metropolitan presets across India offline', async () => {
      const cities = ['mumbai', 'delhi', 'bengaluru', 'kolkata', 'hyderabad'];
      for (const city of cities) {
        const res = await request(app).get(`/api/route/geocode?q=${city}`);
        expect(res.status).toBe(200);
        expect(res.body.results.length).toBeGreaterThan(0);
        expect(res.body.results[0].latitude).toBeGreaterThan(8);
        expect(res.body.results[0].latitude).toBeLessThan(37);
        expect(res.body.results[0].longitude).toBeGreaterThan(68);
        expect(res.body.results[0].longitude).toBeLessThan(98);
      }
    });
  });
});
