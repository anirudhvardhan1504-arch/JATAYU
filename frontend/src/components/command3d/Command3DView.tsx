import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import {
  Globe,
  MapPin,
  ArrowLeft,
  AlertTriangle,
  Compass,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Crosshair,
  Info,
  Calendar,
  CloudRain,
  Eye,
  FileDown,
  Layers,
  Waves,
  X,
  Radio,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  getOperationalSectors,
  getGlobeContext,
  OperationalSector,
  GlobeContextSession,
  CommandApiError,
} from '../../services/command';
import { getHistoricalWeather, HistoricalWeatherSeries } from '../../services/weather';
import { getLatestRadarInfo } from '../../services/radar';
import { fetchAdyarSimulation, SimulationResponse } from '../../services/research';

interface Command3DViewProps {
  selectedLocation: { name: string; lat: number; lon: number };
  onSelectLocation?: (loc: { name: string; lat: number; lon: number }) => void;
  onReturnTo2D: () => void;
}

export type ImageryProviderType = 'esri' | 'esri_dark' | 'carto_dark' | 'osm';

export const IMAGERY_CONFIGS: Record<
  ImageryProviderType,
  { label: string; buttonText: string; url: string; subdomains?: string[]; credit: string; maximumLevel: number; watermarked?: boolean }
> = {
  esri: {
    label: 'ESRI World Imagery (Satellite)',
    buttonText: 'ESRI SATELLITE',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    credit:
      'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maximumLevel: 19,
  },
  esri_dark: {
    label: 'ESRI Dark Gray Canvas (Tactical Clean)',
    buttonText: 'ESRI DARK',
    url: 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    credit: 'Tiles © Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community',
    maximumLevel: 16, // Service cached level limit for World_Dark_Gray_Base
  },
  carto_dark: {
    label: 'CartoDB Dark Matter (Tactical Night)',
    buttonText: 'CARTO DARK',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    credit: '© OpenStreetMap contributors, © CARTO',
    maximumLevel: 19,
    watermarked: true,
  },
  osm: {
    label: 'OpenStreetMap Standard (Tactical Vector)',
    buttonText: 'OPENSTREETMAP',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    credit: '© OpenStreetMap contributors',
    maximumLevel: 19,
  },
};

export interface HistoricalPreset {
  id: string;
  name: string;
  date: string;
  startDate: string;
  endDate: string;
  center: { lat: number; lon: number; name: string };
  description: string;
}

export const HISTORICAL_PRESETS: HistoricalPreset[] = [
  {
    id: 'michaung2023',
    name: '2023 Cyclone Michaung',
    date: '2023-12-04',
    startDate: '2023-12-01',
    endDate: '2023-12-06',
    center: { lat: 13.0827, lon: 80.2707, name: 'Chennai & South Coastal AP' },
    description: 'Severe cyclonic storm stalling off Coromandel coast delivering >400mm widespread precipitation.',
  },
  {
    id: 'deluge2015',
    name: '2015 Chennai Deluge',
    date: '2015-12-01',
    startDate: '2015-11-28',
    endDate: '2015-12-04',
    center: { lat: 13.0827, lon: 80.2707, name: 'Chennai Metropolitan Region' },
    description: 'Catastrophic monsoon deluge with >490mm single-day rainfall over Adyar/Chembarambakkam basin.',
  },
  {
    id: 'remal2024',
    name: '2024 Cyclone Remal',
    date: '2024-05-26',
    startDate: '2024-05-24',
    endDate: '2024-05-28',
    center: { lat: 22.5726, lon: 88.3639, name: 'Kolkata & Sundarbans Delta' },
    description: 'Severe cyclonic storm making landfall across the northern Bay of Bengal and Bengal delta.',
  },
  {
    id: 'recent',
    name: 'Recent Observation',
    date: '2024-10-25',
    startDate: '2024-10-20',
    endDate: '2024-10-25',
    center: { lat: 19.076, lon: 72.8777, name: 'Mumbai Metropolitan Region' },
    description: 'Standard observation window for seasonal atmospheric monitoring.',
  },
];

