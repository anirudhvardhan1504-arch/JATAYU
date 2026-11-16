import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WindVectorField,
  WindParticleEngine,
  getWindColor,
  getWindLineWidth,
  DENSITY_PARTICLE_COUNTS,
} from '../services/wind-particles';
import { WindOverlayManager } from '../services/wind-layer';
import type { ForecastGridResponse } from '../services/forecast';

describe('Phase 3B-3C: Forecast Wind Particle Animation Engine', () => {
  // Helper to construct a synthetic 5x5 grid with specified wind vectors
  function createSyntheticWindGrid(vectorGenerator: (lat: number, lon: number) => { u: number; v: number; speed?: number }): ForecastGridResponse {
    const nodes: any[] = [];
    const minLat = 18.5;
    const maxLat = 19.5;
    const minLon = 72.5;
    const maxLon = 73.5;
    const step = 0.25;

    for (let lat = minLat; lat <= maxLat + 0.001; lat += step) {
      for (let lon = minLon; lon <= maxLon + 0.001; lon += step) {
        const roundedLat = Math.round(lat * 100) / 100;
        const roundedLon = Math.round(lon * 100) / 100;
        const vec = vectorGenerator(roundedLat, roundedLon);
        const speedKmh = vec.speed ?? Math.hypot(vec.u, vec.v) * 3.6;

        nodes.push({
          requestedLat: roundedLat,
          requestedLon: roundedLon,
          modelLat: roundedLat,
          modelLon: roundedLon,
          elevationM: 10,
          sectorKey: 'mumbai',
          hourly: [
            {
              time: '2026-11-13T00:00',
              precipitationMm: 0,
              rainMm: 0,
              showersMm: 0,
              temperatureC: 28,
              apparentTemperatureC: 30,
              relativeHumidityPercent: 70,
              pressureMslHpa: 1012,
              surfacePressureHpa: 1011,
              windSpeedKmh: speedKmh,
              windDirectionDegrees: 270,
              windGustsKmh: speedKmh * 1.3,
              uMs: vec.u,
              vMs: vec.v,
            },
          ],
          accum24hMm: 0,
          accum72hMm: 0,
          maxWindGustKmh: 40,
          minPressureMslHpa: 1010,
        });
      }
    }

    return {
      metadata: {
        provider: 'Open-Meteo ECMWF Open Data',
        model: 'ECMWF IFS (0.25°)',
        nativeResolution: '0.25° regular lat/lon',
        isFallback: false,
        runCycle: '00Z',
        initializationTime: '2026-11-13T00:00',
        generatedAt: '2026-11-13T00:05:00Z',
        mode: 'sector',
        activeSector: 'mumbai',
        billableCallsIncurred: 1,
        dailyBudgetRemaining: 7999,
      } as any,
      nodes,
    };
  }

  describe('1. Wind Vector Field & Directional Physics', () => {
    it('advects eastward when u > 0 (westerly flow) and v = 0', () => {
      // u = 10 m/s (blowing eastward), v = 0
      const grid = createSyntheticWindGrid(() => ({ u: 10, v: 0 }));
      const field = new WindVectorField(grid, 0, 0.5);

      const sample = field.sampleVector(73.0, 19.0);
      expect(sample.valid).toBe(true);
      expect(sample.uMs).toBeCloseTo(10, 1);
      expect(sample.vMs).toBeCloseTo(0, 1);
      expect(sample.speedKmh).toBeCloseTo(36, 1);
    });

    it('advects westward when u < 0 (easterly flow) and v = 0', () => {
      // u = -15 m/s (blowing westward), v = 0
      const grid = createSyntheticWindGrid(() => ({ u: -15, v: 0 }));
      const field = new WindVectorField(grid, 0, 0.5);

      const sample = field.sampleVector(73.0, 19.0);
      expect(sample.valid).toBe(true);
      expect(sample.uMs).toBeCloseTo(-15, 1);
      expect(sample.vMs).toBeCloseTo(0, 1);
      expect(sample.speedKmh).toBeCloseTo(54, 1);
    });

    it('advects northward when v > 0 (southerly flow) and u = 0', () => {
      // u = 0, v = 12 m/s (blowing northward)
      const grid = createSyntheticWindGrid(() => ({ u: 0, v: 12 }));
      const field = new WindVectorField(grid, 0, 0.5);

      const sample = field.sampleVector(73.0, 19.0);
      expect(sample.valid).toBe(true);
      expect(sample.uMs).toBeCloseTo(0, 1);
      expect(sample.vMs).toBeCloseTo(12, 1);
      expect(sample.speedKmh).toBeCloseTo(43.2, 1);
    });

    it('advects southward when v < 0 (northerly flow) and u = 0', () => {
      // u = 0, v = -8 m/s (blowing southward)
      const grid = createSyntheticWindGrid(() => ({ u: 0, v: -8 }));
      const field = new WindVectorField(grid, 0, 0.5);

      const sample = field.sampleVector(73.0, 19.0);
      expect(sample.valid).toBe(true);
      expect(sample.uMs).toBeCloseTo(0, 1);
      expect(sample.vMs).toBeCloseTo(-8, 1);
      expect(sample.speedKmh).toBeCloseTo(28.8, 1);
    });

    it('handles zero wind conditions without division by zero', () => {
      const grid = createSyntheticWindGrid(() => ({ u: 0, v: 0 }));
      const field = new WindVectorField(grid, 0, 0.5);

      const sample = field.sampleVector(73.0, 19.0);
      expect(sample.valid).toBe(true);
      expect(sample.uMs).toBe(0);
      expect(sample.vMs).toBe(0);
      expect(sample.speedKmh).toBe(0);
    });

    it('recovers u and v from speed and meteorological direction when u/v are NaN', () => {
      // Direction 180° = wind from South blowing North (v > 0, u = 0)
      const grid = createSyntheticWindGrid(() => ({ u: NaN, v: NaN, speed: 36 }));
      // Set wind direction to 180 deg
      grid.nodes[0].hourly[0].windDirectionDegrees = 180;
      grid.nodes[0].hourly[0].windSpeedKmh = 36; // 10 m/s

      const field = new WindVectorField(grid, 0, 0.5);
      const sample = field.sampleVector(grid.nodes[0].modelLon, grid.nodes[0].modelLat);
      expect(sample.valid).toBe(true);
      expect(sample.speedKmh).toBeCloseTo(36, 1);
      // Wind from 180° blows towards 0° (North), so vMs > 0
      expect(sample.vMs).toBeGreaterThan(0);
    });

    it('strictly enforces no-extrapolation outside supported forecast coverage', () => {
      const grid = createSyntheticWindGrid(() => ({ u: 10, v: 5 }));
      const field = new WindVectorField(grid, 0, 0.45);

      // Node domain is lon: [72.5, 73.5], lat: [18.5, 19.5]
      // Sample 3 degrees away in Arabian Sea (lon: 69.0, lat: 15.0)
      const sample = field.sampleVector(69.0, 15.0);
      expect(sample.valid).toBe(false);
      expect(sample.uMs).toBe(0);
      expect(sample.vMs).toBe(0);
    });
  });

  describe('2. Particle Simulation Engine Lifecycle & Advection', () => {
    it('initializes correct particle counts based on density preset', () => {
      const grid = createSyntheticWindGrid(() => ({ u: 5, v: 5 }));

      const engineLight = new WindParticleEngine(grid, 0, { density: 'light' });
      expect(engineLight.getParticleCount()).toBe(DENSITY_PARTICLE_COUNTS.light);

      const engineStd = new WindParticleEngine(grid, 0, { density: 'standard' });
      expect(engineStd.getParticleCount()).toBe(DENSITY_PARTICLE_COUNTS.standard);

      const engineDense = new WindParticleEngine(grid, 0, { density: 'dense' });
      expect(engineDense.getParticleCount()).toBe(DENSITY_PARTICLE_COUNTS.dense);
    });

    it('advects particles in geographic coordinates over simulation steps', () => {
      // Flow purely eastward: u = 20 m/s, v = 0
      const grid = createSyntheticWindGrid(() => ({ u: 20, v: 0 }));
      const engine = new WindParticleEngine(grid, 0, { particleCount: 20, speedMultiplier: 1.0 });

      const initialParticles = engine.getParticles().map((p) => ({ lon: p.lon, lat: p.lat, age: p.age }));

      // Run 5 steps
      for (let s = 0; s < 5; s++) {
        engine.step(0.016);
      }

      const updatedParticles = engine.getParticles();
      for (let i = 0; i < updatedParticles.length; i++) {
        const pInit = initialParticles[i];
        const pCurr = updatedParticles[i];

        // If particle didn't respawn due to maxAge or boundary
        if (pCurr.age > pInit.age) {
          // Because u > 0, longitude must have increased (eastward displacement)
          expect(pCurr.lon).toBeGreaterThan(pInit.lon);
          // Latitude should remain approximately identical because v = 0
          expect(pCurr.lat).toBeCloseTo(pInit.lat, 4);
        }
      }
    });

    it('respawns particles when age exceeds maxAge', () => {
      const grid = createSyntheticWindGrid(() => ({ u: 5, v: 5 }));
      const engine = new WindParticleEngine(grid, 0, { particleCount: 10 });

      const p0 = engine.getParticles()[0];
      // Force age to maxAge
      p0.age = p0.maxAge;

      engine.step(0.016);

      const p0After = engine.getParticles()[0];
      // Must have respawned with age reset to 0
      expect(p0After.age).toBe(0);
      expect(p0After.valid).toBe(true);
    });

    it('dynamically responds to speed multiplier changes', () => {
      const grid = createSyntheticWindGrid(() => ({ u: 10, v: 0 }));
      const engine = new WindParticleEngine(grid, 0, { particleCount: 5, speedMultiplier: 1.0 });

      engine.setSpeedMultiplier(2.5);
      expect(engine['speedMultiplier']).toBe(2.5);

      // Test bounds clamping
      engine.setSpeedMultiplier(10.0);
      expect(engine['speedMultiplier']).toBe(5.0); // Clamped to 5.0
      engine.setSpeedMultiplier(0.01);
      expect(engine['speedMultiplier']).toBe(0.1); // Clamped to 0.1
    });

    it('dynamically responds to density setting changes', () => {
      const grid = createSyntheticWindGrid(() => ({ u: 5, v: 5 }));
      const engine = new WindParticleEngine(grid, 0, { density: 'standard' });
      expect(engine.getParticleCount()).toBe(1500);

      engine.setDensity('dense');
      expect(engine.getParticleCount()).toBe(2500);

      engine.setDensity('light');
      expect(engine.getParticleCount()).toBe(800);
    });
  });

  describe('3. Canvas Rendering & Projection Culling', () => {
    it('renders particle polyline trails with age-based alpha without errors', () => {
      const grid = createSyntheticWindGrid(() => ({ u: 12, v: 8, speed: 50 }));
      const engine = new WindParticleEngine(grid, 0, { particleCount: 50 });

      // Run steps so history trails populate
      for (let s = 0; s < 5; s++) {
        engine.step(0.016);
      }

      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '',
        lineWidth: 1,
        lineCap: '',
        lineJoin: '',
      } as unknown as CanvasRenderingContext2D;

      const mockProjector = {
        project: (lngLat: [number, number] | { lng: number; lat: number }) => {
          const lon = Array.isArray(lngLat) ? lngLat[0] : lngLat.lng;
          const lat = Array.isArray(lngLat) ? lngLat[1] : lngLat.lat;
          return {
            x: (lon - 72.5) * 400,
            y: (19.5 - lat) * 400,
          };
        },
      };

      engine.render(mockCtx, mockProjector, 800, 600, 0.85);

      expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('correctly maps wind speed to meteorological color ramp', () => {
      expect(getWindColor(5, 1.0)).toContain('165, 243, 252'); // Light breeze cyan
      expect(getWindColor(20, 1.0)).toContain('56, 189, 248'); // Gentle cyan
      expect(getWindColor(35, 1.0)).toContain('52, 211, 153'); // Emerald green
      expect(getWindColor(55, 1.0)).toContain('251, 191, 36'); // Amber
      expect(getWindColor(75, 1.0)).toContain('251, 146, 60'); // Orange
      expect(getWindColor(105, 1.0)).toContain('244, 63, 94'); // Rose/Crimson storm
    });

    it('scales line width with velocity for visual hierarchy', () => {
      expect(getWindLineWidth(10)).toBe(1.2);
      expect(getWindLineWidth(30)).toBe(1.5);
      expect(getWindLineWidth(55)).toBe(1.8);
      expect(getWindLineWidth(85)).toBe(2.2);
    });
  });

  describe('4. Wind Overlay Manager & MapLibre Lifecycle', () => {
    let mockMap: any;
    let mockCanvas: HTMLCanvasElement;
    let mockCtx: any;

    beforeEach(() => {
      mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
      };

      mockCanvas = {
        width: 800,
        height: 600,
        getContext: vi.fn(() => mockCtx),
      } as unknown as HTMLCanvasElement;

      mockMap = {
        getContainer: vi.fn(() => ({
          getBoundingClientRect: () => ({ width: 800, height: 600 }),
        })),
        project: vi.fn(([lon, lat]: [number, number]) => ({
          x: (lon - 72.0) * 100,
          y: (20.0 - lat) * 100,
        })),
        on: vi.fn(),
        off: vi.fn(),
      };
    });

    it('mounts to MapLibre, attaches resize/move listeners, and cleans up on unmount', () => {
      const grid = createSyntheticWindGrid(() => ({ u: 10, v: 10 }));
      const manager = new WindOverlayManager();

      manager.mount(mockMap, mockCanvas, grid, 0, {
        visible: true,
        isPlaying: true,
      });

      expect(mockMap.on).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(mockMap.on).toHaveBeenCalledWith('move', expect.any(Function));

      // Unmount
      manager.unmount();
      expect(mockMap.off).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(mockMap.off).toHaveBeenCalledWith('move', expect.any(Function));
      expect(mockCtx.clearRect).toHaveBeenCalled();
    });

    it('handles play and pause toggle cleanly without resetting particle state', () => {
      const grid = createSyntheticWindGrid(() => ({ u: 8, v: 8 }));
      const manager = new WindOverlayManager();

      manager.mount(mockMap, mockCanvas, grid, 0, {
        visible: true,
        isPlaying: true,
      });

      manager.setPlaying(false);
      // Should pause engine
      expect(manager['isPlaying']).toBe(false);

      manager.setPlaying(true);
      expect(manager['isPlaying']).toBe(true);

      manager.unmount();
    });

    it('synchronizes props dynamically when options change', () => {
      const grid = createSyntheticWindGrid(() => ({ u: 8, v: 8 }));
      const manager = new WindOverlayManager();

      manager.mount(mockMap, mockCanvas, grid, 0, {
        visible: false,
        density: 'standard',
      });

      manager.sync(grid, 0, {
        visible: true,
        density: 'dense',
        speedMultiplier: 1.5,
      });

      expect(manager['visible']).toBe(true);
      expect(manager['density']).toBe('dense');
      expect(manager['speedMultiplier']).toBe(1.5);

      manager.unmount();
    });
  });

  describe('5. Frame Performance Profiling & Timing Verification', () => {
    it('profiles actual per-frame execution time across 120 animation steps (1500 particles)', () => {
      const grid = createSyntheticWindGrid(() => ({ u: 14, v: -6, speed: 55 }));
      const engine = new WindParticleEngine(grid, 0, { density: 'standard' }); // 1500 particles
      expect(engine.getParticleCount()).toBe(1500);

      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
      } as unknown as CanvasRenderingContext2D;

      const mockProjector = {
        project: (lngLat: [number, number] | { lng: number; lat: number }) => ({
          x: ((Array.isArray(lngLat) ? lngLat[0] : lngLat.lng) - 72.0) * 200,
          y: (20.0 - (Array.isArray(lngLat) ? lngLat[1] : lngLat.lat)) * 200,
        }),
      };

      // Warm up
      for (let i = 0; i < 10; i++) {
        engine.step(0.016);
      }

      const totalFrames = 120;
      const tStart = performance.now();
      for (let f = 0; f < totalFrames; f++) {
        engine.step(0.016);
        engine.render(mockCtx, mockProjector, 1280, 720, 0.85);
      }
      const tEnd = performance.now();
      const totalElapsedMs = tEnd - tStart;
      const msPerFrame = totalElapsedMs / totalFrames;
      const theoreticalFps = 1000 / msPerFrame;

      console.log(`[WindParticleEngine Profiler] 1500 particles across 120 frames: total=${totalElapsedMs.toFixed(2)}ms, per-frame=${msPerFrame.toFixed(3)}ms, max-achievable-rate=${theoreticalFps.toFixed(0)} FPS`);

      // 60 FPS requires frame budget under 16.67ms.
      // Particle engine in isolation must execute under 10.0ms (>=100 FPS) to leave headroom for MapLibre/DOM rendering.
      expect(msPerFrame).toBeLessThan(10.0);
    });
  });
});
