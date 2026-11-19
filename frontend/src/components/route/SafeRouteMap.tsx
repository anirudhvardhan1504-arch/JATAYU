import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import {
  EvaluatedRoute,
  EmergencyFacility,
  LocationPoint,
} from '../../types';

interface SafeRouteMapProps {
  center: [number, number]; // [lon, lat]
  zoom?: number;
  origin: LocationPoint | null;
  destination: LocationPoint | null;
  routes: EvaluatedRoute[];
  selectedRouteId: string | null;
  onSelectRoute?: (routeId: string) => void;
  facilities: EmergencyFacility[];
  selectedFacility: EmergencyFacility | null;
  onSelectFacility?: (facility: EmergencyFacility | null) => void;
  onSetDestination?: (facility: EmergencyFacility) => void;
  pickingMode?: 'origin' | 'destination' | null;
  onMapPick?: (coords: { lat: number; lon: number }, mode: 'origin' | 'destination') => void;
  onCancelPick?: () => void;
  className?: string;
}

export const SafeRouteMap: React.FC<SafeRouteMapProps> = ({
  center,
  zoom = 11,
  origin,
  destination,
  routes,
  selectedRouteId,
  onSelectRoute,
  facilities,
  selectedFacility: _selectedFacility,
  onSelectFacility: _onSelectFacility,
  onSetDestination,
  pickingMode = null,
  onMapPick,
  onCancelPick,
  className = '',
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const pickingModeRef = useRef<'origin' | 'destination' | null>(pickingMode);
  pickingModeRef.current = pickingMode;
  const [mapError, setMapError] = useState<string | null>(null);

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!mapContainer.current) return;
    setMapError(null);

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: center,
        zoom: zoom,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

      map.on('click', (e) => {
        if (pickingModeRef.current && onMapPick) {
          onMapPick({ lat: e.lngLat.lat, lon: e.lngLat.lng }, pickingModeRef.current);
        }
      });

      map.on('error', (e) => {
        console.warn('[SafeRouteMap] MapLibre warning/error:', e);
      });

      mapRef.current = map;
    } catch (err: any) {
      setMapError(err?.message || 'Geospatial Canvas Initialization Error');
      return;
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      try {
        map.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
    };
  }, []);

  // Update center when location changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routes.length === 0 && center) {
      map.easeTo({ center, zoom: 11 });
    }
  }, [center, routes.length]);

  // Update Route Layers and Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing HTML markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const setupLayers = () => {
      // 1. Remove existing route sources and layers
      for (let i = 0; i < 10; i++) {
        const layerId = `route-line-${i}`;
        const sourceId = `route-source-${i}`;
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }

      // Remove hazard layer/source if exists
      if (map.getLayer('hazard-points-layer')) map.removeLayer('hazard-points-layer');
      if (map.getSource('hazard-points-source')) map.removeSource('hazard-points-source');

      if (routes.length === 0) return;

      const bounds = new maplibregl.LngLatBounds();

      // 2. Add route polylines
      routes.forEach((route, idx) => {
        const sourceId = `route-source-${idx}`;
        const layerId = `route-line-${idx}`;
        const isSelected = route.id === selectedRouteId;

        const coords = route.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length === 0) return;

        coords.forEach((coord) => bounds.extend(coord as [number, number]));

        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: route.geometry,
            properties: { id: route.id, isSelected },
          },
        });

        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': isSelected ? '#0284C7' : '#64748B',
            'line-width': isSelected ? 5 : 3,
            'line-opacity': isSelected ? 0.95 : 0.6,
            'line-dasharray': isSelected ? [1] : [2, 2],
          },
        });

        // Click on route polyline to select
        map.on('click', layerId, () => {
          if (onSelectRoute) onSelectRoute(route.id);
        });
      });

      // Fit bounds to routes
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1000 });
      }

      // 3. Add Hazard Markers along active route
      const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];
      if (activeRoute && activeRoute.hazards.length > 0) {
        activeRoute.hazards.forEach((hazard) => {
          const el = document.createElement('div');
          el.className = `w-7 h-7 rounded-full flex items-center justify-center cursor-pointer shadow-lg border-2 ${
            hazard.severity === 'CRITICAL' || hazard.severity === 'HIGH'
              ? 'bg-red-600/90 border-red-300 text-white animate-pulse'
              : 'bg-amber-500/90 border-amber-200 text-navy-950'
          }`;
          el.innerHTML = `<span style="font-weight:bold;font-size:12px;">!</span>`;

          const popupContent = `
            <div style="font-family:ui-monospace,monospace;font-size:11px;color:#0f172a;padding:4px;max-width:240px;">
              <div style="font-weight:bold;color:${hazard.severity === 'HIGH' ? '#b91c1c' : '#d97706'};margin-bottom:2px;">
                ${hazard.title}
              </div>
              <div style="font-size:10px;color:#334155;margin-bottom:4px;">
                ${hazard.description}
              </div>
              <div style="font-size:9px;color:#64748b;">
                Source: ${hazard.dataSource}
              </div>
            </div>
          `;

          const popup = new maplibregl.Popup({ offset: 12 }).setHTML(popupContent);

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(hazard.coordinate)
            .setPopup(popup)
            .addTo(map);

          markersRef.current.push(marker);
        });
      }
    };

    if (map.isStyleLoaded()) {
      setupLayers();
    } else {
      map.once('load', setupLayers);
    }
  }, [routes, selectedRouteId, onSelectRoute]);

  // Update cursor based on pickingMode
  useEffect(() => {
    if (mapContainer.current) {
      mapContainer.current.style.cursor = pickingMode ? 'crosshair' : '';
    }
  }, [pickingMode]);

  // Add Origin and Destination Markers (draggable for interactive repositioning)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (origin) {
      const origEl = document.createElement('div');
      origEl.className = 'w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-md cursor-grab active:cursor-grabbing';
      origEl.innerText = 'A';
      origEl.title = 'Start Location (drag to reposition)';
      const m = new maplibregl.Marker({ element: origEl, draggable: true })
        .setLngLat([origin.longitude, origin.latitude])
        .addTo(map);

      if (typeof m.on === 'function') {
        m.on('dragend', () => {
          const lngLat = m.getLngLat();
          if (onMapPick) onMapPick({ lat: lngLat.lat, lon: lngLat.lng }, 'origin');
        });
      }

      markersRef.current.push(m);
    }

    if (destination) {
      const destEl = document.createElement('div');
      destEl.className = 'w-6 h-6 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-md cursor-grab active:cursor-grabbing';
      destEl.innerText = 'B';
      destEl.title = 'Destination (drag to reposition)';
      const m = new maplibregl.Marker({ element: destEl, draggable: true })
        .setLngLat([destination.longitude, destination.latitude])
        .addTo(map);

      if (typeof m.on === 'function') {
        m.on('dragend', () => {
          const lngLat = m.getLngLat();
          if (onMapPick) onMapPick({ lat: lngLat.lat, lon: lngLat.lng }, 'destination');
        });
      }

      markersRef.current.push(m);
    }
  }, [origin, destination, onMapPick]);

  // Add Emergency Facility Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    facilities.forEach((fac) => {
      const el = document.createElement('div');
      let bgColor = 'bg-blue-600';
      let iconText = '⌂'; // shelter
      if (fac.category === 'HOSPITAL') {
        bgColor = 'bg-red-600';
        iconText = '+';
      } else if (fac.category === 'EMERGENCY_OPS') {
        bgColor = 'bg-amber-600';
        iconText = '★';
      }

      el.className = `w-6 h-6 rounded-md ${bgColor} border border-white flex items-center justify-center text-xs font-bold text-white shadow cursor-pointer hover:scale-110 transition-transform`;
      el.innerHTML = `<span>${iconText}</span>`;

      const popupNode = document.createElement('div');
      popupNode.style.fontFamily = 'ui-monospace, monospace';
      popupNode.style.fontSize = '11px';
      popupNode.style.color = '#0f172a';
      popupNode.style.padding = '4px';
      popupNode.style.maxWidth = '240px';

      popupNode.className = 'p-3 bg-[#101A17] text-[#F0F7F4] rounded-xl border border-white/20 shadow-xl font-sans';
      popupNode.innerHTML = `
        <div style="font-weight:bold;color:#F0F7F4;font-size:12px;margin-bottom:3px;">${fac.name}</div>
        <div style="font-size:11px;color:#B5C5BF;margin-bottom:3px;">${fac.address}</div>
        <div style="font-size:11px;color:#8A9C95;margin-bottom:4px;font-family:monospace;">Tel: ${fac.phone || 'N/A'}</div>
        <div style="font-size:10px;color:#FBBF24;margin-bottom:8px;font-family:monospace;">Status: Verification required on arrival</div>
        <button id="btn-dest-${fac.id}" style="width:100%;padding:6px 10px;background:#00D99A;color:#080D0D;border:none;border-radius:8px;font-size:11px;font-weight:bold;cursor:pointer;">
          Route to this Facility
        </button>
      `;

      const popup = new maplibregl.Popup({ offset: 10 }).setDOMContent(popupNode);

      popup.on('open', () => {
        const btn = document.getElementById(`btn-dest-${fac.id}`);
        if (btn) {
          btn.onclick = () => {
            if (onSetDestination) onSetDestination(fac);
            popup.remove();
          };
        }
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([fac.location.longitude, fac.location.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [facilities, onSetDestination]);

  if (mapError) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 bg-navy-950 border border-red-900/50 rounded text-center ${className}`}>
        <div className="text-red-400 font-mono text-xs font-bold mb-2">GEOSPATIAL CANVAS ERROR</div>
        <p className="text-slate-400 text-xs font-sans max-w-md">{mapError}</p>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full min-h-[450px] rounded overflow-hidden border border-slate-300 dark:border-navy-700 ${className}`}>
      <div ref={mapContainer} className="w-full h-full" />

      {/* Picking Mode Banner */}
      {pickingMode && (
        <div className="absolute top-3 right-14 bg-amber-500 text-slate-950 font-mono text-xs px-3 py-2 rounded shadow-xl flex items-center gap-3 border border-amber-300 z-10 animate-pulse">
          <span className="font-bold">
            Click map to set {pickingMode === 'origin' ? 'START (A)' : 'DESTINATION (B)'}
          </span>
          {onCancelPick && (
            <button
              onClick={onCancelPick}
              className="bg-navy-950 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase hover:bg-navy-900 border border-amber-400"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Map Legend HUD */}
      <div className="absolute top-3 left-3 bg-obsidian/90 backdrop-blur-md border border-white/15 rounded-2xl px-3.5 py-3 text-xs font-sans text-jatayu-primary shadow-2xl pointer-events-none space-y-2">
        <div className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">ROUTE & HAZARD LEGEND</div>
        <div className="flex items-center gap-2.5 text-jatayu-secondary font-medium">
          <span className="w-3.5 h-1.5 bg-[#00D99A] rounded-full shadow-[0_0_8px_#00D99A]" />
          <span>Selected Route</span>
        </div>
        <div className="flex items-center gap-2.5 text-jatayu-secondary font-medium">
          <span className="w-3.5 h-1.5 bg-[#71827B] border-t border-dashed border-white/40" />
          <span>Alternative Corridor</span>
        </div>
        <div className="flex items-center gap-2.5 text-jatayu-secondary font-medium">
          <span className="w-3 h-3 rounded-full bg-red-600 border border-white text-white flex items-center justify-center text-[8px] font-bold">!</span>
          <span>Flood / Alert Hazard</span>
        </div>
        <div className="flex items-center gap-2.5 text-jatayu-secondary font-medium">
          <span className="w-3 h-3 rounded bg-blue-600 text-white flex items-center justify-center text-[8px]">⌂</span>
          <span>Evacuation Shelter</span>
        </div>
        <div className="flex items-center gap-2.5 text-jatayu-secondary font-medium">
          <span className="w-3 h-3 rounded bg-red-600 text-white flex items-center justify-center text-[8px]">+</span>
          <span>Emergency Hospital</span>
        </div>
      </div>
    </div>
  );
};