export const Command3DView: React.FC<Command3DViewProps> = ({
  selectedLocation,
  onSelectLocation,
  onReturnTo2D,
}) => {
  const { token, user, invalidateSession } = useAuth();
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const eventHandlerRef = useRef<any>(null);

  // Layer & Research States
  const [activeImagery, setActiveImagery] = useState<ImageryProviderType>('esri');
  const [cloudsEnabled, setCloudsEnabled] = useState<boolean>(false);
  const [radarEnabled, setRadarEnabled] = useState<boolean>(false);
  const [sfincsEnabled, setSfincsEnabled] = useState<boolean>(false);
  const [sfincsLoading, setSfincsLoading] = useState<boolean>(false);
  const [sfincsData, setSfincsData] = useState<SimulationResponse | null>(null);
  const [sfincsError, setSfincsError] = useState<string | null>(null);

  // Timeline & Preset States
  const [activePreset, setActivePreset] = useState<string>('michaung2023');
  const [selectedDate, setSelectedDate] = useState<string>('2023-12-04');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '2023-12-01',
    end: '2023-12-06',
  });

  // Spatial Inspection States
  const [isInspectMode, setIsInspectMode] = useState<boolean>(false);
  const [inspectLoading, setInspectLoading] = useState<boolean>(false);
  const [inspectResult, setInspectResult] = useState<HistoricalWeatherSeries | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Operational Sectors & Globe Telemetry
  const [sectors, setSectors] = useState<OperationalSector[]>([]);
  const [activeSector, setActiveSector] = useState<OperationalSector | null>(null);
  const [globeContext, setGlobeContext] = useState<GlobeContextSession | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [isObliqueView, setIsObliqueView] = useState<boolean>(true);

  // Cesium Resource References
  const cloudsLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const radarLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const sfincsDataSourceRef = useRef<Cesium.GeoJsonDataSource | null>(null);
  const inspectEntityRef = useRef<Cesium.Entity | null>(null);

  // Active inspect mode ref for ScreenSpaceEventHandler
  const isInspectModeRef = useRef(isInspectMode);
  useEffect(() => {
    isInspectModeRef.current = isInspectMode;
  }, [isInspectMode]);

  // 1. Fetch Backend Globe Context & Verified Operational Sectors
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
          const matched = secRes.value.sectors.find(
            (s) => s.coordinates.lat === selectedLocation.lat && s.coordinates.lon === selectedLocation.lon
          );
          if (matched) setActiveSector(matched);
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
  }, [token, selectedLocation, invalidateSession]);

  // Handler for Spatial Point Inspection
  const handleInspectPoint = useCallback(
    async (lat: number, lon: number) => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      // Clean up previous inspection entity
      if (inspectEntityRef.current) {
        try {
          viewer.entities.remove(inspectEntityRef.current);
        } catch {
          // ignore
        }
        inspectEntityRef.current = null;
      }

      // Add prominent 3D inspection beacon
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
          dateRange.start,
          dateRange.end,
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
    [dateRange]
  );

  const handleInspectPointRef = useRef(handleInspectPoint);
  useEffect(() => {
    handleInspectPointRef.current = handleInspectPoint;
  }, [handleInspectPoint]);

  // 2. Initialize Cesium Viewer
  useEffect(() => {
    if (!containerRef.current) return;
    let viewer: Cesium.Viewer | null = null;

    try {
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
      });

      // Enhance 3D depth, atmospheric lighting, and earth curvature
      if (viewer.scene) {
        if (viewer.scene.globe) {
          viewer.scene.globe.enableLighting = true;
          viewer.scene.globe.showGroundAtmosphere = true;
          viewer.scene.globe.depthTestAgainstTerrain = false;
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

      // Apply initial base imagery provider
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

      // Initial Camera Position
      const initialLat = selectedLocation?.lat ?? 19.076;
      const initialLon = selectedLocation?.lon ?? 72.8777;
      const initialHeight = 1400000;

      if (viewer.camera?.setView) {
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(initialLon, initialLat - 3.2, initialHeight),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-38),
            roll: 0.0,
          },
        });
      }

      // Interactive Click Handling: Spatial Inspection & Operational Sector Fly-To
      if (viewer.canvas && Cesium.ScreenSpaceEventHandler) {
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        handler.setInputAction((click: any) => {
          if (!viewer || viewer.isDestroyed()) return;

          // Spatial Inspection takes priority when active
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

          // Otherwise inspect sector beacons
          if (viewer?.scene?.pick) {
            const picked = viewer.scene.pick(click.position);
            if (picked?.id?.id?.startsWith('sec-beacon-')) {
              const secId = picked.id.id.replace('sec-beacon-', '');
              const found = sectors.find((s) => s.id === secId);
              if (found) {
                handleFlyToSector(found);
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

  // 3. Update Base Imagery Layer on activeImagery change
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
      // Get base layer (layer 0)
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

  // 4. Daily Satellite Cloud Imagery Layer (NASA GIBS MODIS True Color)
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
        const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${selectedDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
        const provider = new Cesium.UrlTemplateImageryProvider({
          url,
          maximumLevel: 9,
          credit: Cesium.Credit ? new Cesium.Credit('Imagery © NASA GIBS / EOSDIS') : ('Imagery © NASA GIBS / EOSDIS' as any),
        });
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        layer.alpha = 0.75;
        cloudsLayerRef.current = layer;
      } catch (e) {
        console.warn('Failed to load NASA GIBS cloud layer:', e);
      }
    }
  }, [cloudsEnabled, selectedDate]);

  // 5. Doppler Radar Observation Layer (RainViewer Composite)
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

    if (radarEnabled) {
      let isSubscribed = true;
      getLatestRadarInfo().then((radarInfo) => {
        if (!isSubscribed || !viewer || viewer.isDestroyed() || !radarInfo) return;
        try {
          const provider = new Cesium.UrlTemplateImageryProvider({
            url: radarInfo.tileUrl,
            maximumLevel: 19,
            credit: Cesium.Credit ? new Cesium.Credit('Radar © RainViewer') : ('Radar © RainViewer' as any),
          });
          const layer = viewer.imageryLayers.addImageryProvider(provider);
          layer.alpha = 0.8;
          radarLayerRef.current = layer;
        } catch (e) {
          console.warn('Failed to load RainViewer radar layer in Cesium:', e);
        }
      });
      return () => {
        isSubscribed = false;
      };
    }
  }, [radarEnabled]);

  // 6. Quarantined Adyar Hydrodynamic Inundation (SFINCS 28km reach)
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
        setSfincsError('Access Restricted: Tier-3 RBAC required (EXPERIMENTAL_UNVALIDATED). Log in as RESEARCHER (qa_commander).');
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

              // Fly camera to Adyar Corridor vantage
              if (viewer.camera?.flyTo) {
                viewer.camera.flyTo({
                  destination: Cesium.Cartesian3.fromDegrees(80.20, 12.96, 42000),
                  orientation: {
                    heading: Cesium.Math.toRadians(0),
                    pitch: Cesium.Math.toRadians(-45),
                    roll: 0.0,
                  },
                  duration: 2.2,
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

  // 7. Render 3D Sector Beacons on the Globe
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !viewer.entities?.add) return;

    try {
      // Clear only sector beacons
      sectors.forEach((sec) => {
        const ent = viewer.entities.getById(`sec-beacon-${sec.id}`);
        if (ent) viewer.entities.remove(ent);
      });

      sectors.forEach((sec) => {
        const isCurrent =
          selectedLocation.lat === sec.coordinates.lat &&
          selectedLocation.lon === sec.coordinates.lon;

        const beaconColor = isCurrent
          ? (Cesium.Color?.fromCssColorString ? Cesium.Color.fromCssColorString('#38bdf8') : Cesium.Color?.CYAN)
          : (Cesium.Color?.fromCssColorString ? Cesium.Color.fromCssColorString('#f59e0b') : Cesium.Color?.YELLOW);

        viewer.entities.add({
          id: `sec-beacon-${sec.id}`,
          name: sec.name,
          position: Cesium.Cartesian3.fromDegrees(sec.coordinates.lon, sec.coordinates.lat, 0),
          point: {
            pixelSize: isCurrent ? 14 : 9,
            color: beaconColor,
            outlineColor: Cesium.Color?.BLACK,
            outlineWidth: 2,
          },
          polyline: Cesium.PolylineGlowMaterialProperty
            ? {
                positions: [
                  Cesium.Cartesian3.fromDegrees(sec.coordinates.lon, sec.coordinates.lat, 0),
                  Cesium.Cartesian3.fromDegrees(sec.coordinates.lon, sec.coordinates.lat, 60000),
                ],
                width: isCurrent ? 4 : 2,
                material: new Cesium.PolylineGlowMaterialProperty({
                  glowPower: 0.25,
                  color: beaconColor,
                }),
              }
            : undefined,
          label: Cesium.LabelStyle
            ? {
                text: sec.name.toUpperCase(),
                font: '10px monospace',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: Cesium.Color?.WHITE,
                outlineColor: Cesium.Color?.BLACK,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin?.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -18),
                distanceDisplayCondition: Cesium.DistanceDisplayCondition
                  ? new Cesium.DistanceDisplayCondition(0, 8000000)
                  : undefined,
              }
            : undefined,
        });
      });
    } catch (e) {
      console.warn('Failed to render 3D sector beacons:', e);
    }
  }, [sectors, selectedLocation]);

  // 8. Update camera when selected location prop changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !selectedLocation || !viewer.camera?.flyTo) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        selectedLocation.lon,
        selectedLocation.lat - 2.5,
        750000
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-38),
        roll: 0.0,
      },
      duration: 1.8,
    });
  }, [selectedLocation]);

  // Fly to Sector Handler
  const handleFlyToSector = useCallback(
    (sec: OperationalSector) => {
      setActiveSector(sec);
      if (onSelectLocation) {
        onSelectLocation({
          name: sec.name,
          lat: sec.coordinates.lat,
          lon: sec.coordinates.lon,
        });
      }

      const viewer = viewerRef.current;
      if (viewer && !viewer.isDestroyed() && viewer.camera?.flyTo) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            sec.coordinates.lon,
            sec.coordinates.lat - 2.2,
            650000
          ),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-38),
            roll: 0.0,
          },
          duration: 2.0,
        });
      }
    },
    [onSelectLocation]
  );

  // Preset Selection Handler
  const handleSelectPreset = (preset: HistoricalPreset) => {
    setActivePreset(preset.id);
    setSelectedDate(preset.date);
    setDateRange({ start: preset.startDate, end: preset.endDate });

    if (onSelectLocation) {
      onSelectLocation(preset.center);
    }

    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed() && viewer.camera?.flyTo) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          preset.center.lon,
          preset.center.lat - 2.5,
          750000
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-38),
          roll: 0.0,
        },
        duration: 1.8,
      });
    }
  };

  // Export Markdown Research Brief
  const handleExportBrief = () => {
    if (!inspectResult) return;
    const content = `# JATAYU Earth & Climate Research Observatory Brief
**Generated:** ${new Date().toISOString()}
**Analyst:** ${user?.displayName || user?.username || 'Authorized Analyst'} (Role: ${user?.role || 'CITIZEN'})
**Geospatial Fix:** ${inspectResult.location.latitude.toFixed(4)}°N, ${inspectResult.location.longitude.toFixed(4)}°E
**Analyzed Temporal Window:** ${inspectResult.startDate} to ${inspectResult.endDate}

## Meteorological Telemetry
- **Cumulative Event Precipitation:** ${inspectResult.eventAccumulationMm.toFixed(1)} mm
- **Peak Single-Day Rainfall:** ${inspectResult.peakDailyRainMm.toFixed(1)} mm
- **Data Source:** ${inspectResult.dataSource}

## Daily Rainfall & Temperature Breakdown
| Date | Precipitation (mm) | Max Temp (°C) | Min Temp (°C) |
|---|---|---|---|
${inspectResult.daily.time
  .map(
    (d, i) =>
      `| ${d} | ${inspectResult.daily.precipitationSum[i] ?? 0} | ${inspectResult.daily.temperatureMax[i] ?? '-'} | ${inspectResult.daily.temperatureMin[i] ?? '-'} |`
  )
  .join('\n')}

---
*Provenance & Integrity Notice: JATAYU Earth & Climate Research Observatory strictly queries verified observational datasets (ERA5 / ERA5-Land Reanalysis via Open-Meteo). Experimental hydrodynamic models remain segregated under Tier-3 RBAC.*
`;

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JATAYU_Research_Brief_${inspectResult.location.latitude.toFixed(2)}N_${inspectResult.location.longitude.toFixed(2)}E_${inspectResult.startDate}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // HUD Camera Controls
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

    const lat = selectedLocation.lat;
    const lon = selectedLocation.lon;
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
      destination: Cesium.Cartesian3.fromDegrees(78.9629, 16.5, 2200000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-40),
        roll: 0.0,
      },
      duration: 2.0,
    });
    setIsObliqueView(true);
  };

  const handleRecenterSector = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !viewer.camera?.flyTo) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        selectedLocation.lon,
        selectedLocation.lat - 2.2,
        650000
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-38),
        roll: 0.0,
      },
      duration: 1.8,
    });
    setIsObliqueView(true);
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

  return (
    <div className="space-y-3">
      {/* Top Tactical Command Strip */}
      <div className="bg-navy-900 border border-navy-800 rounded-lg p-2.5 text-slate-300 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        {/* Left: Return action & Observatory Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onReturnTo2D}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-800 hover:bg-navy-750 text-slate-200 border border-navy-700 rounded text-xs font-mono font-medium transition-colors"
            title="Switch back to citizen 2D MapLibre view"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>2D TACTICAL MAP</span>
          </button>

          <div className="h-4 w-px bg-navy-750" />

          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-teal-400" />
            <span className="font-mono text-xs font-bold text-white tracking-wide">
              GOD’S EYE VIEW — CESIUM 3D COMMAND GLOBE
            </span>
            <span className="px-1.5 py-0.5 rounded bg-teal-950/80 border border-teal-800/80 text-[10px] font-mono text-teal-300 font-semibold">
              EARTH & CLIMATE RESEARCH OBSERVATORY
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-800/80 text-[10px] font-mono text-amber-400 font-semibold">
              ROLE: {user?.role || 'CITIZEN'}
            </span>
          </div>
        </div>

        {/* Right: Base Imagery Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono text-slate-400 uppercase">BASE:</span>
          {(Object.keys(IMAGERY_CONFIGS) as ImageryProviderType[]).map((key) => {
            const isSelected = activeImagery === key;
            const cfg = IMAGERY_CONFIGS[key];
            return (
              <button
                key={key}
                onClick={() => setActiveImagery(key)}
                className={`px-2 py-1 text-xs font-mono rounded border transition-colors ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-semibold'
                    : 'bg-navy-950 text-slate-400 border-navy-800 hover:text-slate-200'
                }`}
                title={cfg.label}
              >
                {cfg.buttonText}
              </button>
            );
          })}
        </div>
      </div>

      {/* Environmental Layer & Research Tools Bar */}
      <div className="bg-navy-900 border border-navy-800 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Layer Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-400 mr-1">
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-[11px] uppercase font-bold text-slate-300">LAYERS:</span>
          </div>

          {/* NASA Satellite Clouds */}
          <button
            onClick={() => setCloudsEnabled(!cloudsEnabled)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors ${
              cloudsEnabled
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/60 font-semibold'
                : 'bg-navy-950 text-slate-400 border-navy-800 hover:text-slate-200'
            }`}
            title="NASA GIBS MODIS Terra daily true-color cloud composite"
          >
            <Eye className="w-3.5 h-3.5 text-teal-400" />
            <span>{t('observatory.satelliteClouds')}</span>
            {cloudsEnabled && <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
          </button>

          {/* Doppler Radar */}
          <button
            onClick={() => setRadarEnabled(!radarEnabled)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors ${
              radarEnabled
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/60 font-semibold'
                : 'bg-navy-950 text-slate-400 border-navy-800 hover:text-slate-200'
            }`}
            title="RainViewer real-time Doppler radar mosaic"
          >
            <Radio className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('observatory.radarLoop')}</span>
            {radarEnabled && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
          </button>

          {/* Quarantined Adyar SFINCS Inundation */}
          <button
            onClick={() => setSfincsEnabled(!sfincsEnabled)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors ${
              sfincsEnabled
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 font-semibold'
                : 'bg-navy-950 text-slate-400 border-navy-800 hover:text-slate-200'
            }`}
            title="Quarantined Adyar 28km reach hydrodynamic inundation contours (Tier 3 RBAC)"
          >
            <Waves className="w-3.5 h-3.5 text-rose-400" />
            <span>{t('observatory.sfincsInundation')}</span>
            {user?.role !== 'RESEARCHER' && <Lock className="w-3 h-3 text-amber-400" />}
            {sfincsEnabled && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
          </button>
        </div>

        {/* Spatial Inspector Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsInspectMode(!isInspectMode)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded border transition-colors ${
              isInspectMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-bold shadow-sm'
                : 'bg-navy-950 text-slate-400 border-navy-800 hover:text-white'
            }`}
            title="Click anywhere on the 3D globe to query historical rainfall and elevation"
          >
            <Crosshair className={`w-3.5 h-3.5 ${isInspectMode ? 'text-amber-400 animate-spin' : 'text-slate-400'}`} />
            <span>{t('observatory.spatialInspection')}</span>
            {isInspectMode && <span className="text-[10px] text-amber-400 font-sans uppercase">ACTIVE</span>}
          </button>
        </div>
      </div>

      {/* Atmospheric Timeline & Event Presets Bar */}
      <div className="bg-navy-900 border border-navy-800 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-400 mr-1">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] uppercase font-bold text-slate-300">
              {t('observatory.timelineTitle')}:
            </span>
          </div>

          {HISTORICAL_PRESETS.map((preset) => {
            const isSelected = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`px-2.5 py-1 rounded border transition-colors ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/70 font-semibold'
                    : 'bg-navy-950 text-slate-400 border-navy-800 hover:text-slate-200'
                }`}
                title={preset.description}
              >
                {preset.name}
              </button>
            );
          })}
        </div>

        {/* Custom Date Input */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 uppercase">DATE:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedDate(val);
              setActivePreset('custom');
              // Adjust 5-day window around selected date
              const d = new Date(val);
              if (!isNaN(d.getTime())) {
                const s = new Date(d);
                s.setDate(d.getDate() - 3);
                const ed = new Date(d);
                ed.setDate(d.getDate() + 2);
                setDateRange({
                  start: s.toISOString().split('T')[0],
                  end: ed.toISOString().split('T')[0],
                });
              }
            }}
            className="bg-navy-950 border border-navy-750 text-slate-200 rounded px-2 py-0.5 text-xs font-mono focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {/* SFINCS RBAC Quarantine Advisory Banner */}
      {sfincsEnabled && sfincsError && (
        <div className="bg-red-950/80 border border-red-700/80 rounded-lg px-4 py-2.5 flex items-center justify-between text-red-200 text-xs font-mono shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{sfincsError}</span>
          </div>
          <button
            onClick={() => setSfincsEnabled(false)}
            className="px-2 py-0.5 bg-red-900/60 hover:bg-red-800 text-red-200 rounded text-[10px] uppercase font-bold"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* SFINCS Active Simulation Validation Warning Banner */}
      {sfincsEnabled && !sfincsError && (
        <div className="bg-amber-950/80 border border-amber-700/80 rounded-lg px-4 py-2 flex items-center justify-between text-amber-200 text-xs font-mono shadow-sm">
          <div className="flex items-center gap-2">
            <Waves className="w-4 h-4 text-cyan-400 flex-shrink-0 animate-pulse" />
            <span>
              DATA TRUST TIER: <strong>EXPERIMENTAL_UNVALIDATED</strong> — SFINCS {sfincsData?.metadata?.reach_length_km ? `${sfincsData.metadata.reach_length_km}KM REACH` : '28KM REACH'} ADYAR INUNDATION MODEL. DO NOT USE FOR TACTICAL RESCUE DISPATCH.
            </span>
          </div>
          {sfincsLoading && <span className="text-[10px] text-amber-400 animate-pulse uppercase">LOADING CONTOURS...</span>}
        </div>
      )}

      {/* CartoDB Watermark Advisory Banner */}
      {IMAGERY_CONFIGS[activeImagery].watermarked && (
        <div className="bg-amber-950/60 border border-amber-800/80 rounded-lg px-4 py-2 flex items-center justify-between text-amber-300 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              CartoDB unauthenticated tile watermark is active on this layer. For crisp unwatermarked tactical view, select <strong>ESRI DARK</strong> or <strong>ESRI SATELLITE</strong>.
            </span>
          </div>
          <button
            onClick={() => setActiveImagery('esri_dark')}
            className="px-2 py-0.5 bg-amber-500 text-navy-950 font-bold rounded text-[10px] hover:bg-amber-400 transition-colors uppercase ml-3 flex-shrink-0"
          >
            SWITCH TO ESRI DARK
          </button>
        </div>
      )}

      {/* Main 3D Viewport with Tactical HUD */}
      <div className={`relative w-full h-[680px] rounded-lg overflow-hidden border border-navy-800 shadow-md bg-navy-950 ${isInspectMode ? 'cursor-crosshair' : ''}`}>
        {/* Cesium Canvas Container */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Interactive Overlay HUD Wrapper */}
        <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
          {/* Top Row HUD */}
          <div className="flex items-start justify-between gap-4">
            {/* Left: Configured Operational Sectors Panel */}
            <div className="pointer-events-auto max-w-sm bg-navy-900/90 backdrop-blur-sm border border-navy-700/80 rounded-lg p-3 text-slate-200 shadow-lg">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-navy-800">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Operational Sectors
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {sectors.length} REGIONS
                </span>
              </div>

              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {sectors.map((sec) => {
                  const isCurrent =
                    selectedLocation.lat === sec.coordinates.lat &&
                    selectedLocation.lon === sec.coordinates.lon;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => handleFlyToSector(sec)}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-center justify-between border ${
                        isCurrent
                          ? 'bg-amber-500/20 border-amber-500/50 text-white font-semibold'
                          : 'bg-navy-950/80 border-navy-800/80 text-slate-300 hover:bg-navy-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className={`w-3.5 h-3.5 ${isCurrent ? 'text-amber-400' : 'text-slate-500'}`} />
                        <div>
                          <div className="text-[11px] font-mono font-medium">{sec.name}</div>
                          <div className="text-[9px] text-slate-400 font-sans">{sec.tacticalZone}</div>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono text-slate-400">
                        {sec.coordinates.lat.toFixed(2)}°N
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 pt-2 border-t border-navy-800/80 text-[10px] text-slate-400 font-sans leading-tight">
                Click list or globe beacon to re-orient perspective.
              </div>
            </div>

            {/* Right: Telemetry & Camera HUD */}
            <div className="flex flex-col items-end gap-3">
              {/* Telemetry Badge */}
              <div className="pointer-events-auto bg-navy-900/90 backdrop-blur-sm border border-navy-700/80 rounded-lg p-3 text-slate-200 shadow-lg min-w-[240px]">
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-navy-800">
                  <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase">
                    ACTIVE FIX TELEMETRY
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>

                <div className="space-y-1 text-xs">
                  <div className="font-bold text-white font-mono">{selectedLocation.name}</div>
                  <div className="font-mono text-[11px] text-amber-300">
                    {selectedLocation.lat.toFixed(4)}°N, {selectedLocation.lon.toFixed(4)}°E
                  </div>
                  {activeSector && (
                    <div className="text-[10px] text-slate-400 font-sans mt-1">
                      Zone: <span className="text-slate-200 font-mono">{activeSector.tacticalZone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Camera Controls HUD */}
              <div className="pointer-events-auto bg-navy-900/90 backdrop-blur-sm border border-navy-700/80 rounded-lg p-2 text-slate-200 shadow-lg flex flex-col gap-1.5">
                <span className="text-[9px] font-mono text-slate-400 uppercase px-1 text-center font-bold">
                  CAMERA HUD
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleZoom('in')}
                    className="p-1.5 bg-navy-950 hover:bg-navy-800 border border-navy-700 rounded text-slate-300 hover:text-white transition-colors"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4 text-teal-400" />
                  </button>
                  <button
                    onClick={() => handleZoom('out')}
                    className="p-1.5 bg-navy-950 hover:bg-navy-800 border border-navy-700 rounded text-slate-300 hover:text-white transition-colors"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4 text-teal-400" />
                  </button>
                  <button
                    onClick={handleToggleTilt}
                    className={`px-2 py-1 text-[10px] font-mono rounded border flex items-center gap-1 transition-colors ${
                      isObliqueView
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-navy-950 text-slate-400 border-navy-700'
                    }`}
                    title="Toggle Oblique Curvature Perspective"
                  >
                    <RotateCw className="w-3 h-3 text-amber-400" />
                    <span>{isObliqueView ? '3D OBLIQUE' : '2D NADIR'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 mt-0.5">
                  <button
                    onClick={handleRecenterSector}
                    className="flex-1 py-1 px-1.5 bg-navy-950 hover:bg-navy-800 border border-navy-700 rounded text-[10px] font-mono text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-1"
                    title="Focus on Current Sector"
                  >
                    <Crosshair className="w-3 h-3 text-amber-400" />
                    <span>FOCUS</span>
                  </button>
                  <button
                    onClick={handleResetOverview}
                    className="flex-1 py-1 px-1.5 bg-navy-950 hover:bg-navy-800 border border-navy-700 rounded text-[10px] font-mono text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-1"
                    title="Reset to Subcontinent Overview"
                  >
                    <Globe className="w-3 h-3 text-teal-400" />
                    <span>INDIA</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Spatial Coordinate Inspector Panel (Floats on Bottom-Left when active/inspected) */}
          {(inspectResult || inspectLoading || inspectError) && (
            <div className="pointer-events-auto max-w-md bg-navy-900/95 backdrop-blur-md border border-amber-500/70 rounded-lg p-3 text-slate-200 shadow-2xl mb-2">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-navy-800">
                <div className="flex items-center gap-2">
                  <CloudRain className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    CLIMATE & PRECIPITATION INSPECTOR
                  </h4>
                </div>
                <button
                  onClick={() => {
                    setInspectResult(null);
                    setInspectError(null);
                  }}
                  className="p-1 hover:bg-navy-800 text-slate-400 hover:text-white rounded"
                  title="Close Inspector"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {inspectLoading && (
                <div className="py-4 text-center text-xs font-mono text-amber-400 animate-pulse flex items-center justify-center gap-2">
                  <Crosshair className="w-4 h-4 animate-spin" />
                  <span>Querying Copernicus ERA5 archive via Open-Meteo...</span>
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
                  <div className="flex items-center justify-between text-[11px] bg-navy-950/80 p-2 rounded border border-navy-800">
                    <div>
                      <span className="text-slate-400">FIX:</span>{' '}
                      <span className="text-white font-bold">
                        {inspectResult.location.latitude.toFixed(4)}°N, {inspectResult.location.longitude.toFixed(4)}°E
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">WINDOW:</span>{' '}
                      <span className="text-amber-300 font-semibold">
                        {inspectResult.startDate} to {inspectResult.endDate}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-navy-950/90 border border-navy-800 p-2 rounded">
                      <div className="text-[10px] text-slate-400 uppercase">Event Accumulation</div>
                      <div className="text-base font-bold text-amber-400 mt-0.5">
                        {inspectResult.eventAccumulationMm.toFixed(1)} <span className="text-xs font-normal">mm</span>
                      </div>
                    </div>
                    <div className="bg-navy-950/90 border border-navy-800 p-2 rounded">
                      <div className="text-[10px] text-slate-400 uppercase">Peak Daily Rain</div>
                      <div className="text-base font-bold text-cyan-400 mt-0.5">
                        {inspectResult.peakDailyRainMm.toFixed(1)} <span className="text-xs font-normal">mm</span>
                      </div>
                    </div>
                  </div>

                  {/* Daily Rainfall Breakdown */}
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1 bg-navy-950/50 p-1.5 rounded border border-navy-800/60">
                    {inspectResult.daily.time.map((d, i) => (
                      <div key={d} className="flex items-center justify-between text-[10px] py-0.5 px-1 rounded hover:bg-navy-800/50">
                        <span className="text-slate-300">{d}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-amber-300 font-semibold">
                            {inspectResult.daily.precipitationSum[i] ?? 0} mm
                          </span>
                          <span className="text-slate-500">
                            ({inspectResult.daily.temperatureMax[i] ?? '-'}° / {inspectResult.daily.temperatureMin[i] ?? '-'}°C)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Export Brief Action */}
                  <div className="pt-1 flex items-center justify-between border-t border-navy-800">
                    <span className="text-[9px] text-slate-400">Source: {inspectResult.dataSource}</span>
                    <button
                      onClick={handleExportBrief}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold text-[10px] rounded transition-colors uppercase shadow-sm"
                    >
                      <FileDown className="w-3 h-3" />
                      <span>EXPORT RESEARCH BRIEF</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Attribution Bar */}
          <div className="pointer-events-auto bg-navy-950/85 backdrop-blur-sm px-3 py-1 rounded text-[10px] text-slate-400 font-mono flex items-center justify-between border border-navy-800/60 mt-auto">
            <div className="truncate pr-2">{IMAGERY_CONFIGS[activeImagery].credit}</div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {globeContext?.disclaimer && (
                <span className="text-amber-400/90 hidden md:inline">
                  {globeContext.disclaimer}
                </span>
              )}
              <span className="text-slate-500">CESIUM 3D ENGINE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Command3DView;
