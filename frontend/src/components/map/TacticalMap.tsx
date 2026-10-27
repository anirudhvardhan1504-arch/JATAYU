import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Layers, ShieldAlert, Crosshair, RotateCcw, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Badge } from '../common/Badge';
import { getLatestRadarInfo, RainViewerRadarInfo } from '../../services/radar';
import { SimulationMetadata } from '../../services/research';

interface TacticalMapProps {
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
  initialCenter?: [number, number];
  showSimulation?: boolean;
  simulationGeojson?: GeoJSON.FeatureCollection | null;
  simulationMeta?: SimulationMetadata | null;
  onToggleSimulation?: (visible: boolean) => void;
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
  initialCenter = [72.8777, 19.076],
  showSimulation = false,
  simulationGeojson = null,
  simulationMeta = null,
  onToggleSimulation,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [mapError, setMapError] = useState<string | null>(null);
  const [radarInfo, setRadarInfo] = useState<RainViewerRadarInfo | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarError, setRadarError] = useState<string | null>(null);

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
  }, [radarInfo]);

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

      {/* Tactical HUD Header */}
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

      {/* Controls Palette: Layer Management & Recenter */}
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
                    {new Date(radarInfo.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-[9px] text-slate-500">Source: RainViewer Open Composite</div>
              </div>
            ) : radarError ? (
              <div className="pt-1 border-t border-navy-800 text-[10px] text-amber-400">
                {radarError}
              </div>
            ) : null}

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
    </div>
  );
};
