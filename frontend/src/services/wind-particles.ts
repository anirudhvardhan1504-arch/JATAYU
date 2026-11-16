/**
 * Forecast Wind Particle Animation Engine for JATAYU Tactical Map 2.0
 *
 * Simulates and renders fluid atmospheric wind streamlines from 10-meter
 * horizontal wind velocity vectors (uMs eastward, vMs northward) derived
 * from ECMWF IFS and NOAA GFS Numerical Weather Prediction grids.
 *
 * Scientific & Meteorological Rules:
 * - Authoritative Vectors: Advection is governed by physical U/V velocity components (in m/s).
 * - Meteorological vs Flow Direction:
 *     u > 0: Eastward flow (westerly wind).
 *     v > 0: Northward flow (southerly wind).
 *     Particles travel in the direction of the flow vector [u, v].
 * - Strict No-Extrapolation: Particles are evaluated against a spatial proximity cutoff.
 *     If distance to nearest NWP node exceeds maxDistanceDegrees, the vector is null,
 *     the particle is suppressed, and it respawns inside the valid data domain.
 * - Coordinate Invariance:
 *     Particles maintain true geographic coordinates [longitude, latitude].
 *     Advection occurs in physical spherical geometry (meters per second scaled to degrees).
 *     Screen coordinates are projected every frame via MapLibre, ensuring 100% distortion-free
 *     and drift-free synchronization during user pan, zoom, pitch, and rotation.
 * - Dynamic Polyline Trails:
 *     Each particle maintains a short temporal history queue drawn as an antialiased polyline
 *     with age-attenuated alpha. The canvas is cleared every frame, eliminating ghosting or
 *     smear artifacts during map interaction.
 */

import type {
  ForecastGridResponse,
  HourlyGridDataPoint,
} from './forecast';

// ============================================================================
// Types & Contracts
// ============================================================================

export type WindParticleDensity = 'light' | 'standard' | 'dense';

export interface WindParticleOptions {
  /** Particle density preset: light (800), standard (1500), or dense (2500) */
  density?: WindParticleDensity;
  /** Explicit particle count override */
  particleCount?: number;
  /** Velocity advection speed multiplier (e.g. 0.5, 1.0, 1.5, 2.0; default: 1.0) */
  speedMultiplier?: number;
  /** Opacity percentage (0 - 100, default: 85) */
  opacity?: number;
  /** Trail history length in frames (default: 5) */
  trailLength?: number;
  /** Maximum distance in degrees to nearest node before vector is considered no-data */
  maxDistanceDegrees?: number;
}

export interface WindVectorSample {
  uMs: number;
  vMs: number;
  speedKmh: number;
  valid: boolean;
}

export interface Particle {
  lon: number;
  lat: number;
  age: number;
  maxAge: number;
  speedKmh: number;
  valid: boolean;
  history: [number, number][]; // Array of [lon, lat]
}

export interface WindDomainBounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

export interface MapProjector {
  project: (lngLat: [number, number] | { lng: number; lat: number }) => { x: number; y: number };
  getBounds?: () => {
    getWest: () => number;
    getEast: () => number;
    getSouth: () => number;
    getNorth: () => number;
  };
}

// Particle count mappings
export const DENSITY_PARTICLE_COUNTS: Record<WindParticleDensity, number> = {
  light: 800,
  standard: 1500,
  dense: 2500,
};

// ============================================================================
// Spatial Spatial Index & Vector Interpolator
// ============================================================================

export interface IndexedWindNode {
  lon: number;
  lat: number;
  uMs: number;
  vMs: number;
  speedKmh: number;
}

/**
 * Builds an in-memory spatial index of valid wind vectors for a selected forecast timestep.
 */
export class WindVectorField {
  private nodes: IndexedWindNode[] = [];
  public bounds: WindDomainBounds = { minLon: 0, maxLon: 0, minLat: 0, maxLat: 0 };
  public maxDistanceDegrees: number;
  public hasData: boolean = false;

