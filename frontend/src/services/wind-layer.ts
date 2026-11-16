/**
 * MapLibre Wind Particle Overlay Manager for JATAYU Tactical Map 2.0
 *
 * Coordinates the HTML5 2D wind particle animation engine on top of the MapLibre GL
 * viewport, synchronizing map transformations, canvas resizing, frame execution,
 * and user controls (visibility, speed, density, opacity, play/pause).
 */

import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  WindParticleEngine,
  WindParticleOptions,
  WindParticleDensity,
} from './wind-particles';
import type { ForecastGridResponse } from './forecast';

export interface WindOverlayOptions extends WindParticleOptions {
  visible?: boolean;
  isPlaying?: boolean;
}

export class WindOverlayManager {
  private map: MapLibreMap | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private engine: WindParticleEngine | null = null;

  private visible: boolean = false;
  private isPlaying: boolean = true;
  private opacity: number = 85;
  private density: WindParticleDensity = 'standard';
  private speedMultiplier: number = 1.0;

  private handleResizeBound: () => void;
  private handleMoveBound: () => void;

  constructor() {
    this.handleResizeBound = this.handleResize.bind(this);
    this.handleMoveBound = this.handleMove.bind(this);
  }

  /**
   * Mounts the overlay manager to a MapLibre instance and HTML5 Canvas element.
   */
  public mount(
    map: MapLibreMap,
    canvas: HTMLCanvasElement,
    response: ForecastGridResponse | null | undefined,
    timestepIndex: number = 0,
    options: WindOverlayOptions = {}
  ): void {
    this.map = map;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.visible = options.visible ?? false;
    this.isPlaying = options.isPlaying ?? true;
    this.opacity = options.opacity ?? 85;
    this.density = options.density ?? 'standard';
    this.speedMultiplier = options.speedMultiplier ?? 1.0;

    // Size the canvas to match map viewport
    this.resizeCanvas();

    // Instantiate particle engine
    this.engine = new WindParticleEngine(response, timestepIndex, {
      density: this.density,
      speedMultiplier: this.speedMultiplier,
      opacity: this.opacity,
    });

    // Register map listeners
    if (this.map && typeof this.map.on === 'function') {
      this.map.on('resize', this.handleResizeBound);
      this.map.on('move', this.handleMoveBound);
    }

    if (this.visible && this.isPlaying) {
      this.startEngine();
    }
  }

  /**
   * Synchronizes data or options when component props change.
   */
  public sync(
    response: ForecastGridResponse | null | undefined,
    timestepIndex: number = 0,
    options: WindOverlayOptions = {}
  ): void {
    if (options.visible !== undefined) {
      this.visible = options.visible;
    }
    if (options.isPlaying !== undefined) {
      this.isPlaying = options.isPlaying;
    }
    if (options.opacity !== undefined) {
      this.opacity = options.opacity;
    }
    if (options.density !== undefined && options.density !== this.density) {
      this.density = options.density;
    }
    if (options.speedMultiplier !== undefined) {
      this.speedMultiplier = options.speedMultiplier;
    }

    if (this.engine) {
      this.engine.updateGrid(response, timestepIndex, {
        density: this.density,
        speedMultiplier: this.speedMultiplier,
        opacity: this.opacity,
      });
    }

    if (this.visible && this.isPlaying) {
      this.startEngine();
    } else {
      this.stopEngine();
    }
  }

  private startEngine(): void {
    if (!this.engine || !this.ctx || !this.canvas || !this.map) return;
    if (this.engine.getIsRunning()) return;

    const projector = {
      project: (lngLat: [number, number] | { lng: number; lat: number }) => {
        if (!this.map) return { x: 0, y: 0 };
        return this.map.project(lngLat);
      },
    };

    const getCanvasSize = () => ({
      width: this.canvas?.width || 0,
      height: this.canvas?.height || 0,
    });

    const getOpacity = () => this.opacity / 100;

    this.engine.start(this.ctx, projector, getCanvasSize, getOpacity);
  }

  private stopEngine(): void {
    if (this.engine) {
      this.engine.pause();
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private resizeCanvas(): void {
    if (!this.canvas || !this.map) return;
    const container = typeof this.map.getContainer === 'function' ? this.map.getContainer() : null;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  private handleResize(): void {
    this.resizeCanvas();
  }

  private handleMove(): void {
    // When map is panning/zooming, the engine loop already re-projects every frame.
    // If the animation is paused, trigger a single render frame to update positions.
    if (this.engine && !this.isPlaying && this.visible && this.ctx && this.canvas && this.map) {
      const projector = {
        project: (lngLat: [number, number] | { lng: number; lat: number }) => {
          if (!this.map) return { x: 0, y: 0 };
          return this.map.project(lngLat);
        },
      };
      this.engine.render(this.ctx, projector, this.canvas.width, this.canvas.height, this.opacity / 100);
    }
  }

  /**
   * Sets playback state (Play/Pause).
   */
  public setPlaying(playing: boolean): void {
    this.isPlaying = playing;
    if (this.visible && this.isPlaying) {
      this.startEngine();
    } else {
      if (this.engine) {
        this.engine.pause();
      }
    }
  }

  /**
   * Returns current measured FPS from engine telemetry.
   */
  public getFps(): number {
    return this.engine?.currentFps ?? 0;
  }

  /**
   * Dismounts the overlay, detaches listeners, and cleans up memory.
   */
  public unmount(): void {
    if (this.map && typeof this.map.off === 'function') {
      this.map.off('resize', this.handleResizeBound);
      this.map.off('move', this.handleMoveBound);
    }

    if (this.engine) {
      this.engine.stop(this.ctx, this.canvas?.width, this.canvas?.height);
      this.engine = null;
    }

    this.map = null;
    this.canvas = null;
    this.ctx = null;
  }
}
