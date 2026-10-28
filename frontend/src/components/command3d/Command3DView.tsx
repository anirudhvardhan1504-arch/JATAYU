import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import {
  Globe,
  ArrowLeft,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Crosshair,
  CloudRain,
  Eye,
  FileDown,
  Layers,
  Waves,
  X,
  Radio,
  Lock,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronRight,
  ChevronLeft,
  Search,
  Wind,
  ShieldAlert,
  Compass,
  CheckCircle,
  Mountain,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getOperationalSectors,
  getGlobeContext,
  OperationalSector,
  GlobeContextSession,
  CommandApiError,
} from '../../services/command';
import { getHistoricalWeather, HistoricalWeatherSeries } from '../../services/weather';
import { getRainViewerTimeline, RadarAnimationFrame } from '../../services/radar';
import { fetchAdyarSimulation, SimulationResponse } from '../../services/research';
import { getDisasterAlerts } from '../../services/alerts';
import { DisasterAlert } from '../../types';
import {
  CycloneEvent,
  CycloneTrackPoint,
  VERIFIED_HISTORICAL_CYCLONES,
  CLASSIFICATION_COLORS,
} from '../../services/cyclone';

interface Command3DViewProps {
  selectedLocation: { name: string; lat: number; lon: number };
  onSelectLocation?: (loc: { name: string; lat: number; lon: number }) => void;
  onReturnTo2D: () => void;
}

export type ImageryProviderType = 'esri' | 'esri_dark' | 'carto_dark' | 'osm';

const cartoApiKey = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_CARTO_API_KEY : undefined;
const arcgisApiKey = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_ARCGIS_API_KEY : undefined;
const ionAccessToken = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_CESIUM_ION_ACCESS_TOKEN : undefined;

export const IMAGERY_CONFIGS: Record<
  ImageryProviderType,
  { label: string; buttonText: string; url: string; subdomains?: string[]; credit: string; maximumLevel: number; watermarked?: boolean }