  constructor(
    response: ForecastGridResponse | null | undefined,
    timestepIndex: number = 0,
    maxDistanceDegrees?: number
  ) {
    if (!response || !response.nodes || response.nodes.length === 0) {
      this.maxDistanceDegrees = 0.5;
      return;
    }

    const mode = response.metadata?.mode || 'sector';
    // Adaptive cutoff: 0.45° for mesoscale sector clusters (~0.25° grid), 2.2° for national (~1.5° grid)
    this.maxDistanceDegrees = maxDistanceDegrees ?? (mode === 'national' ? 2.2 : 0.45);

    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    const validIndex = Math.max(0, Math.min(timestepIndex, (response.nodes[0]?.hourly?.length || 72) - 1));

    for (const node of response.nodes) {
      const lat = typeof node.modelLat === 'number' ? node.modelLat : node.requestedLat;
      const lon = typeof node.modelLon === 'number' ? node.modelLon : node.requestedLon;
      const pt: HourlyGridDataPoint | undefined = node.hourly?.[validIndex];

      if (!pt) continue;

      let u = pt.uMs;
      let v = pt.vMs;

      // Robust fallback if uMs / vMs are missing but windSpeedKmh & windDirectionDegrees exist
      if ((typeof u !== 'number' || isNaN(u) || typeof v !== 'number' || isNaN(v)) && typeof pt.windSpeedKmh === 'number') {
        const speedMs = pt.windSpeedKmh / 3.6;
        const rad = ((pt.windDirectionDegrees ?? 0) * Math.PI) / 180;
        // Meteorological wind direction: angle wind blows FROM.
        // u = -speed * sin(rad), v = -speed * cos(rad)
        u = -speedMs * Math.sin(rad);
        v = -speedMs * Math.cos(rad);
      }

      if (typeof u !== 'number' || isNaN(u) || typeof v !== 'number' || isNaN(v)) {
        continue;
      }

      const speedKmh = typeof pt.windSpeedKmh === 'number' && !isNaN(pt.windSpeedKmh)
        ? pt.windSpeedKmh
        : Math.hypot(u, v) * 3.6;

      this.nodes.push({ lon, lat, uMs: u, vMs: v, speedKmh });

      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    if (this.nodes.length > 0) {
      this.bounds = { minLon, maxLon, minLat, maxLat };
      this.hasData = true;
    }
  }

  /**
   * Samples the horizontal wind vector (uMs, vMs) at an arbitrary geographic coordinate [lon, lat]
   * using Inverse Distance Weighting across immediate neighbors.
   *
   * Enforces strict non-extrapolation: Returns valid=false if distance to nearest node > maxDistanceDegrees.
   */
  public sampleVector(lon: number, lat: number): WindVectorSample {
    if (!this.hasData || this.nodes.length === 0) {
      return { uMs: 0, vMs: 0, speedKmh: 0, valid: false };
    }

    // Coarse bounding check with boundary margin
    const margin = this.maxDistanceDegrees;
    if (
      lon < this.bounds.minLon - margin ||
      lon > this.bounds.maxLon + margin ||
      lat < this.bounds.minLat - margin ||
      lat > this.bounds.maxLat + margin
    ) {
      return { uMs: 0, vMs: 0, speedKmh: 0, valid: false };
    }

    let minDistance = Infinity;
    let sumWeight = 0;
    let sumU = 0;
    let sumV = 0;
    let sumSpeed = 0;

    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      const dLon = lon - node.lon;
      const dLat = lat - node.lat;
      const distSq = dLon * dLon + dLat * dLat;
      const dist = Math.sqrt(distSq);

      if (dist < minDistance) {
        minDistance = dist;
      }

      // Check against cutoff
      if (dist <= this.maxDistanceDegrees) {
        // Exact match or negligible distance to avoid singularity
        if (dist < 1e-5) {
          return {
            uMs: node.uMs,
            vMs: node.vMs,
            speedKmh: node.speedKmh,
            valid: true,
          };
        }

        const weight = 1 / (distSq + 1e-4);
        sumWeight += weight;
        sumU += node.uMs * weight;
        sumV += node.vMs * weight;
        sumSpeed += node.speedKmh * weight;
      }
    }

    // If nearest node exceeds spatial cutoff, this is an unsupported / no-data zone
    if (minDistance > this.maxDistanceDegrees || sumWeight === 0) {
      return { uMs: 0, vMs: 0, speedKmh: 0, valid: false };
    }

    const u = sumU / sumWeight;
    const v = sumV / sumWeight;
    const speed = sumSpeed / sumWeight;

    return {
      uMs: u,
      vMs: v,
      speedKmh: speed,
      valid: true,
    };
  }
}

