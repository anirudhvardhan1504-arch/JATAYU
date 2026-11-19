import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Layers, ShieldAlert, Crosshair, RotateCcw, AlertTriangle, Eye, EyeOff, Globe, Wind, Play, Pause } from 'lucide-react';
import { Badge } from '../common/Badge';
import { getLatestRadarInfo, RainViewerRadarInfo } from '../../services/radar';
import { SimulationMetadata } from '../../services/research';
import {
  SatelliteProductKey,
  SATELLITE_PRODUCTS,
  getSatelliteTileUrl,
} from '../../services/satellite';
import {
  ForecastProductType,
  ForecastGridResponse,
  FORECAST_PRODUCTS,
  getForecastGrid,
} from '../../services/forecast';
import {
  syncForecastScalarLayer,
  removeForecastScalarLayer,
} from '../../services/forecast-layer';
import { ContourIntervalHpa } from '../../services/pressure-contours';
import {
  syncPressureLayers,
  removePressureLayers,
} from '../../services/pressure-layer';
import {
  WindParticleDensity,
} from '../../services/wind-particles';
import {
  WindOverlayManager,
} from '../../services/wind-layer';
import { ForecastImpactResponse } from '../../services/forecast-impact';
import {
  syncForecastImpactLayers,
  removeForecastImpactLayers,
} from '../../services/forecast-impact-layer';
import { FloodVulnerabilityPoint } from '../../services/risk';
import { EmergencyFacility, DisasterAlert } from '../../types';

export interface TacticalMapProps {
  center: [number, number]; // [lon, lat]
  zoom?: number;
  locationName: string;
  rainfallMm?: number;
  riskLevel?: string;
  className?: string;
  onSelectCoordinates?: (coords: { lat: number; lon: number; name?: string }) => void;
  radarOpacity?: number; // 0 - 100
  showRadar?: boolean;
  onToggleRadar?: (visible: boolean) => void;
  satelliteOpacity?: number; // 0 - 100
  showSatellite?: boolean;
  onToggleSatellite?: (visible: boolean) => void;
  satelliteProductKey?: SatelliteProductKey;
  satelliteTileUrl?: string | null;
  activeSatelliteTileUrl?: string | null;
  preloadSatelliteTileUrl?: string | null;
  activeSatelliteTimestamp?: number | null;
  initialCenter?: [number, number];
  showSimulation?: boolean;
  simulationGeojson?: GeoJSON.FeatureCollection | null;
  simulationMeta?: SimulationMetadata | null;
  onToggleSimulation?: (visible: boolean) => void;
  activeRadarTileUrl?: string | null;
  activeRadarTimestamp?: number | null;
  onRadarLoaded?: (info: RainViewerRadarInfo) => void;
  variant?: 'standalone' | 'full';
  hideDefaultControls?: boolean;
  // Phase 3B-3A Forecast Scalar Canvas Layer
  showForecast?: boolean;
  forecastProduct?: ForecastProductType;
  forecastTimestepIndex?: number;
  forecastOpacity?: number; // 0 - 100
  forecastGridData?: ForecastGridResponse | null;
  onToggleForecast?: (visible: boolean) => void;
  // Phase 3B-3B Pressure Isobar Contours & Extrema
  showPressureContours?: boolean;
  pressureContourInterval?: ContourIntervalHpa;
  onTogglePressureContours?: (visible: boolean) => void;
  // Phase 3B-3C Forecast Wind Particle Animation
  showWindParticles?: boolean;
  windParticleDensity?: WindParticleDensity;
  windParticleOpacity?: number; // 0 - 100
  windSpeedMultiplier?: number;
  isWindPlaying?: boolean;
  onToggleWindParticles?: (visible: boolean) => void;
  onToggleWindPlay?: (playing: boolean) => void;
  onChangeWindSpeedMultiplier?: (speed: number) => void;
  onChangeWindParticleDensity?: (density: WindParticleDensity) => void;
  // Phase 3D-2B District Forecast Impact Layer
  showDistrictImpact?: boolean;
  districtImpactResponse?: ForecastImpactResponse | null;
  selectedImpactDistrict?: string | null;
  districtImpactOpacity?: number; // 0 - 100
  onSelectImpactDistrict?: (districtName: string, state: string) => void;
  // Intelligence Overlays
  showVulnerabilityPoints?: boolean;
  vulnerabilityPoints?: FloodVulnerabilityPoint[] | null;
  showFacilities?: boolean;
  facilities?: EmergencyFacility[] | null;
  showAlertsLayer?: boolean;
  alerts?: DisasterAlert[] | null;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  center,
  zoom = 10,
  locationName,
  rainfallMm = 0,
  riskLevel = 'GUARDED',
  className = '',
  onSelectCoordinates,
  radarOpacity = 80,
  showRadar = true,
  onToggleRadar,
  satelliteOpacity = 75,
  showSatellite = false,
  onToggleSatellite,
  satelliteProductKey = 'ir',
  satelliteTileUrl = null,
  activeSatelliteTileUrl = null,
  preloadSatelliteTileUrl = null,
  activeSatelliteTimestamp = null,
  initialCenter = [72.8777, 19.076],
  showSimulation = false,
  simulationGeojson = null,
  simulationMeta = null,
  onToggleSimulation,
  activeRadarTileUrl = null,
  activeRadarTimestamp = null,
  onRadarLoaded,
  variant = 'standalone',
  hideDefaultControls = false,
  showForecast = false,
  forecastProduct = 'precipitation',
  forecastTimestepIndex = 0,
  forecastOpacity = 80,
  forecastGridData = null,
  onToggleForecast,
  showPressureContours = false,
  pressureContourInterval = 4,
  onTogglePressureContours,
  showWindParticles = false,
  windParticleDensity = 'standard',
  windParticleOpacity = 85,
  windSpeedMultiplier = 1.0,
  isWindPlaying = true,
  onToggleWindParticles,
  onToggleWindPlay,
  onChangeWindSpeedMultiplier,
  onChangeWindParticleDensity,
  showDistrictImpact = false,
  districtImpactResponse = null,
  selectedImpactDistrict = null,
  districtImpactOpacity = 65,
  onSelectImpactDistrict,
  showVulnerabilityPoints = false,
  vulnerabilityPoints = null,
  showFacilities = false,
  facilities = null,
  showAlertsLayer: _showAlertsLayer = false,
  alerts: _alerts = null,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const currentSatBufferRef = useRef<'a' | 'b'>('a');
  const lastSatTileUrlRef = useRef<string | null>(null);