> = {
  esri: {
    label: 'ESRI World Imagery (Satellite)',
    buttonText: 'ESRI SATELLITE',
    url: arcgisApiKey
      ? `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${arcgisApiKey}`
      : 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    credit:
      'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maximumLevel: 19,
  },
  esri_dark: {
    label: 'ESRI Dark Gray Canvas (Tactical Clean)',
    buttonText: 'ESRI DARK',
    url: arcgisApiKey
      ? `https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}?token=${arcgisApiKey}`
      : 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    credit: 'Tiles © Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community',
    maximumLevel: 16,
  },
  carto_dark: {
    label: 'CartoDB Dark Matter (Tactical Night)',
    buttonText: 'CARTO DARK',
    url: cartoApiKey
      ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?api_key=${cartoApiKey}`
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    credit: '© OpenStreetMap contributors, © CARTO',
    maximumLevel: 19,
    watermarked: !cartoApiKey,
  },
  osm: {
    label: 'OpenStreetMap Standard (Tactical Vector)',
    buttonText: 'OPENSTREETMAP',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    credit: '© OpenStreetMap contributors',
    maximumLevel: 19,
  },
};

export const Command3DView: React.FC<Command3DViewProps> = ({
  selectedLocation,
  onSelectLocation,
  onReturnTo2D,
}) => {
  const { token, user, invalidateSession } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const eventHandlerRef = useRef<any>(null);

  // Surface & Overlay Layer States
  const [activeImagery, setActiveImagery] = useState<ImageryProviderType>('esri');
  const [cloudsEnabled, setCloudsEnabled] = useState<boolean>(false);
  const [radarEnabled, setRadarEnabled] = useState<boolean>(false);
  const [precipEnabled, setPrecipEnabled] = useState<boolean>(false);
  const [isLayersOpen, setIsLayersOpen] = useState<boolean>(false);
  const [terrainEnabled, setTerrainEnabled] = useState<boolean>(Boolean(ionAccessToken));
  const [cycloneTrackEnabled, setCycloneTrackEnabled] = useState<boolean>(true);

  // Responsive Drawer Mutual Exclusion Handlers
  const handleToggleLayers = useCallback(() => {
    setIsLayersOpen((prev) => {
      const next = !prev;
      if (next && typeof window !== 'undefined' && window.innerWidth < 768) {
        setIsStormPanelOpen(false);
      }
      return next;
    });
  }, []);

  const handleToggleStormPanel = useCallback(() => {
    setIsStormPanelOpen((prev) => {
      const next = !prev;
      if (next && typeof window !== 'undefined' && window.innerWidth < 768) {
        setIsLayersOpen(false);
      }
      return next;
    });
  }, []);

  // Hydrodynamic SFINCS States (quarantined under Tier 3 RBAC)
  const [sfincsEnabled, setSfincsEnabled] = useState<boolean>(false);
  const [sfincsLoading, setSfincsLoading] = useState<boolean>(false);
  const [_sfincsData, setSfincsData] = useState<SimulationResponse | null>(null);
  const [sfincsError, setSfincsError] = useState<string | null>(null);

  // Spatial Inspection States
  const [isInspectMode, setIsInspectMode] = useState<boolean>(false);
  const [inspectLoading, setInspectLoading] = useState<boolean>(false);
  const [inspectResult, setInspectResult] = useState<HistoricalWeatherSeries | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Cyclone Intelligence States (Zoom Earth Inspired)
  const [selectedCyclone, setSelectedCyclone] = useState<CycloneEvent | null>(VERIFIED_HISTORICAL_CYCLONES[0]);
  const [selectedTrackPoint, setSelectedTrackPoint] = useState<CycloneTrackPoint | null>(
    VERIFIED_HISTORICAL_CYCLONES[0].track[4] // Peak off Chennai
  );
  const [isStormPanelOpen, setIsStormPanelOpen] = useState<boolean>(true);
  const [stormTab, setStormTab] = useState<'DETAILS' | 'TABLE' | 'ARCHIVES'>('DETAILS');
  const [activeStormTypeFilter, setActiveStormTypeFilter] = useState<'ALL' | 'OBSERVED' | 'FORECAST'>('ALL');

  // Timeline & Playback States
  const [radarFrames, setRadarFrames] = useState<RadarAnimationFrame[]>([]);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2>(1);

  // Warnings & Sector States
  const [officialAlerts, setOfficialAlerts] = useState<DisasterAlert[]>([]);
  const [isWarningsModalOpen, setIsWarningsModalOpen] = useState<boolean>(false);
  const [warningsLoading, setWarningsLoading] = useState<boolean>(false);
  const [_sectors, setSectors] = useState<OperationalSector[]>([]);
  const [_globeContext, setGlobeContext] = useState<GlobeContextSession | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [isObliqueView, setIsObliqueView] = useState<boolean>(true);

  // Search States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Array<{ name: string; lat: number; lon: number; admin?: string }>>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);

  // Cesium Resource References
  const cloudsLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const radarLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const sfincsDataSourceRef = useRef<Cesium.GeoJsonDataSource | null>(null);
  const stormEntitiesRef = useRef<Cesium.Entity[]>([]);
  const inspectEntityRef = useRef<Cesium.Entity | null>(null);

  const isInspectModeRef = useRef(isInspectMode);
  useEffect(() => {
    isInspectModeRef.current = isInspectMode;
  }, [isInspectMode]);

  // 1. Fetch Backend Operational Sectors & Globe Context
  useEffect(() => {
    let isSubscribed = true;
    if (!token) return;

    Promise.allSettled([getGlobeContext(token), getOperationalSectors(token)]).then(
      ([ctxRes, secRes]) => {
        if (!isSubscribed) return;

        if (ctxRes.status === 'fulfilled') {
          setGlobeContext(ctxRes.value.session);
        } else {
          const err = ctxRes.reason;
          if (err instanceof CommandApiError && err.statusCode === 401) {
            invalidateSession('Session expired while fetching 3D command context.');
          }
        }

        if (secRes.status === 'fulfilled') {
          setSectors(secRes.value.sectors);
        } else {
          const err = secRes.reason;
          if (err instanceof CommandApiError && err.statusCode === 401) {
            invalidateSession('Session expired while fetching command sectors.');
          }
        }
      }
    );

    return () => {
      isSubscribed = false;
    };
  }, [token, invalidateSession]);

  // 2. Fetch Radar Timeline
  useEffect(() => {
    let isSubscribed = true;
    getRainViewerTimeline().then((timeline) => {
      if (!isSubscribed || !timeline || timeline.radarFrames.length === 0) return;
      setRadarFrames(timeline.radarFrames);
      setActiveFrameIndex(timeline.radarFrames.length - 1);
    });
    return () => {
      isSubscribed = false;
    };
  }, []);

  // 3. Fetch Official Regional Alerts
  useEffect(() => {
    let isSubscribed = true;
    setWarningsLoading(true);
    getDisasterAlerts(selectedLocation.lat, selectedLocation.lon, selectedLocation.name)
      .then((res) => {
        if (!isSubscribed) return;
        setOfficialAlerts(res.officialAlerts || []);
      })
      .catch(() => {
        if (!isSubscribed) return;
        setOfficialAlerts([]);
      })
      .finally(() => {
        if (isSubscribed) setWarningsLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [selectedLocation]);

  // 4. Timeline Playback Loop
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = playbackSpeed === 2 ? 800 : 1500;
    const timer = setInterval(() => {
      if (selectedCyclone && selectedCyclone.track.length > 0) {
        setSelectedTrackPoint((prev) => {
          if (!prev) return selectedCyclone.track[0];
          const curIdx = selectedCyclone.track.findIndex((p) => p.id === prev.id);
          const nextIdx = (curIdx + 1) % selectedCyclone.track.length;
          return selectedCyclone.track[nextIdx];
        });
      } else if (radarFrames.length > 0) {
        setActiveFrameIndex((prev) => (prev + 1) % radarFrames.length);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, selectedCyclone, radarFrames.length]);

  // Handler for Spatial Point Inspection
  const handleInspectPoint = useCallback(
    async (lat: number, lon: number) => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      if (inspectEntityRef.current) {
        try {
          viewer.entities.remove(inspectEntityRef.current);
        } catch {
          // ignore
        }
        inspectEntityRef.current = null;
      }

      try {
        inspectEntityRef.current = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
          point: {
            pixelSize: 14,
            color: Cesium.Color?.fromCssColorString ? Cesium.Color.fromCssColorString('#f43f5e') : Cesium.Color?.RED,
            outlineColor: Cesium.Color?.WHITE,
            outlineWidth: 3,
          },
          label: Cesium.LabelStyle
            ? {
                text: `INSPECT: ${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`,
                font: '11px monospace',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: Cesium.Color?.WHITE,
                outlineColor: Cesium.Color?.BLACK,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin?.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -18),
              }
            : undefined,
        });
      } catch (e) {
        console.warn('Error adding inspection entity:', e);
      }

      setInspectLoading(true);
      setInspectError(null);
      try {
        const res = await getHistoricalWeather(
          lat,
          lon,
          '2023-12-01',
          '2023-12-06',
          `Point ${lat.toFixed(3)}N, ${lon.toFixed(3)}E`
        );
        setInspectResult(res);
      } catch (err: any) {
        setInspectError(err.message || 'Failed to query historical rainfall archive.');
        setInspectResult(null);
      } finally {
        setInspectLoading(false);
      }
    },
    []
  );

  const handleInspectPointRef = useRef(handleInspectPoint);
  useEffect(() => {
    handleInspectPointRef.current = handleInspectPoint;
  }, [handleInspectPoint]);

  // 5. Initialize Cesium Viewer
  useEffect(() => {
    if (!containerRef.current) return;
    let viewer: Cesium.Viewer | null = null;

    try {
      if (ionAccessToken && Cesium.Ion) {
        Cesium.Ion.defaultAccessToken = ionAccessToken;
      }

      let terrainInstance: any = undefined;
      if (ionAccessToken && Cesium.Terrain?.fromWorldTerrain) {
        try {
          terrainInstance = Cesium.Terrain.fromWorldTerrain({
            requestVertexNormals: true,
            requestWaterMask: true,
          });
        } catch (terrErr) {
          console.warn('Failed to construct Cesium World Terrain:', terrErr);
        }
      }

      viewer = new Cesium.Viewer(containerRef.current, {
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        selectionIndicator: false,
        shadows: false,
        shouldAnimate: false,
        ...(terrainInstance ? { terrain: terrainInstance } : {}),
      });

      // Atmosphere, depth, lighting & curvature
      if (viewer.scene) {
        if (viewer.scene.globe) {
          viewer.scene.globe.enableLighting = true;
          viewer.scene.globe.showGroundAtmosphere = true;
          viewer.scene.globe.depthTestAgainstTerrain = Boolean(terrainInstance);
          if (Cesium.Color?.fromCssColorString) {
            viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#020617');
          }
        }
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.show = true;
        }
        if (viewer.scene.fog) {
          viewer.scene.fog.enabled = true;
          viewer.scene.fog.density = 0.0001;
        }
      }

      // Base imagery
      const cfg = IMAGERY_CONFIGS[activeImagery];
      if (viewer.imageryLayers?.removeAll) {
        viewer.imageryLayers.removeAll();
      }

      if (Cesium.UrlTemplateImageryProvider) {
        const provider = new Cesium.UrlTemplateImageryProvider({
          url: cfg.url,
          subdomains: cfg.subdomains,
          credit: Cesium.Credit ? new Cesium.Credit(cfg.credit) : (cfg.credit as any),
          maximumLevel: cfg.maximumLevel,
        });
        if (viewer.imageryLayers?.addImageryProvider) {
          viewer.imageryLayers.addImageryProvider(provider);
        }
      }

      // Initial camera setup looking at Indian Ocean / subcontinent
      const initialLat = selectedLocation?.lat ?? 13.0827;
      const initialLon = selectedLocation?.lon ?? 80.2707;
      const initialHeight = 1800000;

      if (viewer.camera?.setView) {
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(initialLon + 1.5, initialLat - 3.5, initialHeight),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-40),
            roll: 0.0,
          },
        });
      }

      // ScreenSpaceEventHandler for inspection & point clicks
      if (viewer.canvas && Cesium.ScreenSpaceEventHandler) {
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        handler.setInputAction((click: any) => {
          if (!viewer || viewer.isDestroyed()) return;

          if (isInspectModeRef.current) {
            const ray = viewer.camera?.getPickRay ? viewer.camera.getPickRay(click.position) : null;
            if (ray && viewer.scene?.globe?.pick) {
              const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
              if (cartesian) {
                const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                const lon = Cesium.Math.toDegrees(cartographic.longitude);
                const lat = Cesium.Math.toDegrees(cartographic.latitude);
                handleInspectPointRef.current(lat, lon);
                return;
              }
            }
          }

          // Pick cyclone waypoint entities
          if (viewer.scene?.pick) {
            const picked = viewer.scene.pick(click.position);
            if (picked?.id?.id?.startsWith('track-pt-')) {
              const ptId = picked.id.id.replace('track-pt-', '');
              if (selectedCyclone) {
                const pt = selectedCyclone.track.find((p) => p.id === ptId);
                if (pt) {
                  setSelectedTrackPoint(pt);
                  setIsStormPanelOpen(true);
                }
              }
            }
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        eventHandlerRef.current = handler;
      }

      viewerRef.current = viewer;
      setInitError(null);
    } catch (err: any) {
      console.error('Cesium WebGL initialization failure:', err);
      setInitError(err.message || 'WebGL context initialization failed. Please verify GPU acceleration.');
    }

    return () => {
      if (eventHandlerRef.current && !eventHandlerRef.current.isDestroyed?.()) {
        try {
          eventHandlerRef.current.destroy();
        } catch {
          // ignore
        }
        eventHandlerRef.current = null;
      }

      if (viewer && !viewer.isDestroyed()) {
        try {
          viewer.destroy();
        } catch (e) {
          console.warn('Error during Cesium viewer destruction:', e);
        }
      }
      viewerRef.current = null;
    };
  }, []);

  // 5b. Dynamic Terrain Switching
  const isFirstTerrainEffect = useRef(true);
  useEffect(() => {
    if (isFirstTerrainEffect.current) {
      isFirstTerrainEffect.current = false;
      return;
    }
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed?.() || !viewer.scene) return;

    try {
      if (terrainEnabled && ionAccessToken && Cesium.Terrain?.fromWorldTerrain) {
        if (viewer.scene.setTerrain) {
          const terrain = Cesium.Terrain.fromWorldTerrain({
            requestVertexNormals: true,
            requestWaterMask: true,
          });
          viewer.scene.setTerrain(terrain);
        }
        if (viewer.scene.globe) {
          viewer.scene.globe.depthTestAgainstTerrain = true;
        }
      } else if (!terrainEnabled && Cesium.EllipsoidTerrainProvider) {
        if (viewer.scene.setTerrain && Cesium.Terrain) {
          viewer.scene.setTerrain(new Cesium.Terrain(Promise.resolve(new Cesium.EllipsoidTerrainProvider())));
        } else if ('terrainProvider' in (viewer.scene as any)) {
          (viewer.scene as any).terrainProvider = new Cesium.EllipsoidTerrainProvider();
        }
        if (viewer.scene.globe) {
          viewer.scene.globe.depthTestAgainstTerrain = false;
        }
      }
    } catch (e) {
      console.warn('Terrain toggle error:', e);
    }
  }, [terrainEnabled]);

  // 6. Update Base Imagery Layer on change
  const isFirstImageryEffect = useRef(true);
  useEffect(() => {
    if (isFirstImageryEffect.current) {
      isFirstImageryEffect.current = false;
      return;
    }

    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !viewer.imageryLayers) return;

    try {
      const cfg = IMAGERY_CONFIGS[activeImagery];
      if (viewer.imageryLayers.length > 0) {
        const baseLayer = viewer.imageryLayers.get(0);
        if (baseLayer) {
          viewer.imageryLayers.remove(baseLayer, true);
        }
      }

      if (Cesium.UrlTemplateImageryProvider) {
        const provider = new Cesium.UrlTemplateImageryProvider({
          url: cfg.url,
          subdomains: cfg.subdomains,
          credit: Cesium.Credit ? new Cesium.Credit(cfg.credit) : (cfg.credit as any),
          maximumLevel: cfg.maximumLevel,
        });
        viewer.imageryLayers.addImageryProvider(provider, 0);
      }
    } catch (err) {
      console.warn('Failed to switch base imagery layer:', err);
    }
  }, [activeImagery]);

  // 7. Satellite Clouds Layer (NASA GIBS MODIS Terra)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !viewer.imageryLayers) return;

    if (cloudsLayerRef.current) {
      try {
        viewer.imageryLayers.remove(cloudsLayerRef.current, true);
      } catch {
        // ignore
      }
      cloudsLayerRef.current = null;
    }

    if (cloudsEnabled) {
      try {
        const dateStr = selectedCyclone?.bulletinTime
          ? selectedCyclone.bulletinTime.split('T')[0]
          : '2023-12-04';
        const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${dateStr}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
        const provider = new Cesium.UrlTemplateImageryProvider({
          url,
          maximumLevel: 9,
          credit: Cesium.Credit ? new Cesium.Credit('Imagery © NASA GIBS / EOSDIS') : ('Imagery © NASA GIBS / EOSDIS' as any),
        });
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        if (layer) {
          layer.alpha = 0.75;
        }
        cloudsLayerRef.current = layer || null;
      } catch (e) {
        console.warn('Failed to load NASA GIBS cloud layer:', e);
      }
    }
  }, [cloudsEnabled, selectedCyclone]);

  // 8. Doppler Radar Observation Layer (RainViewer Mosaic)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !viewer.imageryLayers) return;

    if (radarLayerRef.current) {
      try {
        viewer.imageryLayers.remove(radarLayerRef.current, true);
      } catch {
        // ignore
      }
      radarLayerRef.current = null;
    }

    if (radarEnabled && radarFrames.length > 0) {
      try {
        const frame = radarFrames[activeFrameIndex] || radarFrames[radarFrames.length - 1];
        const provider = new Cesium.UrlTemplateImageryProvider({
          url: frame.tileUrl,
          maximumLevel: 19,
          credit: Cesium.Credit ? new Cesium.Credit('Radar © RainViewer') : ('Radar © RainViewer' as any),
        });
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        if (layer) {
          layer.alpha = 0.85;
        }
        radarLayerRef.current = layer || null;
      } catch (e) {
        console.warn('Failed to load RainViewer radar layer in Cesium:', e);
      }
    }
  }, [radarEnabled, radarFrames, activeFrameIndex]);

  // 9. Quarantined Adyar Hydrodynamic Inundation (SFINCS 28km reach)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !viewer.dataSources) return;

    if (sfincsDataSourceRef.current) {
      try {
        viewer.dataSources.remove(sfincsDataSourceRef.current, true);
      } catch {
        // ignore
      }
      sfincsDataSourceRef.current = null;
    }

    if (sfincsEnabled) {
      if (user?.role !== 'RESEARCHER') {
        setSfincsError('Access Restricted: Tier-3 RBAC required (EXPERIMENTAL_UNVALIDATED). Log in as RESEARCHER.');
        return;
      }
      setSfincsError(null);
      setSfincsLoading(true);

      fetchAdyarSimulation(token || '')
        .then((data) => {
          setSfincsData(data);
          const geojson = data.geojson || data.contours;
          if (!geojson || !viewer || viewer.isDestroyed()) return;

          Cesium.GeoJsonDataSource.load(geojson as any, {
            stroke: Cesium.Color?.fromCssColorString ? Cesium.Color.fromCssColorString('#38bdf8') : Cesium.Color?.CYAN,
            fill: Cesium.Color?.fromCssColorString ? Cesium.Color.fromCssColorString('#0284c7').withAlpha(0.45) : Cesium.Color?.BLUE,
            strokeWidth: 2,
            clampToGround: true,
          })
            .then((ds) => {
              if (!viewer || viewer.isDestroyed()) return;
              viewer.dataSources.add(ds);
              sfincsDataSourceRef.current = ds;

              if (viewer.camera?.flyTo) {
                viewer.camera.flyTo({
                  destination: Cesium.Cartesian3.fromDegrees(80.20, 12.96, 42000),
                  orientation: {
                    heading: Cesium.Math.toRadians(0),
                    pitch: Cesium.Math.toRadians(-45),
                    roll: 0.0,
                  },
                  duration: 2.0,
                });
              }
            })
            .catch((err) => {
              console.warn('Cesium GeoJson load failure:', err);
              setSfincsError('Failed to parse simulation GeoJSON contours.');
            });
        })
        .catch((err) => {
          console.warn('Simulation fetch error:', err);
          setSfincsError(err.message || 'Failed to fetch Adyar hydrodynamic simulation.');
        })
        .finally(() => {
          setSfincsLoading(false);
        });
    }
  }, [sfincsEnabled, user?.role, token]);

  // 10. Render 3D Cyclone Track & Uncertainty Cone on Cesium Globe
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !viewer.entities?.add) return;

    // Clean up previous storm entities
    stormEntitiesRef.current.forEach((ent) => {
      try {
        viewer.entities.remove(ent);
      } catch {
        // ignore
      }
    });
    stormEntitiesRef.current = [];

    if (!selectedCyclone || selectedCyclone.track.length === 0 || !cycloneTrackEnabled) return;

    try {
      const track = selectedCyclone.track;
      const observedPoints = track.filter((p) => p.type === 'OBSERVED');
      const forecastPoints = track.filter((p) => p.type === 'FORECAST');

      // 10a. Polyline for Observed Track (Solid Glowing Amber/Cyan)
      if (observedPoints.length > 1) {
        const obsPositions = observedPoints.map((p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 1000));
        const obsLine = viewer.entities.add({
          name: `${selectedCyclone.name} Observed Track`,
          polyline: {
            positions: obsPositions,
            width: 4,
            material: Cesium.PolylineGlowMaterialProperty
              ? new Cesium.PolylineGlowMaterialProperty({
                  glowPower: 0.25,
                  color: Cesium.Color?.fromCssColorString ? Cesium.Color.fromCssColorString('#f59e0b') : Cesium.Color?.YELLOW,
                })
              : (Cesium.Color?.fromCssColorString ? Cesium.Color.fromCssColorString('#f59e0b') : Cesium.Color?.YELLOW),
          },
        });
        stormEntitiesRef.current.push(obsLine);
      }

      // 10b. Polyline for Forecast Track (Dashed / Purple/Rose)
      if (forecastPoints.length > 0 && observedPoints.length > 0) {
        const lastObs = observedPoints[observedPoints.length - 1];
        const fcPositions = [lastObs, ...forecastPoints].map((p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 1000));
        const fcLine = viewer.entities.add({
          name: `${selectedCyclone.name} Forecast Track`,
          polyline: {
            positions: fcPositions,
            width: 3,
            material: Cesium.PolylineDashMaterialProperty
              ? new Cesium.PolylineDashMaterialProperty({
                  color: Cesium.Color?.fromCssColorString ? Cesium.Color.fromCssColorString('#a855f7') : Cesium.Color?.PURPLE,
                  dashLength: 16,
                })
              : (Cesium.Color?.fromCssColorString ? Cesium.Color.fromCssColorString('#a855f7') : Cesium.Color?.PURPLE),
          },
        });
        stormEntitiesRef.current.push(fcLine);
      }

      // 10c. Track Waypoint Point Entities
      track.forEach((pt) => {
        const isSelectedPoint = selectedTrackPoint?.id === pt.id;
        const colorCfg = CLASSIFICATION_COLORS[pt.classification] || CLASSIFICATION_COLORS.CYCLONIC_STORM;
        const ptColor = Cesium.Color?.fromCssColorString
          ? Cesium.Color.fromCssColorString(colorCfg.hex)
          : Cesium.Color?.YELLOW;

        const ent = viewer.entities.add({
          id: `track-pt-${pt.id}`,
          name: `${pt.classificationLabel} (${pt.timeIST})`,
          position: Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, 2000),
          point: {
            pixelSize: isSelectedPoint ? 18 : 10,
            color: ptColor,
            outlineColor: isSelectedPoint ? Cesium.Color?.WHITE : Cesium.Color?.BLACK,
            outlineWidth: isSelectedPoint ? 3 : 1.5,
          },
          label: Cesium.LabelStyle
            ? {
                text: `${pt.windKmh} km/h`,
                font: isSelectedPoint ? 'bold 11px monospace' : '9px monospace',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: Cesium.Color?.WHITE,
                outlineColor: Cesium.Color?.BLACK,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin?.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -14),
                distanceDisplayCondition: Cesium.DistanceDisplayCondition
                  ? new Cesium.DistanceDisplayCondition(0, 7000000)
                  : undefined,
              }
            : undefined,
        });
        stormEntitiesRef.current.push(ent);

        // 10d. Uncertainty Cone / Corridor for Forecast Points
        if (pt.type === 'FORECAST' && pt.coneRadiusKm && Cesium.Cartesian3.fromDegrees) {
          const coneEnt = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, 0),
            ellipse: {
              semiMinorAxis: pt.coneRadiusKm * 1000,
              semiMajorAxis: pt.coneRadiusKm * 1000,
              material: Cesium.Color?.fromCssColorString
                ? Cesium.Color.fromCssColorString('#a855f7').withAlpha(0.18)
                : Cesium.Color?.PURPLE,
              outline: true,
              outlineColor: Cesium.Color?.fromCssColorString
                ? Cesium.Color.fromCssColorString('#c084fc').withAlpha(0.6)
                : Cesium.Color?.PURPLE,
            },
          });
          stormEntitiesRef.current.push(coneEnt);
        }
      });
    } catch (e) {
      console.warn('Failed to render cyclone track on Cesium:', e);
    }
  }, [selectedCyclone, selectedTrackPoint, cycloneTrackEnabled]);

  // 11. Fly to Selected Track Point or Location
  const handleSelectWaypoint = (pt: CycloneTrackPoint) => {
    setSelectedTrackPoint(pt);
    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed() && viewer.camera?.flyTo) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat - 2.0, 650000),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-38),
          roll: 0.0,
        },
        duration: 1.8,
      });
    }
  };

  // 12. City / Locality Search Handler
  const handleSearchSelect = (loc: { name: string; lat: number; lon: number }) => {
    setSearchQuery(loc.name);
    setShowSearchDropdown(false);
    if (onSelectLocation) onSelectLocation(loc);

    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed() && viewer.camera?.flyTo) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(loc.lon, loc.lat - 2.0, 500000),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-38),
          roll: 0.0,
        },
        duration: 1.8,
      });
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const coordMatch = searchQuery.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[3]);
      handleSearchSelect({ name: `Coordinates ${lat.toFixed(3)}, ${lon.toFixed(3)}`, lat, lon });
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          searchQuery
        )}&count=5&language=en&format=json`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          setSearchResults(
            data.results.map((r: any) => ({
              name: `${r.name}${r.admin1 ? `, ${r.admin1}` : ''}`,
              lat: r.latitude,
              lon: r.longitude,
              admin: r.country,
            }))
          );
          setShowSearchDropdown(true);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  };

  // Camera HUD Controls
  const handleZoom = (direction: 'in' | 'out') => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !viewer.camera) return;
    try {
      const height = viewer.camera.positionCartographic?.height ?? 1000000;
      const step = height * 0.4;
      if (direction === 'in' && viewer.camera.zoomIn) {
        viewer.camera.zoomIn(step);
      } else if (direction === 'out' && viewer.camera.zoomOut) {
        viewer.camera.zoomOut(step);
      }
    } catch (e) {
      console.warn('Zoom error:', e);
    }
  };

  const handleToggleTilt = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !viewer.camera?.flyTo) return;

    const nextOblique = !isObliqueView;
    setIsObliqueView(nextOblique);

    const lat = selectedTrackPoint?.lat ?? selectedLocation.lat;
    const lon = selectedTrackPoint?.lon ?? selectedLocation.lon;
    const targetPitch = nextOblique ? -38 : -85;
    const latOffset = nextOblique ? -2.2 : 0;
    const altitude = nextOblique ? 750000 : 500000;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat + latOffset, altitude),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(targetPitch),
        roll: 0.0,
      },
      duration: 1.5,
    });
  };

  const handleResetOverview = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !viewer.camera?.flyTo) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(80.5, 15.0, 2500000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-40),
        roll: 0.0,
      },
      duration: 2.0,
    });
    setIsObliqueView(true);
  };

  const handleRecenterStorm = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !viewer.camera?.flyTo) return;

    const lat = selectedTrackPoint?.lat ?? selectedLocation.lat;
    const lon = selectedTrackPoint?.lon ?? selectedLocation.lon;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat - 2.2, 650000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-38),
        roll: 0.0,
      },
      duration: 1.8,
    });
    setIsObliqueView(true);
  };

  // Export Research Markdown Brief
  const handleExportBrief = () => {
    if (!selectedCyclone) return;
    const content = `# JATAYU Cyclone Intelligence & Meteorological Brief
**Storm Name:** ${selectedCyclone.name} (${selectedCyclone.season})
**Basin:** ${selectedCyclone.basin}
**Issuing Authority:** ${selectedCyclone.issuingAuthority}
**Report Generated:** ${new Date().toISOString()}

## Key Intensity Telemetry
- **Peak Classification:** ${selectedCyclone.intensityLabel}
- **Maximum Sustained Winds:** ${selectedCyclone.maxWindKmh} km/h (${selectedCyclone.maxWindKnots} kt)
- **Minimum Central Pressure:** ${selectedCyclone.minPressureHpa} hPa
- **Advisory Summary:** ${selectedCyclone.latestAdvisory}

## Chronological Track History & Best Track Fixes
| Time (IST) | Type | Lat (°N) | Lon (°E) | Wind (km/h) | Pressure (hPa) | Classification |
|---|---|---|---|---|---|---|
${selectedCyclone.track
  .map(
    (p) =>
      `| ${p.timeIST} | ${p.type} | ${p.lat.toFixed(2)} | ${p.lon.toFixed(2)} | ${p.windKmh} | ${p.pressureHpa} | ${p.classificationLabel} |`
  )
  .join('\n')}

---
*Provenance Notice: Official IMD Best Track Dataset. JATAYU Earth & Climate Observatory strictly preserves meteorological integrity.*
`;

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JATAYU_Cyclone_${selectedCyclone.name.replace(/\s+/g, '_')}_Brief.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (initError) {
    return (
      <div className="h-[750px] w-full rounded-lg bg-navy-950 border border-navy-800 flex flex-col items-center justify-center p-8 text-slate-300">
        <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-700/60 flex items-center justify-center text-red-400 mb-6">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-base font-mono font-bold tracking-wider text-white uppercase mb-2">
          3D WebGL Initialization Failed
        </h3>
        <p className="max-w-md text-center text-xs text-slate-400 mb-6 font-sans">
          {initError}. Please verify hardware acceleration in your browser settings or fall back to
          the 2D MapLibre tactical map.
        </p>
        <button
          onClick={onReturnTo2D}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-navy-950 font-mono font-bold text-xs rounded transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>RETURN TO 2D MAPLIBRE CONSOLE</span>
        </button>
      </div>
    );
  }

  const currentDisplayPoint = selectedTrackPoint || selectedCyclone?.track[0] || null;
  const currentClassCfg = currentDisplayPoint
    ? CLASSIFICATION_COLORS[currentDisplayPoint.classification] || CLASSIFICATION_COLORS.CYCLONIC_STORM
    : CLASSIFICATION_COLORS.CYCLONIC_STORM;

  return (
    <div className="w-full h-full relative overflow-hidden bg-navy-950 flex flex-col select-none">
      {/* Cesium 3D Planetary Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Floating Tactical Overlay System */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-4 overflow-hidden z-10">
        
        {/* Top Intelligence & Search Header Bar (Zoom Earth Style) */}
        <div className="pointer-events-auto flex items-center justify-between gap-2.5 flex-wrap bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-xl px-3 py-2 shadow-2xl">
          {/* Left Brand & Return */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onReturnTo2D}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600/70 rounded-lg text-xs font-mono font-semibold transition-all hover:border-amber-400/80 shadow-sm"
              title="Return to 2D MapLibre Tactical Map"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">2D TACTICAL MAP</span>
            </button>

            <div className="h-4 w-px bg-slate-700 hidden sm:block" />

            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span className="font-mono text-xs font-bold text-white tracking-wide uppercase">
                GOD’S EYE VIEW — CESIUM 3D COMMAND GLOBE
              </span>
              <span className="hidden lg:inline-flex px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80 text-[10px] font-mono text-cyan-300 font-semibold">
                CYCLONE INTELLIGENCE
              </span>
              <span className="hidden xl:inline-flex px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
                ROLE: {user?.role || 'CITIZEN'}
              </span>
            </div>
          </div>

          {/* Center: Search City & Coordinates Bar */}
          <div className="relative flex-1 max-w-xs sm:max-w-sm mx-auto">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowSearchDropdown(true);
                }}
                placeholder="Search city, basin, or coords..."
                className="w-full pl-8 pr-16 py-1 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-sans transition-colors"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-cyan-300 rounded border border-slate-700 font-semibold"
              >
                {isSearching ? '...' : 'FIND'}
              </button>
            </form>

            {/* Autocomplete Suggestions Dropdown */}
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 max-h-48 overflow-y-auto">
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSearchSelect(item)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 flex items-center justify-between border-b border-slate-800/60 last:border-0"
                  >
                    <span className="font-medium truncate">{item.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.lat.toFixed(2)}°, {item.lon.toFixed(2)}°
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Quick Action Controls (Warnings, 2D/3D, Base Imagery) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Official Warnings Trigger Button */}
            <button
              onClick={() => setIsWarningsModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-mono font-semibold transition-all shadow-sm"
              title="View Active Official IMD / NDMA Warnings"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="hidden md:inline">OFFICIAL WARNINGS</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
                {officialAlerts.length}
              </span>
            </button>

            {/* Base Imagery Selector (preserves required test strings) */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveImagery('esri')}
                className={`px-2 py-1 text-[11px] font-mono rounded transition-colors ${
                  activeImagery === 'esri'
                    ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-500/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="ESRI World Satellite Imagery"
              >
                ESRI SATELLITE
              </button>
              <button
                onClick={() => setActiveImagery('carto_dark')}
                className={`px-2 py-1 text-[11px] font-mono rounded transition-colors ${
                  activeImagery === 'carto_dark'
                    ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="CartoDB Dark Matter"
              >
                CARTO DARK
              </button>
            </div>
          </div>
        </div>

        {/* CARTO Unauthenticated Watermark Alert */}
        {activeImagery === 'carto_dark' && IMAGERY_CONFIGS.carto_dark.watermarked && (
          <div className="pointer-events-auto bg-amber-950/90 backdrop-blur-md border border-amber-600/80 rounded-xl px-3.5 py-2 text-xs font-mono text-amber-200 flex items-center justify-between shadow-2xl my-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
              <span>
                <strong>PROVIDER WATERMARK NOTICE:</strong> CARTO unauthenticated raster tiles display 'API KEY REQUIRED'. To render crisp unwatermarked dark tiles, set <code>VITE_CARTO_API_KEY</code> in <code>.env</code> or switch to <strong>ESRI SATELLITE</strong> / <strong>ESRI DARK</strong>.
              </span>
            </div>
            <button
              onClick={() => setActiveImagery('esri')}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px] uppercase font-mono ml-3 flex-shrink-0 transition-colors"
            >
              SWITCH TO ESRI SATELLITE
            </button>
          </div>
        )}

        {/* Middle Viewport Layer Controls & Storm Information Panel */}
        <div className="flex items-start justify-between gap-4 my-auto overflow-hidden pointer-events-none relative z-10 w-full">
          
          {/* Left: Collapsible Map Layers Panel (Zoom Earth Style) */}
          <div className="pointer-events-auto flex flex-col items-start gap-2">
            <button
              onClick={handleToggleLayers}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono shadow-xl transition-all border ${
                isLayersOpen
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 font-bold'
                  : 'bg-slate-950/90 hover:bg-slate-900 text-slate-200 border-slate-800 backdrop-blur-md'
              }`}
              title="Toggle Map Layers"
            >
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="font-bold tracking-wide">LAYERS</span>
              {isLayersOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {isLayersOpen && (
              <div className="w-72 bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-3.5 text-xs font-mono shadow-2xl space-y-3.5 max-h-[calc(100vh-160px)] overflow-y-auto">
                
                {/* 1. Base Map Category */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>1. Base Map</span>
                    <span className="text-[9px] text-cyan-400">GLOBAL TILES</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setActiveImagery('esri')}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        activeImagery === 'esri'
                          ? 'bg-cyan-500/20 border-cyan-500 text-white font-bold'
                          : 'bg-slate-900/70 border-slate-850 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] font-bold">ESRI SATELLITE</div>
                      <div className="text-[8px] text-slate-500 mt-0.5">High-res Earth</div>
                    </button>

                    <button
                      onClick={() => setActiveImagery('esri_dark')}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        activeImagery === 'esri_dark'
                          ? 'bg-cyan-500/20 border-cyan-500 text-white font-bold'
                          : 'bg-slate-900/70 border-slate-850 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] font-bold">ESRI DARK</div>
                      <div className="text-[8px] text-slate-500 mt-0.5">Gray Canvas</div>
                    </button>

                    <button
                      onClick={() => setActiveImagery('carto_dark')}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        activeImagery === 'carto_dark'
                          ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                          : 'bg-slate-900/70 border-slate-850 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] font-bold">CARTO DARK</div>
                      <div className="text-[8px] text-slate-500 mt-0.5">Tactical Night</div>
                    </button>

                    <button
                      onClick={() => setActiveImagery('osm')}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        activeImagery === 'osm'
                          ? 'bg-cyan-500/20 border-cyan-500 text-white font-bold'
                          : 'bg-slate-900/70 border-slate-850 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] font-bold">OPENSTREETMAP</div>
                      <div className="text-[8px] text-slate-500 mt-0.5">Standard Vector</div>
                    </button>
                  </div>
                </div>

                {/* 2. Weather Category */}
                <div className="space-y-1.5 pt-2 border-t border-slate-850">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>2. Weather</span>
                    <span className="text-[9px] text-cyan-400">IMD & NASA</span>
                  </div>

                  {/* Doppler Radar */}
                  <button
                    onClick={() => setRadarEnabled(!radarEnabled)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                      radarEnabled
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/60 font-semibold'
                        : 'bg-slate-900/60 text-slate-400 border-slate-850 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5 text-blue-400" />
                      <span>Doppler Radar Mosaic</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      radarEnabled
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {radarEnabled ? '10-65 dBZ' : 'OFF'}
                    </span>
                  </button>

                  {/* Satellite Clouds */}
                  <button
                    onClick={() => setCloudsEnabled(!cloudsEnabled)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                      cloudsEnabled
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 font-semibold'
                        : 'bg-slate-900/60 text-slate-400 border-slate-850 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span>NASA Satellite Clouds</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      cloudsEnabled
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {cloudsEnabled ? 'LIVE MODIS' : 'OFF'}
                    </span>
                  </button>

                  {/* Rainfall Accumulation */}
                  <button
                    onClick={() => setPrecipEnabled(!precipEnabled)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                      precipEnabled
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/60 font-semibold'
                        : 'bg-slate-900/60 text-slate-400 border-slate-850 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CloudRain className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Rainfall Accumulation</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      precipEnabled ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {precipEnabled ? 'ACTIVE' : 'OFF'}
                    </span>
                  </button>

                  {/* Wind Velocity (Honest Status) */}
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-900/40 border border-slate-850 text-slate-400 opacity-80">
                    <div className="flex items-center gap-2">
                      <Wind className="w-3.5 h-3.5 text-slate-500" />
                      <span>Wind Streamlines</span>
                    </div>
                    <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-slate-800 text-slate-400">
                      ON 2D WEATHER MAP
                    </span>
                  </div>
                </div>

                {/* 3. Terrain Category */}
                <div className="space-y-1.5 pt-2 border-t border-slate-850">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>3. Terrain</span>
                    <span className="text-[9px] text-cyan-400">CESIUM ION</span>
                  </div>

                  <button
                    onClick={() => setTerrainEnabled(!terrainEnabled)}
                    disabled={!ionAccessToken}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                      !ionAccessToken
                        ? 'bg-slate-900/40 text-slate-500 border-slate-850 cursor-not-allowed'
                        : terrainEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 font-semibold'
                        : 'bg-slate-900/60 text-slate-400 border-slate-850 hover:text-slate-200'
                    }`}
                    title={ionAccessToken ? 'Toggle 3D World Terrain elevation mesh' : 'Requires VITE_CESIUM_ION_ACCESS_TOKEN in .env'}
                  >
                    <div className="flex items-center gap-2">
                      <Mountain className={`w-3.5 h-3.5 ${terrainEnabled ? 'text-emerald-400' : 'text-slate-400'}`} />
                      <span>Cesium 3D Terrain</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border ${
                      !ionAccessToken
                        ? 'bg-slate-900 text-slate-500 border-slate-800'
                        : terrainEnabled
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                        : 'bg-slate-800 text-slate-400 border-slate-750'
                    }`}>
                      {!ionAccessToken ? 'NO TOKEN' : terrainEnabled ? '3D MESH' : 'FLAT'}
                    </span>
                  </button>
                </div>

                {/* 4. Disaster Intelligence Category */}
                <div className="space-y-1.5 pt-2 border-t border-slate-850">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>4. Disaster Intelligence</span>
                    <span className="text-[9px] text-amber-400">CRITICAL</span>
                  </div>

                  {/* Cyclone Track */}
                  <button
                    onClick={() => setCycloneTrackEnabled(!cycloneTrackEnabled)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                      cycloneTrackEnabled
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-semibold'
                        : 'bg-slate-900/60 text-slate-400 border-slate-850 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Compass className="w-3.5 h-3.5 text-amber-400" />
                      <span>IMD Cyclone Track & Cone</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      cycloneTrackEnabled ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {cycloneTrackEnabled ? 'VISIBLE' : 'HIDDEN'}
                    </span>
                  </button>

                  {/* Official Warnings Trigger */}
                  <button
                    onClick={() => setIsWarningsModalOpen(true)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-all font-semibold"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      <span>Official Warnings</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-bold">
                      {officialAlerts.length} ACTIVE
                    </span>
                  </button>

                  {/* SFINCS Quarantined Inundation */}
                  <button
                    onClick={() => setSfincsEnabled(!sfincsEnabled)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                      sfincsEnabled
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 font-semibold'
                        : 'bg-slate-900/60 text-slate-400 border-slate-850 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Waves className="w-3.5 h-3.5 text-rose-400" />
                      <span>SFINCS Adyar Flood</span>
                    </div>
                    {user?.role !== 'RESEARCHER' && <Lock className="w-3 h-3 text-amber-400" />}
                    {sfincsLoading && <span className="text-[8px] animate-pulse">LOADING</span>}
                  </button>

                  {sfincsEnabled && !sfincsError && (
                    <div className="p-2 bg-amber-950/70 border border-amber-700/60 rounded-xl text-[9px] text-amber-300">
                      EXPERIMENTAL_UNVALIDATED • Adyar reach simulation
                    </div>
                  )}

                  {/* Spatial Point Inspector */}
                  <button
                    onClick={() => setIsInspectMode(!isInspectMode)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all ${
                      isInspectMode
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-semibold'
                        : 'bg-slate-900/60 text-slate-400 border-slate-850 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Crosshair className={`w-3.5 h-3.5 ${isInspectMode ? 'text-amber-400 animate-spin' : 'text-slate-400'}`} />
                      <span>Point Rain Inspector</span>
                    </div>
                    {isInspectMode && <span className="text-[9px] text-amber-400 font-bold">ACTIVE</span>}
                  </button>
                </div>

                {/* Geospatial Provider Readiness Matrix */}
                <div className="space-y-1 bg-slate-900/80 p-2.5 rounded-xl border border-slate-850 text-[10px]">
                  <div className="text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between mb-1">
                    <span>PROVIDER READINESS</span>
                    <span className="text-[9px] text-cyan-400">PHASE 4C</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Cesium ion 3D</span>
                    <span className={`text-[9px] font-bold ${ionAccessToken && terrainEnabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {!ionAccessToken ? 'FLAT WGS84' : terrainEnabled ? 'ACTIVE (3D MESH)' : 'FLAT (OFF)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Esri Satellite</span>
                    <span className="text-[9px] font-bold text-emerald-400">ACTIVE (UNMETERED)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">CARTO Dark</span>
                    <span className={`text-[9px] font-bold ${cartoApiKey ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {cartoApiKey ? 'AUTH CLEAN' : 'WATERMARKED'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">RainViewer DWR</span>
                    <span className="text-[9px] font-bold text-emerald-400">LIVE MOSAIC</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Collapsible Cyclone Intelligence Panel (Zoom Earth Inspired) */}
          <div className="pointer-events-auto flex flex-col items-end">
            {!isStormPanelOpen ? (
              <button
                onClick={handleToggleStormPanel}
                className="flex items-center gap-2 px-3 py-2 bg-slate-950/90 hover:bg-slate-900 backdrop-blur-md border border-amber-500/50 rounded-xl text-xs font-mono text-slate-200 shadow-xl transition-all"
                title="Expand Cyclone Intelligence Panel"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />
                <span className="font-bold text-amber-300">
                  {selectedCyclone ? selectedCyclone.name : 'CYCLONE TRACK'}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">
                  {currentDisplayPoint ? `${currentDisplayPoint.windKmh} km/h` : ''}
                </span>
                <ChevronLeft className="w-3.5 h-3.5 text-amber-400" />
              </button>
            ) : (
              <div className="w-80 sm:w-88 bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 text-slate-200 shadow-2xl max-h-[calc(100vh-160px)] flex flex-col overflow-hidden">
                {/* 1. Storm Name, Event Status, and Authoritative Source */}
                <div className="flex items-start justify-between pb-2.5 mb-2.5 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                      <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                        {selectedCyclone ? selectedCyclone.name : 'NORTH INDIAN OCEAN'}
                      </h3>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold">
                        {selectedCyclone ? selectedCyclone.season : 'ARCHIVE'}
                      </span>
                    </div>
                    <div className="text-[10px] font-sans text-slate-400 mt-0.5">
                      {selectedCyclone?.issuingAuthority || 'India Meteorological Department (RSMC New Delhi)'}
                    </div>
                  </div>
                  <button
                    onClick={() => setIsStormPanelOpen(false)}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                    title="Collapse Panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Sub-Tabs: Summary, Track Fixes, Historical Archives */}
                <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl mb-3 border border-slate-850">
                  <button
                    onClick={() => setStormTab('DETAILS')}
                    className={`py-1 text-[10px] font-mono font-bold rounded-lg transition-colors ${
                      stormTab === 'DETAILS'
                        ? 'bg-slate-800 text-cyan-300 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    SUMMARY
                  </button>
                  <button
                    onClick={() => setStormTab('TABLE')}
                    className={`py-1 text-[10px] font-mono font-bold rounded-lg transition-colors ${
                      stormTab === 'TABLE'
                        ? 'bg-slate-800 text-cyan-300 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    TRACK FIXES
                  </button>
                  <button
                    onClick={() => setStormTab('ARCHIVES')}
                    className={`py-1 text-[10px] font-mono font-bold rounded-lg transition-colors ${
                      stormTab === 'ARCHIVES'
                        ? 'bg-slate-800 text-amber-300 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ARCHIVES
                  </button>
                </div>

                {/* Tab 1: Detailed Storm Summary (Following 7-step hierarchy) */}
                {stormTab === 'DETAILS' && (
                  <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                    {selectedCyclone ? (
                      <>
                        {/* 2. Observation / Advisory Timestamp Card */}
                        <div className="bg-slate-900/90 border border-slate-850 p-2.5 rounded-xl flex items-center justify-between">
                          <div>
                            <div className="text-[9px] text-slate-400 font-mono uppercase font-bold">Fix Timestamp</div>
                            <div className="text-xs font-mono font-bold text-white mt-0.5">
                              {currentDisplayPoint ? currentDisplayPoint.timeIST : selectedCyclone.bulletinTime}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 text-[9px] font-mono rounded-full font-bold border ${
                              currentDisplayPoint?.type === 'OBSERVED'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : 'bg-purple-950 text-purple-300 border-purple-800'
                            }`}
                          >
                            {currentDisplayPoint?.type || 'OBSERVED'}
                          </span>
                        </div>

                        {/* 3. Wind Speed and Intensity Classification */}
                        <div className="bg-slate-900/90 border border-slate-850 p-3 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-mono uppercase font-bold">Intensity Classification</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${currentClassCfg.bg} ${currentClassCfg.text} ${currentClassCfg.border}`}
                            >
                              {currentDisplayPoint ? currentDisplayPoint.classificationLabel : selectedCyclone.intensityLabel}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-center font-mono pt-1">
                            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-850">
                              <div className="text-[9px] text-slate-400 uppercase font-sans">Sustained Wind</div>
                              <div className="text-base font-bold text-amber-400 mt-0.5">
                                {currentDisplayPoint?.windKmh ?? selectedCyclone.maxWindKmh}{' '}
                                <span className="text-[10px] font-normal">km/h</span>
                              </div>
                              <div className="text-[9px] text-slate-500">
                                {currentDisplayPoint?.windKnots ?? selectedCyclone.maxWindKnots} knots
                              </div>
                            </div>

                            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-850">
                              <div className="text-[9px] text-slate-400 uppercase font-sans">Peak Gusts</div>
                              <div className="text-base font-bold text-orange-400 mt-0.5">
                                {currentDisplayPoint?.gustKmh ?? selectedCyclone.maxWindKmh + 20}{' '}
                                <span className="text-[10px] font-normal">km/h</span>
                              </div>
                              <div className="text-[9px] text-slate-500">Severe squall</div>
                            </div>
                          </div>
                        </div>

                        {/* 4. Central Pressure & 5. Position Coordinates */}
                        <div className="grid grid-cols-2 gap-2 font-mono">
                          <div className="bg-slate-900/90 border border-slate-850 p-2.5 rounded-xl text-center">
                            <div className="text-[9px] text-slate-400 uppercase font-sans">Central Pressure</div>
                            <div className="text-sm font-bold text-cyan-400 mt-0.5">
                              {currentDisplayPoint?.pressureHpa ?? selectedCyclone.minPressureHpa}{' '}
                              <span className="text-[10px] font-normal">hPa</span>
                            </div>
                            <div className="text-[9px] text-slate-500">mbar MSLP</div>
                          </div>

                          <div className="bg-slate-900/90 border border-slate-850 p-2.5 rounded-xl text-center">
                            <div className="text-[9px] text-slate-400 uppercase font-sans">Center Coordinates</div>
                            <div className="text-sm font-bold text-white mt-0.5">
                              {currentDisplayPoint ? `${currentDisplayPoint.lat.toFixed(2)}°N` : '—'}
                            </div>
                            <div className="text-[9px] text-slate-400">
                              {currentDisplayPoint ? `${currentDisplayPoint.lon.toFixed(2)}°E` : '—'}
                            </div>
                          </div>
                        </div>

                        {/* 6. Track Controls & Waypoint Stepper */}
                        <div className="bg-slate-900/90 border border-slate-850 p-2.5 rounded-xl flex items-center justify-between">
                          <button
                            onClick={() => {
                              if (!selectedCyclone) return;
                              const curIdx = selectedCyclone.track.findIndex((p) => p.id === currentDisplayPoint?.id);
                              const prevIdx = (curIdx - 1 + selectedCyclone.track.length) % selectedCyclone.track.length;
                              setSelectedTrackPoint(selectedCyclone.track[prevIdx]);
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-mono flex items-center gap-1"
                          >
                            <ChevronLeft className="w-3 h-3" />
                            <span>PREV</span>
                          </button>

                          <span className="text-[10px] font-mono text-slate-400">
                            Fix{' '}
                            <strong className="text-white">
                              {(selectedCyclone.track.findIndex((p) => p.id === currentDisplayPoint?.id) ?? 0) + 1}
                            </strong>{' '}
                            of {selectedCyclone.track.length}
                          </span>

                          <button
                            onClick={() => {
                              if (!selectedCyclone) return;
                              const curIdx = selectedCyclone.track.findIndex((p) => p.id === currentDisplayPoint?.id);
                              const nextIdx = (curIdx + 1) % selectedCyclone.track.length;
                              setSelectedTrackPoint(selectedCyclone.track[nextIdx]);
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-mono flex items-center gap-1"
                          >
                            <span>NEXT</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* 7. Forecast Uncertainty & Official Advisory */}
                        <div className="bg-slate-900/90 border border-slate-850 p-3 rounded-xl text-xs space-y-1.5">
                          <div className="text-[10px] font-mono text-slate-400 uppercase font-bold flex items-center justify-between">
                            <span>OFFICIAL ADVISORY</span>
                            <span className="text-[9px] text-cyan-400 font-normal">IMD BULLETIN</span>
                          </div>
                          <p className="text-slate-300 font-sans leading-relaxed text-[11px]">
                            {currentDisplayPoint?.advisoryNote || selectedCyclone.latestAdvisory}
                          </p>
                          {currentDisplayPoint?.type === 'FORECAST' && currentDisplayPoint.coneRadiusKm && (
                            <div className="text-[10px] text-purple-300 font-mono pt-1 border-t border-slate-800">
                              Uncertainty Radius: ±{currentDisplayPoint.coneRadiusKm} km (IMD Standard Cone)
                            </div>
                          )}
                        </div>

                        {/* Affected Coastal Sectors */}
                        <div className="space-y-1">
                          <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                            AFFECTED COASTAL SECTORS
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedCyclone.affectedRegions.map((region) => (
                              <span
                                key={region}
                                className="px-2 py-0.5 bg-slate-850 border border-slate-750 rounded-md text-[10px] font-sans text-slate-300"
                              >
                                {region}
                              </span>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="py-8 text-center text-xs font-sans text-slate-400">
                        <Compass className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-spin" />
                        No cyclone selected. Browse archives to load historical best tracks.
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Chronological Observations & Forecast Table */}
                {stormTab === 'TABLE' && (
                  <div className="space-y-2 overflow-y-auto pr-1 flex-1 text-xs font-mono">
                    {selectedCyclone && (
                      <>
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                          <div className="flex items-center gap-1">
                            {(['ALL', 'OBSERVED', 'FORECAST'] as const).map((filter) => (
                              <button
                                key={filter}
                                onClick={() => setActiveStormTypeFilter(filter)}
                                className={`px-2 py-0.5 text-[9px] rounded font-bold transition-colors ${
                                  activeStormTypeFilter === filter
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                                    : 'text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {filter}
                              </button>
                            ))}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {selectedCyclone.track.length} FIXES
                          </span>
                        </div>

                        <div className="space-y-1">
                          {selectedCyclone.track
                            .filter((pt) => activeStormTypeFilter === 'ALL' || pt.type === activeStormTypeFilter)
                            .map((pt) => {
                              const isSelected = selectedTrackPoint?.id === pt.id;
                              return (
                                <button
                                  key={pt.id}
                                  onClick={() => handleSelectWaypoint(pt)}
                                  className={`w-full text-left p-2 rounded-xl border transition-all flex items-center justify-between ${
                                    isSelected
                                      ? 'bg-amber-500/20 border-amber-500 text-white font-bold shadow-md'
                                      : 'bg-slate-900/60 border-slate-850 hover:bg-slate-800/80 text-slate-300'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                                          pt.type === 'OBSERVED'
                                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                            : 'bg-purple-950 text-purple-400 border border-purple-800'
                                        }`}
                                      >
                                        {pt.type === 'OBSERVED' ? 'OBS' : 'FCST'}
                                      </span>
                                      <span className="text-[11px] font-medium">{pt.timeIST}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                                      {pt.lat.toFixed(1)}°N, {pt.lon.toFixed(1)}°E • {pt.classificationLabel}
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <div className="text-amber-400 font-bold">{pt.windKmh} km/h</div>
                                    <div className="text-[10px] text-slate-400">{pt.pressureHpa} hPa</div>
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Tab 3: Historical Storm Archive Browser */}
                {stormTab === 'ARCHIVES' && (
                  <div className="space-y-2 overflow-y-auto pr-1 flex-1 text-xs font-mono">
                    <div className="text-[10px] text-slate-400 font-sans pb-1 leading-snug">
                      Verified historical tropical cyclones from the IMD RSMC Best Track archive.
                    </div>

                    {VERIFIED_HISTORICAL_CYCLONES.map((storm) => {
                      const isCurrent = selectedCyclone?.id === storm.id;
                      return (
                        <button
                          key={storm.id}
                          onClick={() => {
                            setSelectedCyclone(storm);
                            setSelectedTrackPoint(storm.track[0]);
                            setStormTab('DETAILS');
                          }}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                            isCurrent
                              ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                              : 'bg-slate-900/60 border-slate-850 hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs">{storm.name}</span>
                            <span className="text-[10px] text-amber-400">{storm.season}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                            {storm.intensityLabel} • Max {storm.maxWindKmh} km/h
                          </div>
                          <div className="text-[9px] text-slate-500 font-sans mt-1 truncate">
                            {storm.basin}
                          </div>
                        </button>
                      );
                    })}

                    <div className="pt-2 border-t border-slate-800 text-center">
                      <button
                        onClick={() => {
                          setSelectedCyclone(null);
                          setSelectedTrackPoint(null);
                        }}
                        className="text-[10px] text-slate-400 hover:text-white underline font-sans"
                      >
                        Clear Storm Selection (Show Empty Basin)
                      </button>
                    </div>
                  </div>
                )}

                {/* Storm Panel Footer: Export Brief & Provenance */}
                <div className="pt-2.5 mt-2.5 border-t border-slate-800 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                  <span>Source: {selectedCyclone?.issuingAuthority || 'IMD RSMC'}</span>
                  {selectedCyclone && (
                    <button
                      onClick={handleExportBrief}
                      className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[10px] font-bold"
                    >
                      <FileDown className="w-3 h-3" />
                      <span>EXPORT BRIEF</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Spatial Inspector Coordinate Card (When Point Clicked) */}
        {(inspectResult || inspectLoading || inspectError) && (
          <div className="pointer-events-auto max-w-sm bg-slate-900/95 backdrop-blur-md border border-amber-500/70 rounded-2xl p-3.5 text-slate-200 shadow-2xl mb-2 z-20">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CloudRain className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  PRECIPITATION POINT INSPECTOR
                </h4>
              </div>
              <button
                onClick={() => {
                  setInspectResult(null);
                  setInspectError(null);
                }}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {inspectLoading && (
              <div className="py-3 text-center text-xs font-mono text-amber-400 animate-pulse flex items-center justify-center gap-2">
                <Crosshair className="w-4 h-4 animate-spin" />
                <span>Querying Copernicus ERA5 reanalysis...</span>
              </div>
            )}

            {inspectError && (
              <div className="py-2 text-xs font-mono text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{inspectError}</span>
              </div>
            )}

            {inspectResult && (
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-[11px] bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-400">FIX:</span>{' '}
                    <span className="text-white font-bold">
                      {inspectResult.location.latitude.toFixed(3)}°N, {inspectResult.location.longitude.toFixed(3)}°E
                    </span>
                  </div>
                  <span className="text-amber-300 font-bold">{inspectResult.eventAccumulationMm.toFixed(1)} mm total</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Floating Interactive Timeline & Camera Controls (Zoom Earth Style) */}
        <div className="pointer-events-auto flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl px-4 py-2.5 shadow-2xl z-10">
          
          {/* Left: Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedCyclone && selectedCyclone.track.length > 0) {
                  setSelectedTrackPoint((prev) => {
                    if (!prev) return selectedCyclone.track[0];
                    const idx = selectedCyclone.track.findIndex((p) => p.id === prev.id);
                    const prevIdx = (idx - 1 + selectedCyclone.track.length) % selectedCyclone.track.length;
                    return selectedCyclone.track[prevIdx];
                  });
                } else if (radarFrames.length > 0) {
                  setActiveFrameIndex((prev) => (prev - 1 + radarFrames.length) % radarFrames.length);
                }
              }}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
              title="Step Backward"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl font-bold transition-all shadow-md"
              title={isPlaying ? 'Pause Timeline' : 'Play Timeline'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <button
              onClick={() => {
                if (selectedCyclone && selectedCyclone.track.length > 0) {
                  setSelectedTrackPoint((prev) => {
                    if (!prev) return selectedCyclone.track[0];
                    const idx = selectedCyclone.track.findIndex((p) => p.id === prev.id);
                    const nextIdx = (idx + 1) % selectedCyclone.track.length;
                    return selectedCyclone.track[nextIdx];
                  });
                } else if (radarFrames.length > 0) {
                  setActiveFrameIndex((prev) => (prev + 1) % radarFrames.length);
                }
              }}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
              title="Step Forward"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setPlaybackSpeed((s) => (s === 1 ? 2 : 1))}
              className="px-2 py-1 bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-slate-300 rounded-lg hover:text-white"
              title="Toggle Playback Speed"
            >
              {playbackSpeed}X
            </button>
          </div>

          {/* Center: Draggable Scrubber Timeline */}
          <div className="flex-1 max-w-xl flex flex-col items-center gap-1 w-full px-2">
            <div className="flex items-center justify-between w-full text-[10px] font-mono text-slate-400">
              <span className="font-bold text-white">
                {currentDisplayPoint ? currentDisplayPoint.timeIST : radarFrames[activeFrameIndex]?.label || 'LIVE TIMELINE'}
              </span>
              <span className="text-cyan-300">
                {selectedCyclone ? 'STORM BEST TRACK ARCHIVE' : 'RADAR MOSAIC LOOP'}
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={
                selectedCyclone && selectedCyclone.track.length > 0
                  ? selectedCyclone.track.length - 1
                  : Math.max(0, radarFrames.length - 1)
              }
              value={
                selectedCyclone && selectedCyclone.track.length > 0 && selectedTrackPoint
                  ? selectedCyclone.track.findIndex((p) => p.id === selectedTrackPoint.id)
                  : activeFrameIndex
              }
              onChange={(e) => {
                const idx = parseInt(e.target.value, 10);
                if (selectedCyclone && selectedCyclone.track.length > 0) {
                  const pt = selectedCyclone.track[idx];
                  if (pt) setSelectedTrackPoint(pt);
                } else {
                  setActiveFrameIndex(idx);
                }
              }}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Right: Camera HUD Cluster */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleZoom('in')}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoom('out')}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleToggleTilt}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1"
              title="Toggle 3D Curvature Pitch"
            >
              <RotateCw className="w-3.5 h-3.5 text-amber-400" />
              <span>{isObliqueView ? '3D' : '2D'}</span>
            </button>
            <button
              onClick={handleRecenterStorm}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg"
              title="Focus Cyclone Center"
            >
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            </button>
            <button
              onClick={handleResetOverview}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg"
              title="Reset to Indian Ocean Subcontinent"
            >
              <Globe className="w-3.5 h-3.5 text-teal-400" />
            </button>
          </div>
        </div>

        {/* Bottom Attribution Strip (Preserves required Esri credit for tests) */}
        <div className="pointer-events-auto bg-slate-950/80 backdrop-blur-sm px-3 py-1 rounded-lg text-[9px] text-slate-400 font-mono flex items-center justify-between border border-slate-800 mt-2">
          <div className="truncate pr-2">{IMAGERY_CONFIGS[activeImagery].credit}</div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-slate-500">IMD RSMC NEW DELHI • CESIUM 3D ENGINE</span>
          </div>
        </div>
      </div>

      {/* Official Regional Warnings Modal / Slide-Over */}
      {isWarningsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 text-slate-200 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-mono font-bold text-white uppercase tracking-wider">
                  OFFICIAL DISASTER WARNINGS
                </h3>
              </div>
              <button
                onClick={() => setIsWarningsModalOpen(false)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs font-sans text-slate-300 leading-relaxed">
              Official Common Alerting Protocol (CAP) feeds ingested from the{' '}
              <strong>India Meteorological Department (IMD)</strong> and{' '}
              <strong>National Disaster Management Authority (NDMA)</strong>.
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {warningsLoading && (
                <div className="py-8 text-center text-xs font-mono text-amber-400 animate-pulse">
                  Querying official NDMA CAP gateway...
                </div>
              )}

              {!warningsLoading && officialAlerts.length === 0 && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <div className="text-sm font-bold text-white font-mono">No Active Warnings in Sector</div>
                  <div className="text-xs text-slate-400 mt-1">
                    No severe red/orange alerts currently in effect for {selectedLocation.name}. Monitor regional state disaster management bulletins (SDMA).
                  </div>
                </div>
              )}

              {!warningsLoading &&
                officialAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="bg-slate-950/80 border border-amber-500/50 rounded-xl p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-mono font-bold">
                        {alert.severity} • {alert.category}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {alert.sourceAgency || 'IMD Regional Centre'}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-white font-mono">{alert.headline}</div>
                    <p className="text-[11px] text-slate-300 font-sans leading-relaxed">{alert.description}</p>

                    {alert.recommendedActions && alert.recommendedActions.length > 0 && (
                      <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-2 text-[10px] text-amber-200 font-sans">
                        <strong>Public Advisory:</strong> {alert.recommendedActions.join('; ')}
                      </div>
                    )}
                  </div>
                ))}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Verified CAP Ingestion</span>
              <button
                onClick={() => setIsWarningsModalOpen(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Command3DView;