// ============================================================================
// Wind Particle Simulation Engine
// ============================================================================

export class WindParticleEngine {
  private particles: Particle[] = [];
  private vectorField: WindVectorField;
  private density: WindParticleDensity;
  private particleCount: number;
  private speedMultiplier: number;
  private trailLength: number;
  private isRunning: boolean = false;
  private animFrameId: number | null = null;
  private lastTimestamp: number = 0;

  // Actual measured FPS telemetry
  public currentFps: number = 0;
  private frameCount: number = 0;
  private fpsLastSampleTime: number = 0;

  constructor(
    response: ForecastGridResponse | null | undefined,
    timestepIndex: number = 0,
    options: WindParticleOptions = {}
  ) {
    this.density = options.density || 'standard';
    this.particleCount = options.particleCount || DENSITY_PARTICLE_COUNTS[this.density];
    this.speedMultiplier = options.speedMultiplier ?? 1.0;
    this.trailLength = options.trailLength ?? 5;
    this.vectorField = new WindVectorField(response, timestepIndex, options.maxDistanceDegrees);

    this.initParticles();
  }

  /**
   * Updates the underlying forecast grid response or selected timestep.
   */
  public updateGrid(
    response: ForecastGridResponse | null | undefined,
    timestepIndex: number = 0,
    options: WindParticleOptions = {}
  ): void {
    if (options.density && options.density !== this.density) {
      this.density = options.density;
      this.particleCount = options.particleCount || DENSITY_PARTICLE_COUNTS[this.density];
    } else if (options.particleCount && options.particleCount !== this.particleCount) {
      this.particleCount = options.particleCount;
    }

    if (options.speedMultiplier !== undefined) {
      this.speedMultiplier = options.speedMultiplier;
    }
    if (options.trailLength !== undefined) {
      this.trailLength = options.trailLength;
    }

    this.vectorField = new WindVectorField(response, timestepIndex, options.maxDistanceDegrees);
    this.initParticles();
  }

