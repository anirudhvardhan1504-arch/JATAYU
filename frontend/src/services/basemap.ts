import type { LayerSpecification, Map } from 'maplibre-gl';

export type BasemapMode = 'map' | 'satellite';
export const IMAGERY_SOURCE = 'jatayu-world-imagery';

/** Switch only basemap layers. Weather, facilities and research overlays remain mounted. */
export function applyBasemap(map: Map, baseLayers: LayerSpecification[], mode: BasemapMode, labels: boolean) {
  if (mode === 'satellite' && !map.getSource(IMAGERY_SOURCE)) {
    map.addSource(IMAGERY_SOURCE, {
      type: 'raster', tileSize: 256, maxzoom: 19,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    });
    map.addLayer({ id: IMAGERY_SOURCE, type: 'raster', source: IMAGERY_SOURCE, paint: { 'raster-opacity': 1 } }, baseLayers[0]?.id);
  }
  if (map.getLayer(IMAGERY_SOURCE)) map.setLayoutProperty(IMAGERY_SOURCE, 'visibility', mode === 'satellite' ? 'visible' : 'none');
  for (const layer of baseLayers) {
    if (!map.getLayer(layer.id)) continue;
    const symbol = layer.type === 'symbol';
    const originalVisibility = layer.layout?.visibility || 'visible';
    map.setLayoutProperty(layer.id, 'visibility', symbol ? (labels ? originalVisibility : 'none') : (mode === 'satellite' ? 'none' : originalVisibility));
    if (symbol && layer.layout?.['text-field']) {
      map.setPaintProperty(layer.id, 'text-color', mode === 'satellite' ? '#F8FAFC' : layer.paint?.['text-color'] || '#475569');
      map.setPaintProperty(layer.id, 'text-halo-color', mode === 'satellite' ? '#16232C' : layer.paint?.['text-halo-color'] || '#FFFFFF');
      map.setPaintProperty(layer.id, 'text-halo-width', mode === 'satellite' ? 1.4 : layer.paint?.['text-halo-width'] || 1);
    }
  }
}