  const [mapError, setMapError] = useState<string | null>(null);
  const [radarInfo, setRadarInfo] = useState<RainViewerRadarInfo | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarError, setRadarError] = useState<string | null>(null);

  // Standalone forecast layer internal state management
  const [internalShowForecast, setInternalShowForecast] = useState<boolean | null>(null);
  const [internalShowPressureContours, setInternalShowPressureContours] = useState<boolean | null>(null);
  const [internalShowWindParticles, setInternalShowWindParticles] = useState<boolean | null>(null);
  const [internalWindDensity, setInternalWindDensity] = useState<WindParticleDensity>(windParticleDensity);
  const [internalWindSpeed, setInternalWindSpeed] = useState<number>(windSpeedMultiplier);
  const [internalIsWindPlaying, setInternalIsWindPlaying] = useState<boolean>(isWindPlaying);
  const [internalForecastGrid, setInternalForecastGrid] = useState<ForecastGridResponse | null>(null);

  const effectiveShowForecast = internalShowForecast !== null ? internalShowForecast : showForecast;
  const effectiveShowPressureContours =
    internalShowPressureContours !== null ? internalShowPressureContours : showPressureContours;
  const effectiveShowWindParticles =
    internalShowWindParticles !== null ? internalShowWindParticles : showWindParticles;
  const effectiveWindDensity = windParticleDensity || internalWindDensity;
  const effectiveWindSpeed = windSpeedMultiplier || internalWindSpeed;
  const effectiveIsWindPlaying = isWindPlaying !== undefined ? isWindPlaying : internalIsWindPlaying;
  const effectiveWindOpacity = windParticleOpacity;
  const effectiveForecastGrid = forecastGridData || internalForecastGrid;

  const windCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const windOverlayManagerRef = useRef<WindOverlayManager | null>(null);

  // Reset internal toggles when parent props change
  useEffect(() => {
    setInternalShowForecast(null);
  }, [showForecast]);

  useEffect(() => {
    setInternalShowPressureContours(null);
  }, [showPressureContours]);

  useEffect(() => {
    setInternalShowWindParticles(null);
  }, [showWindParticles]);

  // Auto-fetch forecast grid if turned on in standalone mode without passed data
  useEffect(() => {
    if ((!effectiveShowForecast && !effectiveShowPressureContours && !effectiveShowWindParticles) || effectiveForecastGrid) return;
    let isSubscribed = true;
    getForecastGrid('sector', 'mumbai')
      .then((grid) => {
        if (isSubscribed) setInternalForecastGrid(grid);
      })
      .catch((err) => {
        console.warn('[TacticalMap] Failed to load forecast grid:', err);
      });
    return () => {
      isSubscribed = false;
    };
  }, [effectiveShowForecast, effectiveShowPressureContours, effectiveShowWindParticles, effectiveForecastGrid]);

  // Fetch verified RainViewer metadata on mount
  useEffect(() => {
    let isSubscribed = true;
    setRadarLoading(true);
    setRadarError(null);

    getLatestRadarInfo()
      .then((info) => {
        if (!isSubscribed) return;
        if (info) {
          setRadarInfo(info);
          if (onRadarLoaded) onRadarLoaded(info);
        } else {
          setRadarError('Global radar feed offline or unreachable');
        }
      })
      .catch((err) => {
        if (!isSubscribed) return;
        setRadarError(err.message || 'Radar upstream communication failure');
      })
      .finally(() => {
        if (isSubscribed) setRadarLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  // Initialize MapLibre instance
  useEffect(() => {
    if (!mapContainer.current) return;
    setMapError(null);

    try {
      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: center,
        zoom: zoom,
        minZoom: 2,
        maxZoom: 18,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

      map.on('load', () => {
        // Sector target reticle marker
        const el = document.createElement('div');
        el.className = 'w-6 h-6 rounded-full border-2 border-amber-400 bg-amber-500/30 flex items-center justify-center cursor-pointer shadow-md';
        const inner = document.createElement('div');
        inner.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
        el.appendChild(inner);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(center)
          .setPopup(
            new maplibregl.Popup({ offset: 15 }).setHTML(`
              <div style="font-family: monospace; font-size: 11px; padding: 4px; color: #0A1128;">
                <strong>${locationName}</strong><br/>
                Coordinates: ${center[1].toFixed(4)}°N, ${center[0].toFixed(4)}°E<br/>
                Precipitation: ${rainfallMm} mm/h<br/>
                Indicative Risk: <strong>${riskLevel}</strong>
              </div>
            `)
          )
          .addTo(map);

        markerRef.current = marker;

        // Try adding RainViewer radar raster layer if metadata was already resolved
        if (radarInfo && !map.getSource('rainviewer-radar')) {
          map.addSource('rainviewer-radar', {
            type: 'raster',
            tiles: [radarInfo.tileUrl],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 7,
            attribution: 'Radar data © RainViewer',
          });

          map.addLayer({
            id: 'rainviewer-radar-layer',
            type: 'raster',
            source: 'rainviewer-radar',
            paint: {
              'raster-opacity': (radarOpacity / 100),
              'raster-opacity-transition': { duration: 200 },
            },
            layout: {
              visibility: showRadar ? 'visible' : 'none',
            },
          });
        }

        // Initialize SFINCS Adyar simulation layer if GeoJSON is already provided
        if (simulationGeojson && !map.getSource('adyar-simulation-source')) {
          map.addSource('adyar-simulation-source', {
            type: 'geojson',
            data: simulationGeojson,
          });

          map.addLayer({
            id: 'adyar-simulation-fill',
            type: 'fill',
            source: 'adyar-simulation-source',
            paint: {
              'fill-color': [
                'match',
                ['get', 'depth_band'],
                'critical', '#DC2626',
                'moderate', '#FB923C',
                'shallow', '#FEF08A',
                '#60A5FA',
              ],
              'fill-opacity': [
                'match',
                ['get', 'depth_band'],
                'critical', 0.75,
                'moderate', 0.55,
                'shallow', 0.40,
                0.30,
              ],
            },
            layout: {
              visibility: showSimulation ? 'visible' : 'none',
            },
          });

          map.addLayer({
            id: 'adyar-simulation-line',
            type: 'line',
            source: 'adyar-simulation-source',
            paint: {
              'line-color': [
                'match',
                ['get', 'depth_band'],
                'critical', '#7F1D1D',
                'moderate', '#C2410C',
                'shallow', '#CA8A04',
                '#2563EB',
              ],
              'line-width': 1,
              'line-opacity': 0.8,
            },
            layout: {
              visibility: showSimulation ? 'visible' : 'none',
            },
          });
        }
      });

      // Simulation polygon click inspector
      map.on('click', 'adyar-simulation-fill', (e: any) => {
        if (!e.features || !e.features[0]) return;
        const f = e.features[0];
        const props = f.properties || {};
        const depthBand = (props.depth_band || 'unknown').toUpperCase();
        const minDepth = props.min_depth_m !== undefined ? props.min_depth_m : '--';
        const maxDepth = props.max_depth_m !== undefined ? props.max_depth_m : '--';

        new maplibregl.Popup({ offset: 12 })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family: monospace; font-size: 11px; padding: 6px; color: #0A1128; max-width: 260px;">
              <div style="font-weight: bold; color: #DC2626; margin-bottom: 4px;">
                ⚠️ EXPERIMENTAL SFINCS SIMULATION
              </div>
              <div style="margin-bottom: 2px;"><strong>Reach:</strong> Adyar Corridor (28.01 km)</div>
              <div style="margin-bottom: 2px;"><strong>Classification:</strong> ${depthBand} (${minDepth}m - ${maxDepth}m)</div>
              <div style="margin-bottom: 2px;"><strong>Model Engine:</strong> SFINCS v2.5.0-alpha</div>
              <div style="margin-bottom: 2px;"><strong>Subgrid Carving:</strong> 100% continuous bathymetry</div>
              <div style="margin-top: 5px; font-size: 9px; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 4px; line-height: 1.2;">
                Tier: EXPERIMENTAL_UNVALIDATED. Synthetic forcing scenario S2. Quarantined from civil defense alerts.
              </div>
            </div>
          `)
          .addTo(map);
      });

      map.on('mouseenter', 'adyar-simulation-fill', () => {
        const canvas = map.getCanvas?.();
        if (canvas) canvas.style.cursor = 'pointer';
      });
      map.on('mouseleave', 'adyar-simulation-fill', () => {
        const canvas = map.getCanvas?.();
        if (canvas) canvas.style.cursor = '';
      });

      // Click-to-inspect interactive selection
      map.on('click', (e) => {
        const lat = Number(e.lngLat.lat.toFixed(4));
        const lon = Number(e.lngLat.lng.toFixed(4));
        if (onSelectCoordinates) {
          onSelectCoordinates({
            lat,
            lon,
            name: `Sector Fix [${lat >= 0 ? `${lat}°N` : `${Math.abs(lat)}°S`}, ${lon >= 0 ? `${lon}°E` : `${Math.abs(lon)}°W`}]`,
          });
        }
      });

      map.on('error', (e) => {
        // Capture basemap/network tile errors without unmounting
        if (e.error && !mapError) {
          console.warn('MapLibre GL error:', e.error);
        }
      });

      mapRef.current = map;

      return () => {
        if (windOverlayManagerRef.current) {
          windOverlayManagerRef.current.unmount();
          windOverlayManagerRef.current = null;
        }
        removePressureLayers(map);
        removeForecastScalarLayer(map);
        removeForecastImpactLayers(map);
        map.remove();
        mapRef.current = null;
        markerRef.current = null;
      };
    } catch (err: any) {
      console.warn('MapLibre GL initialization error:', err);
      setMapError(err.message || 'WebGL context initialization failed');
    }
  }, []);

  // Update center & marker position when props change
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: center, zoom: zoom });
      if (markerRef.current) {
        markerRef.current.setLngLat(center);
        markerRef.current.getPopup()?.setHTML(`
          <div style="font-family: monospace; font-size: 11px; padding: 4px; color: #0A1128;">
            <strong>${locationName}</strong><br/>
            Coordinates: ${center[1].toFixed(4)}°N, ${center[0].toFixed(4)}°E<br/>
            Precipitation: ${rainfallMm} mm/h<br/>
            Indicative Risk: <strong>${riskLevel}</strong>
          </div>
        `);
      }
    }
  }, [center, zoom, locationName, rainfallMm, riskLevel]);

  // Synchronize Radar Layer when radarInfo resolves after map has already loaded
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !radarInfo) return;

    if (!map.isStyleLoaded()) {
      map.once('load', () => {
        if (!map.getSource('rainviewer-radar')) {
          map.addSource('rainviewer-radar', {
            type: 'raster',
            tiles: [radarInfo.tileUrl],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 7,
            attribution: 'Radar data © RainViewer',
          });
          map.addLayer({
            id: 'rainviewer-radar-layer',
            type: 'raster',
            source: 'rainviewer-radar',
            paint: {
              'raster-opacity': (radarOpacity / 100),
            },
            layout: {
              visibility: showRadar ? 'visible' : 'none',
            },
          });
        }
      });
      return;
    }

    if (!map.getSource('rainviewer-radar')) {
      map.addSource('rainviewer-radar', {
        type: 'raster',
        tiles: [radarInfo.tileUrl],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 7,
        attribution: 'Radar data © RainViewer',
      });
      const beforeSim = map.getLayer && map.getLayer('adyar-simulation-fill') ? 'adyar-simulation-fill' : undefined;
      map.addLayer({
        id: 'rainviewer-radar-layer',
        type: 'raster',
        source: 'rainviewer-radar',
        paint: {
          'raster-opacity': (radarOpacity / 100),
        },
        layout: {
          visibility: showRadar ? 'visible' : 'none',
        },
      }, beforeSim);
    }
  }, [radarInfo]);

  // Synchronize dynamic radar tile URL (e.g. when timeline frame scrubs)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeRadarTileUrl) return;
    try {
      const src = map.getSource('rainviewer-radar') as any;
      if (src && typeof src.setTiles === 'function') {
        src.setTiles([activeRadarTileUrl]);
      }
    } catch {
      // Ignored if map is in transition
    }
  }, [activeRadarTileUrl]);

  // Synchronize Radar Opacity
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof map.getLayer !== 'function') return;
    if (map.getLayer('rainviewer-radar-layer')) {
      map.setPaintProperty?.('rainviewer-radar-layer', 'raster-opacity', radarOpacity / 100);
    }
  }, [radarOpacity]);

  // Synchronize Radar Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof map.getLayer !== 'function') return;
    if (map.getLayer('rainviewer-radar-layer')) {
      map.setLayoutProperty?.(
        'rainviewer-radar-layer',
        'visibility',
        showRadar ? 'visible' : 'none'
      );
    }
  }, [showRadar]);

  // Initialize / Reconfigure Double-Buffered NASA GIBS Satellite Layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const satConfig = SATELLITE_PRODUCTS[satelliteProductKey] || SATELLITE_PRODUCTS.ir;
    const initialTileUrl = activeSatelliteTileUrl || satelliteTileUrl || getSatelliteTileUrl(satConfig.key);
    const initialPreloadUrl = preloadSatelliteTileUrl || initialTileUrl;

    const setupSatellite = () => {
      try {
        // Clean up legacy single layer if present
        if (map.getLayer('nasa-gibs-satellite-layer')) {
          map.removeLayer('nasa-gibs-satellite-layer');
        }
        if (map.getSource('nasa-gibs-satellite')) {
          map.removeSource('nasa-gibs-satellite');
        }

        // Clean up double buffers if present
        if (map.getLayer('nasa-gibs-satellite-layer-a')) {
          map.removeLayer('nasa-gibs-satellite-layer-a');
        }
        if (map.getLayer('nasa-gibs-satellite-layer-b')) {
          map.removeLayer('nasa-gibs-satellite-layer-b');
        }
        if (map.getSource('nasa-gibs-satellite-source-a')) {
          map.removeSource('nasa-gibs-satellite-source-a');
        }
        if (map.getSource('nasa-gibs-satellite-source-b')) {
          map.removeSource('nasa-gibs-satellite-source-b');
        }

        // Add Buffer A Source
        map.addSource('nasa-gibs-satellite-source-a', {
          type: 'raster',
          tiles: [initialTileUrl],
          tileSize: 256,
          minzoom: satConfig.minZoom,
          maxzoom: satConfig.maxZoom,
          attribution: satConfig.attribution,
        });

        // Add Buffer B Source (Preload)
        map.addSource('nasa-gibs-satellite-source-b', {
          type: 'raster',
          tiles: [initialPreloadUrl],
          tileSize: 256,
          minzoom: satConfig.minZoom,
          maxzoom: satConfig.maxZoom,
          attribution: satConfig.attribution,
        });

        const beforeLayer = map.getLayer('rainviewer-radar-layer')
          ? 'rainviewer-radar-layer'
          : map.getLayer('adyar-simulation-fill')
          ? 'adyar-simulation-fill'
          : undefined;

        // Buffer A Layer (Initially active)
        map.addLayer(
          {
            id: 'nasa-gibs-satellite-layer-a',
            type: 'raster',
            source: 'nasa-gibs-satellite-source-a',
            paint: {
              'raster-opacity': showSatellite ? satelliteOpacity / 100 : 0,
              'raster-opacity-transition': { duration: 150, delay: 0 },
            },
            layout: {
              visibility: showSatellite ? 'visible' : 'none',
            },
          },
          beforeLayer
        );

        // Buffer B Layer (Initially dormant)
        map.addLayer(
          {
            id: 'nasa-gibs-satellite-layer-b',
            type: 'raster',
            source: 'nasa-gibs-satellite-source-b',
            paint: {
              'raster-opacity': 0,
              'raster-opacity-transition': { duration: 150, delay: 0 },
            },
            layout: {
              visibility: showSatellite ? 'visible' : 'none',
            },
          },
          beforeLayer
        );

        currentSatBufferRef.current = 'a';
        lastSatTileUrlRef.current = initialTileUrl;
      } catch (err) {
        console.warn('Satellite double-buffered layer setup error:', err);
      }
    };

    if (!map.isStyleLoaded()) {
      map.once('load', setupSatellite);
    } else {
      setupSatellite();
    }
  }, [satelliteProductKey]);

  // Synchronize Active Frame and Perform Double-Buffered Swap
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof map.getLayer !== 'function') return;

    const effectiveUrl = activeSatelliteTileUrl || satelliteTileUrl;
    if (!effectiveUrl) return;

    const hasLayerA = !!map.getLayer('nasa-gibs-satellite-layer-a');
    const hasLayerB = !!map.getLayer('nasa-gibs-satellite-layer-b');
    if (!hasLayerA || !hasLayerB) return;

    // If active URL hasn't changed, but preload changed, update inactive buffer source
    if (effectiveUrl === lastSatTileUrlRef.current) {
      if (preloadSatelliteTileUrl) {
        const inactiveBuffer = currentSatBufferRef.current === 'a' ? 'b' : 'a';
        const inactiveSrc = map.getSource(`nasa-gibs-satellite-source-${inactiveBuffer}`) as maplibregl.RasterTileSource | undefined;
        if (inactiveSrc && typeof inactiveSrc.setTiles === 'function') {
          try {
            inactiveSrc.setTiles([preloadSatelliteTileUrl]);
          } catch {
            // Ignored
          }
        }
      }
      return;
    }

    lastSatTileUrlRef.current = effectiveUrl;

    const currBuffer = currentSatBufferRef.current;
    const targetBuffer = currBuffer === 'a' ? 'b' : 'a';
    const targetLayerId = `nasa-gibs-satellite-layer-${targetBuffer}`;
    const targetSourceId = `nasa-gibs-satellite-source-${targetBuffer}`;
    const oldLayerId = `nasa-gibs-satellite-layer-${currBuffer}`;
    const oldSourceId = `nasa-gibs-satellite-source-${currBuffer}`;

    try {
      // 1. Ensure target buffer source has the new frame's tile URL
      const targetSrc = map.getSource(targetSourceId) as maplibregl.RasterTileSource | undefined;
      if (targetSrc && typeof targetSrc.setTiles === 'function') {
        targetSrc.setTiles([effectiveUrl]);
      }

      // 2. Crossfade: target buffer becomes visible, old buffer fades out
      if (map.getLayer(targetLayerId)) {
        map.setLayoutProperty?.(targetLayerId, 'visibility', showSatellite ? 'visible' : 'none');
        map.setPaintProperty?.(targetLayerId, 'raster-opacity', showSatellite ? satelliteOpacity / 100 : 0);
      }
      if (map.getLayer(oldLayerId)) {
        map.setPaintProperty?.(oldLayerId, 'raster-opacity', 0);
      }

      // 3. Switch active buffer
      currentSatBufferRef.current = targetBuffer;

      // 4. Preload next frame onto the newly inactive buffer
      if (preloadSatelliteTileUrl) {
        const oldSrc = map.getSource(oldSourceId) as maplibregl.RasterTileSource | undefined;
        if (oldSrc && typeof oldSrc.setTiles === 'function') {
          oldSrc.setTiles([preloadSatelliteTileUrl]);
        }
      }
    } catch {
      // Ignored if map is in transition
    }
  }, [activeSatelliteTileUrl, preloadSatelliteTileUrl, showSatellite, satelliteOpacity, satelliteTileUrl]);

  // Synchronize Satellite Opacity
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof map.getLayer !== 'function') return;
    try {
      const activeLayerId = `nasa-gibs-satellite-layer-${currentSatBufferRef.current}`;
      if (map.getLayer(activeLayerId)) {
        map.setPaintProperty?.(activeLayerId, 'raster-opacity', showSatellite ? satelliteOpacity / 100 : 0);
      }
      // Also support legacy single layer if present in older tests
      if (map.getLayer('nasa-gibs-satellite-layer')) {
        map.setPaintProperty?.('nasa-gibs-satellite-layer', 'raster-opacity', showSatellite ? satelliteOpacity / 100 : 0);
      }
    } catch {
      // Ignored
    }
  }, [satelliteOpacity, showSatellite]);

  // Synchronize Satellite Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof map.getLayer !== 'function') return;
    const visibility = showSatellite ? 'visible' : 'none';
    try {
      const activeLayerId = `nasa-gibs-satellite-layer-${currentSatBufferRef.current}`;
      const inactiveLayerId = `nasa-gibs-satellite-layer-${currentSatBufferRef.current === 'a' ? 'b' : 'a'}`;
      if (map.getLayer(activeLayerId)) {
        map.setLayoutProperty?.(activeLayerId, 'visibility', visibility);
        map.setPaintProperty?.(activeLayerId, 'raster-opacity', showSatellite ? satelliteOpacity / 100 : 0);
      }
      if (map.getLayer(inactiveLayerId)) {
        map.setLayoutProperty?.(inactiveLayerId, 'visibility', visibility);
        map.setPaintProperty?.(inactiveLayerId, 'raster-opacity', 0);
      }
      if (map.getLayer('nasa-gibs-satellite-layer')) {
        map.setLayoutProperty?.('nasa-gibs-satellite-layer', 'visibility', visibility);
      }
    } catch {
      // Ignored
    }
  }, [showSatellite]);

  // Synchronize Simulation Layer Data and Setup
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !simulationGeojson) return;

    const setupSimLayers = () => {
      if (!map.getSource('adyar-simulation-source')) {
        map.addSource('adyar-simulation-source', {
          type: 'geojson',
          data: simulationGeojson,
        });

        map.addLayer({
          id: 'adyar-simulation-fill',
          type: 'fill',
          source: 'adyar-simulation-source',
          paint: {
            'fill-color': [
              'match',
              ['get', 'depth_band'],
              'critical', '#DC2626',
              'moderate', '#FB923C',
              'shallow', '#FEF08A',
              '#60A5FA',
            ],
            'fill-opacity': [
              'match',
              ['get', 'depth_band'],
              'critical', 0.75,
              'moderate', 0.55,
              'shallow', 0.40,
              0.30,
            ],
          },
          layout: {
            visibility: showSimulation ? 'visible' : 'none',
          },
        });

        map.addLayer({
          id: 'adyar-simulation-line',
          type: 'line',
          source: 'adyar-simulation-source',
          paint: {
            'line-color': [
              'match',
              ['get', 'depth_band'],
              'critical', '#7F1D1D',
              'moderate', '#C2410C',
              'shallow', '#CA8A04',
              '#2563EB',
            ],
            'line-width': 1,
            'line-opacity': 0.8,
          },
          layout: {
            visibility: showSimulation ? 'visible' : 'none',
          },
        });
      } else {
        const src = map.getSource('adyar-simulation-source') as maplibregl.GeoJSONSource | undefined;
        if (src && typeof src.setData === 'function') {
          src.setData(simulationGeojson);
        }
      }
    };

    if (!map.isStyleLoaded()) {
      map.once('load', setupSimLayers);
    } else {
      setupSimLayers();
    }
  }, [simulationGeojson]);

  // Synchronize Simulation Layer Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof map.getLayer !== 'function') return;
    const visibility = showSimulation ? 'visible' : 'none';
    if (map.getLayer('adyar-simulation-fill')) {
      map.setLayoutProperty?.('adyar-simulation-fill', 'visibility', visibility);
    }
    if (map.getLayer('adyar-simulation-line')) {
      map.setLayoutProperty?.('adyar-simulation-line', 'visibility', visibility);
    }
  }, [showSimulation]);

  // Synchronize Forecast Scalar Canvas Layer (Phase 3B-3A)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applySync = () => {
      syncForecastScalarLayer(map, {
        response: effectiveForecastGrid,
        productType: forecastProduct,
        timestepIndex: forecastTimestepIndex,
        opacity: forecastOpacity,
        visible: effectiveShowForecast,
      });
    };

    if (!map.isStyleLoaded()) {
      map.once('load', applySync);
    } else {
      applySync();
    }
  }, [
    effectiveShowForecast,
    forecastProduct,
    forecastTimestepIndex,
    forecastOpacity,
    effectiveForecastGrid,
  ]);

  // Synchronize Pressure Isobar Contours & Extrema (Phase 3B-3B)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applySync = () => {
      syncPressureLayers(map, {
        response: effectiveForecastGrid,
        timestepIndex: forecastTimestepIndex,
        intervalHpa: pressureContourInterval,
        visible: effectiveShowPressureContours,
      });
    };

    if (!map.isStyleLoaded()) {
      map.once('load', applySync);
    } else {
      applySync();
    }
  }, [
    effectiveShowPressureContours,
    forecastTimestepIndex,
    pressureContourInterval,
    effectiveForecastGrid,
  ]);

  // Synchronize Wind Particle Streamlines (Phase 3B-3C)
  useEffect(() => {
    const map = mapRef.current;
    const canvas = windCanvasRef.current;
    if (!map || !canvas) return;

    if (!windOverlayManagerRef.current) {
      windOverlayManagerRef.current = new WindOverlayManager();
      windOverlayManagerRef.current.mount(map, canvas, effectiveForecastGrid, forecastTimestepIndex, {
        visible: effectiveShowWindParticles,
        isPlaying: effectiveIsWindPlaying,
        opacity: effectiveWindOpacity,
        density: effectiveWindDensity,
        speedMultiplier: effectiveWindSpeed,
      });
    } else {
      windOverlayManagerRef.current.sync(effectiveForecastGrid, forecastTimestepIndex, {
        visible: effectiveShowWindParticles,
        isPlaying: effectiveIsWindPlaying,
        opacity: effectiveWindOpacity,
        density: effectiveWindDensity,
        speedMultiplier: effectiveWindSpeed,
      });
    }
  }, [
    effectiveShowWindParticles,
    effectiveIsWindPlaying,
    effectiveWindOpacity,
    effectiveWindDensity,
    effectiveWindSpeed,
    forecastTimestepIndex,
    effectiveForecastGrid,
  ]);

  // Synchronize District Forecast Impact Layers (Phase 3D-2B)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applySync = () => {
      syncForecastImpactLayers(map, {
        response: districtImpactResponse,
        selectedDistrict: selectedImpactDistrict,
        opacity: districtImpactOpacity,
        visible: Boolean(showDistrictImpact),
        onSelectDistrict: onSelectImpactDistrict,
      });
    };

    if (!map.isStyleLoaded()) {
      map.once('load', applySync);
    } else {
      applySync();
    }
  }, [
    showDistrictImpact,
    districtImpactResponse,
    selectedImpactDistrict,
    districtImpactOpacity,
    onSelectImpactDistrict,
  ]);

  // Synchronize Flood Vulnerability Points Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sourceId = 'flood-vulnerabilities-source';
    const circleLayerId = 'flood-vulnerabilities-circle';
    const labelLayerId = 'flood-vulnerabilities-label';

    const cleanUp = () => {
      try {
        if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
        if (map.getLayer(circleLayerId)) map.removeLayer(circleLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // ignore style unmount
      }
    };

    if (!showVulnerabilityPoints || !vulnerabilityPoints || vulnerabilityPoints.length === 0) {
      if (map.isStyleLoaded()) cleanUp();
      return;
    }

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: vulnerabilityPoints.map((pt) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: pt.coordinate,
        },
        properties: {
          id: pt.id,
          name: pt.name,
          severity: pt.severity,
          type: pt.type,
          description: pt.description,
          source: pt.source,
          radiusMeters: pt.radiusMeters,
        },
      })),
    };

    const applyLayer = () => {
      cleanUp();
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
      });

      map.addLayer({
        id: circleLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-color': [
            'match',
            ['get', 'severity'],
            'CRITICAL', '#EF4444',
            'HIGH', '#F97316',
            'MODERATE', '#FBBF24',
            '#38BDF8',
          ],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 6, 12, 12, 16, 20],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity': 0.85,
        },
      });

      map.addLayer({
        id: labelLayerId,
        type: 'symbol',
        source: sourceId,
        minzoom: 11,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': '#0F172A',
          'text-halo-width': 1.5,
        },
      });

      map.on('click', circleLayerId, (e) => {
        if (!e.features || !e.features[0]) return;
        const props = e.features[0].properties as any;
        const coords = (e.features[0].geometry as any).coordinates.slice();
        new maplibregl.Popup({ offset: 12 })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family: ui-monospace, monospace; font-size: 11px; padding: 6px; color: #0F172A; max-width: 260px;">
              <div style="font-weight: bold; color: #EA580C; margin-bottom: 2px;">⚠️ ${props.name}</div>
              <div style="font-size: 10px; margin-bottom: 3px; font-weight: 600;">Type: ${props.type} | Severity: ${props.severity}</div>
              <div style="font-size: 10px; color: #334155; margin-bottom: 4px;">${props.description}</div>
              <div style="font-size: 9px; color: #64748B;">Source: ${props.source}</div>
            </div>
          `)
          .addTo(map);
      });

      map.on('mouseenter', circleLayerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', circleLayerId, () => {
        map.getCanvas().style.cursor = '';
      });
    };

    if (map.isStyleLoaded()) {
      applyLayer();
    } else {
      map.once('load', applyLayer);
    }

    return () => {
      if (map.isStyleLoaded()) cleanUp();
    };
  }, [showVulnerabilityPoints, vulnerabilityPoints]);

  // Synchronize Emergency Facilities Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sourceId = 'emergency-facilities-source';
    const circleLayerId = 'emergency-facilities-circle';
    const labelLayerId = 'emergency-facilities-label';

    const cleanUp = () => {
      try {
        if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
        if (map.getLayer(circleLayerId)) map.removeLayer(circleLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // ignore style unmount
      }
    };

    if (!showFacilities || !facilities || facilities.length === 0) {
      if (map.isStyleLoaded()) cleanUp();
      return;
    }

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: facilities.map((fac) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [fac.location.longitude, fac.location.latitude],
        },
        properties: {
          id: fac.id,
          name: fac.name,
          category: fac.category,
          address: fac.address || '',
          phone: fac.phone || '',
          verificationStatus: fac.verificationStatus,
          currentAvailability: fac.currentAvailability,
          source: fac.source || '',
        },
      })),
    };

    const applyLayer = () => {
      cleanUp();
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
      });

      map.addLayer({
        id: circleLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-color': [
            'match',
            ['get', 'category'],
            'HOSPITAL', '#DC2626',
            'SHELTER', '#2563EB',
            'RELIEF_CAMP', '#2563EB',
            'FIRE_STATION', '#D97706',
            '#0D9488',
          ],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 5, 12, 10, 16, 16],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity': 0.9,
        },
      });

      map.addLayer({
        id: labelLayerId,
        type: 'symbol',
        source: sourceId,
        minzoom: 12,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': '#0F172A',
          'text-halo-width': 1.5,
        },
      });

      map.on('click', circleLayerId, (e) => {
        if (!e.features || !e.features[0]) return;
        const props = e.features[0].properties as any;
        const coords = (e.features[0].geometry as any).coordinates.slice();
        new maplibregl.Popup({ offset: 12 })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family: ui-monospace, monospace; font-size: 11px; padding: 6px; color: #0F172A; max-width: 260px;">
              <div style="font-weight: bold; color: #1E3A8A; margin-bottom: 2px;">🏥 ${props.name}</div>
              <div style="font-size: 10px; margin-bottom: 2px; font-weight: 600;">Category: ${props.category}</div>
              <div style="font-size: 10px; color: #334155; margin-bottom: 3px;">${props.address}</div>
              <div style="font-size: 10px; margin-bottom: 2px;">
                Status: <span style="font-weight: bold; color: ${props.verificationStatus === 'OFFICIALLY_VERIFIED' ? '#047857' : '#64748B'}">${props.verificationStatus}</span>
              </div>
              <div style="font-size: 9px; color: #B45309; font-weight: bold; margin-bottom: 3px;">
                ⚠️ Vacancy: ${props.currentAvailability} (Verify before dispatch)
              </div>
              ${props.phone ? `<div style="font-size: 10px; font-weight: 600; color: #0284C7;">📞 ${props.phone}</div>` : ''}
            </div>
          `)
          .addTo(map);
      });

      map.on('mouseenter', circleLayerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', circleLayerId, () => {
        map.getCanvas().style.cursor = '';
      });
    };

    if (map.isStyleLoaded()) {
      applyLayer();
    } else {
      map.once('load', applyLayer);
    }

    return () => {
      if (map.isStyleLoaded()) cleanUp();
    };
  }, [showFacilities, facilities]);

  const handleRecenter = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: initialCenter, zoom: 10 });
      if (onSelectCoordinates) {
        onSelectCoordinates({ lat: initialCenter[1], lon: initialCenter[0], name: 'Mumbai Metropolitan Region' });
      }
    }
  }, [initialCenter, onSelectCoordinates]);

  return (
    <div className={`relative border border-slate-300 rounded overflow-hidden bg-navy-950 ${className}`}>
      {/* Map Canvas */}
      <div ref={mapContainer} className="w-full h-full min-h-[420px]" />

      {/* Forecast Wind Particle Canvas Overlay (Phase 3B-3C) */}
      <canvas
        ref={windCanvasRef}
        data-testid="wind-particle-canvas"
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          display: effectiveShowWindParticles ? 'block' : 'none',
        }}
      />

      {/* Fallback if MapLibre fails */}
      {mapError && (
        <div className="absolute inset-0 bg-navy-950/95 flex flex-col items-center justify-center p-6 text-center text-slate-300 z-30">
          <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
          <h4 className="font-bold text-sm text-white">Geospatial Canvas Initialization Error</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md">{mapError}</p>
        </div>
      )}

      {/* Simulation Warning Banner (Amber/Orange Trust Quarantined Badge) */}
      {showSimulation && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto max-w-xl text-center">
          <div className="bg-amber-950/95 border-2 border-amber-500/90 text-amber-200 px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-xs font-mono font-bold tracking-tight">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
            <span>⚠️ EXPERIMENTAL SIMULATION — NOT VALIDATED FOR OFFICIAL CIVIL DEFENSE</span>
          </div>
        </div>
      )}

      {/* Forecast Scientific Disclosure Banner (Phase 3B-3A, 3B-3B & 3B-3C) */}
      {(effectiveShowForecast || effectiveShowPressureContours || effectiveShowWindParticles) && effectiveForecastGrid && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto max-w-2xl text-center px-2">
          <div className="bg-navy-950/95 border border-sky-500/80 text-sky-200 px-3.5 py-1.5 rounded-lg shadow-xl font-mono text-[11px] space-y-1">
            <div className="flex items-center justify-center gap-2 font-bold text-amber-300">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>Spatial surface reconstructed via mesoscale grid interpolation. Not a raw native-resolution GRIB2 raster.</span>
            </div>
            <div className="text-[10px] text-slate-300 flex items-center justify-center gap-2 flex-wrap border-t border-navy-800 pt-1">
              <span className="text-cyan-300 font-semibold">{effectiveForecastGrid.metadata.model}</span>
              <span>•</span>
              <span>Provider: {effectiveForecastGrid.metadata.provider}</span>
              <span>•</span>
              <span>Run: {effectiveForecastGrid.metadata.runCycle} ({effectiveForecastGrid.metadata.initializationTime})</span>
              <span>•</span>
              <span className="text-amber-300 font-semibold">T+{forecastTimestepIndex.toString().padStart(2, '0')}h</span>
              {effectiveShowPressureContours && (
                <span className="bg-sky-950/90 border border-sky-600/80 text-sky-300 px-1.5 rounded text-[9.5px]">
                  Isobars: MSLP ({pressureContourInterval} hPa) • Extrema (H/L)
                </span>
              )}
              {effectiveShowWindParticles && (
                <span className="bg-emerald-950/90 border border-emerald-600/80 text-emerald-300 px-1.5 rounded text-[9.5px]">
                  Wind Streamlines: 10m Vectors ({effectiveWindDensity} • {effectiveWindSpeed}x)
                </span>
              )}
              {effectiveForecastGrid.metadata.isFallback && (
                <span className="bg-amber-900/80 text-amber-300 px-1 rounded text-[9px] font-bold">
                  FAILOVER ACTIVE
                </span>
              )}
              {effectiveForecastGrid.metadata.isStale && (
                <span className="bg-rose-900/80 text-rose-300 px-1 rounded text-[9px] font-bold">
                  STALE CACHE
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Forecast Product Legend */}
      {effectiveShowForecast && (
        <div className="absolute bottom-6 left-3 z-20 pointer-events-auto max-w-xs bg-navy-950/90 border border-navy-700 p-2 rounded shadow-lg text-slate-200 font-mono text-[10px]">
          <div className="flex items-center justify-between font-bold text-cyan-300 border-b border-navy-800 pb-1 mb-1.5">
            <span>FORECAST: {FORECAST_PRODUCTS[forecastProduct]?.shortLabel.toUpperCase()}</span>
            <span>{FORECAST_PRODUCTS[forecastProduct]?.unit}</span>
          </div>
          {forecastProduct === 'precipitation' ? (
            <div className="space-y-1">
              <div className="text-[9px] text-slate-400">Preceding 1-hour total accumulation (mm)</div>
              <div className="flex items-center gap-1">
                <span className="w-4 h-2 rounded-sm bg-[#67a9cf]" title="0.1 - 2.5 mm (Light)" />
                <span className="w-4 h-2 rounded-sm bg-[#02818a]" title="2.5 - 7.5 mm (Moderate)" />
                <span className="w-4 h-2 rounded-sm bg-[#fed976]" title="7.5 - 15 mm (Heavy)" />
                <span className="w-4 h-2 rounded-sm bg-[#fd8d3c]" title="15 - 30 mm (Very Heavy)" />
                <span className="w-4 h-2 rounded-sm bg-[#e31a1c]" title="30 - 50 mm (Extremely Heavy)" />
                <span className="w-4 h-2 rounded-sm bg-[#800026]" title="50+ mm (Torrential)" />
              </div>
              <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                <span>0.1mm</span>
                <span>15mm</span>
                <span>50+mm</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-[9px] text-slate-400">{FORECAST_PRODUCTS[forecastProduct]?.description}</div>
              <div className="flex items-center gap-1">
                {FORECAST_PRODUCTS[forecastProduct]?.colorRamp.map((cr, idx) => (
                  <span
                    key={idx}
                    className="w-4 h-2 rounded-sm"
                    style={{ backgroundColor: cr.color }}
                    title={cr.label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Flood Vulnerability Points Legend */}
      {showVulnerabilityPoints && (
        <div className="absolute bottom-6 right-3 z-20 pointer-events-auto max-w-xs bg-navy-950/90 border border-amber-700/80 p-2.5 rounded shadow-lg text-slate-200 font-mono text-[10px] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-400 border-b border-navy-800 pb-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>HISTORICAL FLOOD CHOKEPOINTS</span>
          </div>
          <div className="text-[9px] text-slate-400">
            Municipal 2015/2023 Inundation Benchmarks & Surcharge Points
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="flex items-center gap-1 text-[9px]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white" />
              Critical
            </span>
            <span className="flex items-center gap-1 text-[9px]">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-white" />
              High Pinch
            </span>
            <span className="flex items-center gap-1 text-[9px]">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-white" />
              Moderate
            </span>
          </div>
        </div>
      )}

      {/* Emergency Facilities Legend */}
      {showFacilities && (
        <div className="absolute bottom-28 right-3 z-20 pointer-events-auto max-w-xs bg-navy-950/90 border border-sky-700/80 p-2.5 rounded shadow-lg text-slate-200 font-mono text-[10px] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-sky-400 border-b border-navy-800 pb-1">
            <Globe className="w-3.5 h-3.5" />
            <span>EMERGENCY FACILITIES</span>
          </div>
          <div className="flex items-center gap-3 pt-0.5 flex-wrap">
            <span className="flex items-center gap-1 text-[9px]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 border border-white" />
              Hospital
            </span>
            <span className="flex items-center gap-1 text-[9px]">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white" />
              Shelter
            </span>
            <span className="flex items-center gap-1 text-[9px]">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 border border-white" />
              Fire/Ops
            </span>
          </div>
          <div className="text-[8.5px] text-amber-300/90 italic pt-0.5">
            Availability: UNKNOWN (verify before dispatch)
          </div>
        </div>
      )}

      {/* Tactical HUD Header (rendered in standalone mode) */}
      {!hideDefaultControls && variant !== 'full' && (
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 max-w-sm pointer-events-none">
          <div className="bg-navy-900/90 border border-navy-700 pointer-events-auto px-3 py-2 rounded text-slate-200 shadow-md">
            <div className="flex items-center justify-between gap-3 text-xs mb-1 font-mono">
              <span className="text-amber-400 font-bold flex items-center gap-1.5 truncate">
                <Crosshair className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{locationName}</span>
              </span>
              <Badge variant="navy" size="sm">
                {center[1].toFixed(3)}°N, {center[0].toFixed(3)}°E
              </Badge>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between gap-4 pt-1 border-t border-navy-800">
              <span>PRECIP: <strong className="text-slate-200">{rainfallMm} mm/h</strong></span>
              <span>STATUS: <strong className="text-amber-400">{riskLevel}</strong></span>
            </div>
          </div>

          {/* Disclaimer & Interaction Pill */}
          <div className="bg-navy-950/90 border border-navy-800 pointer-events-auto px-2.5 py-1 rounded text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
            <ShieldAlert className="w-3 h-3 text-amber-500 flex-shrink-0" />
            <span>Click anywhere to inspect coordinates. Indicative risk triage only.</span>
          </div>
        </div>
      )}

      {/* Controls Palette: Layer Management & Recenter (rendered in standalone mode) */}
      {!hideDefaultControls && variant !== 'full' && (
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
          {/* Recenter Button */}
          <button
            onClick={handleRecenter}
            className="bg-navy-900/95 hover:bg-navy-800 border border-navy-700 text-slate-200 px-2.5 py-1.5 rounded shadow-md text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Reset to default operational center (Mumbai)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>RECENTER</span>
          </button>

          {/* Tactical Layers Card (Only genuinely implemented layers) */}
          <div className="bg-navy-900/95 border border-navy-700 p-2.5 rounded shadow-md text-xs text-slate-300 font-mono min-w-[200px]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-navy-800 text-slate-400 text-[11px]">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>RADAR OVERLAY</span>
              </div>
              {radarLoading && (
                <span className="text-[10px] text-sky-400 animate-pulse">CONNECTING</span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px]">Global RainViewer Radar</span>
                <button
                  onClick={() => onToggleRadar && onToggleRadar(!showRadar)}
                  disabled={!radarInfo}
                  className="p-1 hover:bg-navy-800 rounded text-slate-300 disabled:opacity-40"
                  title={showRadar ? 'Hide radar overlay' : 'Show radar overlay'}
                >
                  {showRadar ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                </button>
              </div>

              {/* Radar status / attribution metadata */}
              {radarInfo ? (
                <div className="pt-1.5 border-t border-navy-800 text-[10px] text-slate-400 space-y-0.5">
                  <div className="flex justify-between">
                    <span>FRAME TIME:</span>
                    <span className="text-slate-200">
                      {new Date((activeRadarTimestamp || radarInfo.timestamp) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-500">Source: RainViewer Open Composite</div>
                </div>
              ) : radarError ? (
                <div className="pt-1 border-t border-navy-800 text-[10px] text-amber-400">
                  {radarError}
                </div>
              ) : null}

              {/* Satellite Layer Toggle */}
              <div className="pt-2 border-t border-navy-800 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[11px]">NASA GIBS Satellite</span>
                  </div>
                  <button
                    onClick={() => onToggleSatellite && onToggleSatellite(!showSatellite)}
                    className="p-1 hover:bg-navy-800 rounded text-slate-300 cursor-pointer"
                    title={showSatellite ? 'Hide satellite imagery' : 'Show satellite imagery'}
                  >
                    {showSatellite ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                  </button>
                </div>
                {showSatellite && (
                  <div className="text-[9px] text-slate-400 font-mono space-y-0.5">
                    <div>{SATELLITE_PRODUCTS[satelliteProductKey]?.shortLabel || 'Infrared'} • {satelliteOpacity}%</div>
                    {activeSatelliteTimestamp && (
                      <div className="text-[8.5px] text-cyan-300">
                        {new Date(activeSatelliteTimestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Forecast Scalar Canvas Layer */}
              <div className="pt-2 border-t border-navy-800 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <span className="text-[11px]">NWP Forecast Scalar</span>
                  </div>
                  <button
                    onClick={() => {
                      if (onToggleForecast) {
                        onToggleForecast(!effectiveShowForecast);
                      } else {
                        setInternalShowForecast(!effectiveShowForecast);
                      }
                    }}
                    className="p-1 hover:bg-navy-800 rounded text-slate-300 cursor-pointer"
                    title={effectiveShowForecast ? 'Hide forecast scalar overlay' : 'Show forecast scalar overlay'}
                  >
                    {effectiveShowForecast ? <Eye className="w-3.5 h-3.5 text-sky-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                  </button>
                </div>
                {effectiveShowForecast && (
                  <div className="text-[9px] text-slate-400 font-mono space-y-0.5">
                    <div>{FORECAST_PRODUCTS[forecastProduct]?.shortLabel || 'Precipitation'} • {forecastOpacity}%</div>
                    <div className="text-[8.5px] text-amber-300">
                      Step: T+{forecastTimestepIndex.toString().padStart(2, '0')}h
                    </div>
                  </div>
                )}
              </div>

              {/* Pressure Isobar Contours Layer (Phase 3B-3B) */}
              <div className="pt-2 border-t border-navy-800 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="text-[11px]">Pressure Isobars (MSLP)</span>
                  </div>
                  <button
                    onClick={() => {
                      if (onTogglePressureContours) {
                        onTogglePressureContours(!effectiveShowPressureContours);
                      } else {
                        setInternalShowPressureContours(!effectiveShowPressureContours);
                      }
                    }}
                    className="p-1 hover:bg-navy-800 rounded text-slate-300 cursor-pointer"
                    title={effectiveShowPressureContours ? 'Hide pressure isobars overlay' : 'Show pressure isobars overlay'}
                  >
                    {effectiveShowPressureContours ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                  </button>
                </div>
                {effectiveShowPressureContours && (
                  <div className="text-[9px] text-slate-400 font-mono space-y-0.5">
                    <div>MSLP • {pressureContourInterval} hPa interval</div>
                    <div className="text-[8.5px] text-sky-300">
                      Local Extrema: High (H) / Low (L)
                    </div>
                  </div>
                )}
              </div>

              {/* Wind Particle Streamlines (Phase 3B-3C) */}
              <div className="pt-2 border-t border-navy-800 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-[11px] flex items-center gap-1">
                      <Wind className="w-3 h-3 text-emerald-400 inline" />
                      <span>Wind Streamlines</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {effectiveShowWindParticles && (
                      <button
                        onClick={() => {
                          const nextPlay = !effectiveIsWindPlaying;
                          if (onToggleWindPlay) onToggleWindPlay(nextPlay);
                          else setInternalIsWindPlaying(nextPlay);
                        }}
                        className="p-1 hover:bg-navy-800 rounded text-slate-300 cursor-pointer"
                        title={effectiveIsWindPlaying ? 'Pause wind animation' : 'Resume wind animation'}
                      >
                        {effectiveIsWindPlaying ? <Pause className="w-3 h-3 text-emerald-400" /> : <Play className="w-3 h-3 text-slate-400" />}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const next = !effectiveShowWindParticles;
                        if (onToggleWindParticles) onToggleWindParticles(next);
                        else setInternalShowWindParticles(next);
                      }}
                      className="p-1 hover:bg-navy-800 rounded text-slate-300 cursor-pointer"
                      title={effectiveShowWindParticles ? 'Hide wind particle overlay' : 'Show wind particle overlay'}
                    >
                      {effectiveShowWindParticles ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                    </button>
                  </div>
                </div>
                {effectiveShowWindParticles && (
                  <div className="text-[9px] text-slate-400 font-mono space-y-1.5 pt-0.5">
                    <div className="flex items-center justify-between">
                      <span>Density:</span>
                      <div className="flex gap-1">
                        {(['light', 'standard', 'dense'] as WindParticleDensity[]).map((d) => (
                          <button
                            key={d}
                            onClick={() => {
                              if (onChangeWindParticleDensity) onChangeWindParticleDensity(d);
                              else setInternalWindDensity(d);
                            }}
                            className={`px-1 py-0.5 rounded text-[8px] cursor-pointer ${
                              effectiveWindDensity === d
                                ? 'bg-emerald-600 text-white font-bold'
                                : 'bg-navy-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {d.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Speed:</span>
                      <div className="flex gap-1">
                        {[0.5, 1.0, 1.5, 2.0].map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              if (onChangeWindSpeedMultiplier) onChangeWindSpeedMultiplier(s);
                              else setInternalWindSpeed(s);
                            }}
                            className={`px-1 py-0.5 rounded text-[8px] cursor-pointer ${
                              effectiveWindSpeed === s
                                ? 'bg-emerald-600 text-white font-bold'
                                : 'bg-navy-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SFINCS Hydraulic Simulation Layer */}
              {(simulationGeojson || onToggleSimulation) && (
                <div className="pt-2 border-t border-navy-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-amber-400 font-semibold">Adyar SFINCS S2</span>
                    <button
                      onClick={() => onToggleSimulation && onToggleSimulation(!showSimulation)}
                      className="p-1 hover:bg-navy-800 rounded text-slate-300"
                      title={showSimulation ? 'Hide hydrodynamic simulation layer' : 'Show hydrodynamic simulation layer'}
                    >
                      {showSimulation ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                    </button>
                  </div>
                  {showSimulation && (
                    <div className="space-y-0.5">
                      <div className="text-[9px] text-amber-500 font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                        <span>EXPERIMENTAL TIER</span>
                      </div>
                      {simulationMeta && (
                        <div className="text-[9px] text-slate-400 font-mono">
                          Extent: {simulationMeta.total_inundated_area_km2 !== undefined
                            ? `${simulationMeta.total_inundated_area_km2} km²`
                            : simulationMeta.reach_length_km
                            ? `${simulationMeta.reach_length_km} km reach`
                            : 'Adyar reach'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