  /**
   * Updates animation speed multiplier dynamically.
   */
  public setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = Math.max(0.1, Math.min(multiplier, 5.0));
  }

  /**
   * Updates particle density setting.
   */
  public setDensity(density: WindParticleDensity): void {
    if (this.density === density) return;
    this.density = density;
    this.particleCount = DENSITY_PARTICLE_COUNTS[density];
    this.initParticles();
  }

  /**
   * Initializes or respawns particles across the valid forecast domain.
   */
  private initParticles(): void {
    this.particles = [];
    if (!this.vectorField.hasData) return;

    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push(this.createRandomParticle(true));
    }
  }

  /**
   * Spawns a single particle at a random valid geographic location within the domain.
   * Staggers initial age if initial=true; starts at age=0 on respawn.
   */
  private createRandomParticle(initial: boolean = false): Particle {
    const bounds = this.vectorField.bounds;
    const spanLon = bounds.maxLon - bounds.minLon;
    const spanLat = bounds.maxLat - bounds.minLat;

    // Attempt up to 8 random trials to find a position within valid data coverage
    let lon = bounds.minLon + Math.random() * spanLon;
    let lat = bounds.minLat + Math.random() * spanLat;
    let sample = this.vectorField.sampleVector(lon, lat);

    let attempts = 0;
    while (!sample.valid && attempts < 8) {
      lon = bounds.minLon + Math.random() * spanLon;
      lat = bounds.minLat + Math.random() * spanLat;
      sample = this.vectorField.sampleVector(lon, lat);
      attempts++;
    }

    const maxAge = Math.floor(40 + Math.random() * 50); // 40 - 90 frames lifespan
    const age = initial ? Math.floor(Math.random() * maxAge) : 0; // Stagger initial ages

    return {
      lon,
      lat,
      age,
      maxAge,
      speedKmh: sample.speedKmh,
      valid: sample.valid,
      history: [[lon, lat]],
    };
  }

  /**
   * Advances the particle positions by one simulation timestep (deltaSeconds).
   */
  public step(deltaSeconds: number = 0.016): void {
    if (!this.vectorField.hasData || this.particles.length === 0) return;

    // Scale delta time: normal 60fps = 0.016s. Cap delta to avoid large jumps on tab switch.
    const dt = Math.min(deltaSeconds, 0.05);

    // Speed scaling factor: converts physical m/s into visible angular displacement per second
    // 1 deg latitude ≈ 111,320 meters.
    // Base visual multiplier: ~900 (gives graceful 1-3 screen pixels per frame at mesoscale zoom)
    const baseVisualScale = 900.0 * this.speedMultiplier;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Age advancement and respawn check
      p.age++;
      if (p.age >= p.maxAge || !p.valid) {
        this.particles[i] = this.createRandomParticle(false);
        continue;
      }

      // Sample vector field at current position
      const vector = this.vectorField.sampleVector(p.lon, p.lat);

      if (!vector.valid) {
        // Walked into no-data or ocean void: immediately invalidate and respawn next step
        p.valid = false;
        continue;
      }

      p.speedKmh = vector.speedKmh;

      // Convert m/s displacement to degrees
      // dLat = (v * dt * scale) / 111320
      // dLon = (u * dt * scale) / (111320 * cos(lat))
      const radLat = (p.lat * Math.PI) / 180;
      const cosLat = Math.max(0.2, Math.cos(radLat)); // Prevent division by zero near poles

      const dLat = (vector.vMs * dt * baseVisualScale) / 111320;
      const dLon = (vector.uMs * dt * baseVisualScale) / (111320 * cosLat);

      const nextLon = p.lon + dLon;
      const nextLat = p.lat + dLat;

      // Push to history trail
      p.history.push([p.lon, p.lat]);
      if (p.history.length > this.trailLength) {
        p.history.shift();
      }

      p.lon = nextLon;
      p.lat = nextLat;
    }
  }

  /**
   * Renders the active particles onto an HTML5 2D Canvas using MapLibre projection.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    projector: MapProjector,
    canvasWidth: number,
    canvasHeight: number,
    baseOpacity: number = 0.85
  ): void {
    // 1. Clean clear of entire canvas (eliminates ghosting/tearing during map movements)
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (!this.vectorField.hasData || this.particles.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const globalAlpha = Math.max(0.1, Math.min(baseOpacity, 1.0));

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.valid || p.history.length < 2) continue;

      // Project current position and recent history points into screen coordinates
      const currentPt = projector.project([p.lon, p.lat]);

      // Viewport bounds culling (with margin)
      if (
        currentPt.x < -40 ||
        currentPt.x > canvasWidth + 40 ||
        currentPt.y < -40 ||
        currentPt.y > canvasHeight + 40
      ) {
        continue;
      }

      // Compute particle age attenuation (smooth fade-in for young, fade-out for old)
      const ageFrac = p.age / p.maxAge;
      let alpha = 1.0;
      if (ageFrac < 0.2) {
        alpha = ageFrac / 0.2;
      } else if (ageFrac > 0.7) {
        alpha = (1.0 - ageFrac) / 0.3;
      }
      alpha = Math.max(0.05, Math.min(alpha, 1.0)) * globalAlpha;

      // Color based on wind speed (km/h)
      const color = getWindColor(p.speedKmh, alpha);
      const lineWidth = getWindLineWidth(p.speedKmh);

      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;

      ctx.beginPath();
      // Draw smooth line from oldest history point to current
      const startPt = projector.project(p.history[0]);
      ctx.moveTo(startPt.x, startPt.y);

      for (let h = 1; h < p.history.length; h++) {
        const hPt = projector.project(p.history[h]);
        ctx.lineTo(hPt.x, hPt.y);
      }

      ctx.lineTo(currentPt.x, currentPt.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Starts the continuous requestAnimationFrame animation loop.
   */
  public start(
    ctx: CanvasRenderingContext2D,
    projector: MapProjector,
    getCanvasSize: () => { width: number; height: number },
    getOpacity: () => number = () => 0.85
  ): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.fpsLastSampleTime = this.lastTimestamp;
    this.frameCount = 0;

    const frame = (now: number) => {
      if (!this.isRunning) return;

      const deltaSeconds = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;

      // Update actual FPS telemetry every 500ms
      this.frameCount++;
      const elapsedSinceFpsSample = now - this.fpsLastSampleTime;
      if (elapsedSinceFpsSample >= 500) {
        this.currentFps = Math.round((this.frameCount * 1000) / elapsedSinceFpsSample);
        this.frameCount = 0;
        this.fpsLastSampleTime = now;
      }

      this.step(deltaSeconds);

      const size = getCanvasSize();
      if (size.width > 0 && size.height > 0) {
        this.render(ctx, projector, size.width, size.height, getOpacity());
      }

      this.animFrameId = requestAnimationFrame(frame);
    };

    this.animFrameId = requestAnimationFrame(frame);
  }

  /**
   * Pauses the animation loop without resetting particle state.
   */
  public pause(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * Completely stops and disposes of the animation engine and canvas content.
   */
  public stop(ctx?: CanvasRenderingContext2D | null, width?: number, height?: number): void {
    this.pause();
    this.particles = [];
    if (ctx && width && height) {
      ctx.clearRect(0, 0, width, height);
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getParticleCount(): number {
    return this.particles.length;
  }

  public getParticles(): ReadonlyArray<Particle> {
    return this.particles;
  }

  public getVectorField(): WindVectorField {
    return this.vectorField;
  }
}

// ============================================================================
// Wind Color & Styling Scale (km/h)
// ============================================================================

/**
 * Returns an RGBA string mapped to meteorological wind speed (in km/h).
 * Matches Beaufort scale and standard operational NWP streamline styling:
 * - < 10 km/h: Light cyan (#a5f3fc)
 * - 10-25 km/h: Cyan (#38bdf8)
 * - 25-45 km/h: Emerald / Mint (#34d399)
 * - 45-65 km/h: Amber (#fbbf24)
 * - 65-90 km/h: Orange (#fb923c)
 * - > 90 km/h: Crimson / Rose (#f43f5e)
 */
export function getWindColor(speedKmh: number, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha)).toFixed(2);

  if (speedKmh < 10) {
    return `rgba(165, 243, 252, ${a})`; // #a5f3fc Light cyan
  } else if (speedKmh < 25) {
    return `rgba(56, 189, 248, ${a})`; // #38bdf8 Cyan
  } else if (speedKmh < 45) {
    return `rgba(52, 211, 153, ${a})`; // #34d399 Emerald
  } else if (speedKmh < 65) {
    return `rgba(251, 191, 36, ${a})`; // #fbbf24 Amber
  } else if (speedKmh < 90) {
    return `rgba(251, 146, 60, ${a})`; // #fb923c Orange
  } else {
    return `rgba(244, 63, 94, ${a})`; // #f43f5e Rose / Crimson (Gale/Cyclone)
  }
}

/**
 * Line width scaled slightly by wind speed for depth perception (1.0px to 2.2px).
 */
export function getWindLineWidth(speedKmh: number): number {
  if (speedKmh < 15) return 1.2;
  if (speedKmh < 40) return 1.5;
  if (speedKmh < 70) return 1.8;
  return 2.2;
}
