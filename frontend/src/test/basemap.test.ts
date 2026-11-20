import { describe, it, expect, vi } from 'vitest';
import type { LayerSpecification, Map } from 'maplibre-gl';
import { applyBasemap, IMAGERY_SOURCE } from '../services/basemap';

const base: LayerSpecification[] = [
  { id:'background',type:'background' },
  { id:'roads',type:'line',source:'base' },
  { id:'place-labels',type:'symbol',source:'base',layout:{'text-field':'Hyderabad'},paint:{'text-color':'#334155','text-halo-color':'#ffffff','text-halo-width':1} },
];
function mockMap() {
  const sources = new Set<string>(); const layers = new Set(base.map(layer => layer.id));
  return { getSource:vi.fn((id:string)=>sources.has(id)),getLayer:vi.fn((id:string)=>layers.has(id)),
    addSource:vi.fn((id:string)=>sources.add(id)),addLayer:vi.fn((layer:LayerSpecification)=>layers.add(layer.id)),
    setLayoutProperty:vi.fn(),setPaintProperty:vi.fn(),setStyle:vi.fn(),flyTo:vi.fn() };
}
describe('Satellite basemap controls',()=>{
  it('adds credited imagery underneath the original style without replacing weather layers or the viewport',()=>{
    const map=mockMap();applyBasemap(map as unknown as Map,base,'satellite',true);
    expect(map.addSource).toHaveBeenCalledWith(IMAGERY_SOURCE,expect.objectContaining({type:'raster',attribution:expect.stringContaining('Esri')}));
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({id:IMAGERY_SOURCE}),'background');
    expect(map.setLayoutProperty).toHaveBeenCalledWith('roads','visibility','none');
    expect(map.setPaintProperty).toHaveBeenCalledWith('place-labels','text-color','#F8FAFC');
    expect(map.setStyle).not.toHaveBeenCalled();expect(map.flyTo).not.toHaveBeenCalled();
    expect(map.setLayoutProperty.mock.calls.some(([id])=>id==='rainviewer-radar-layer')).toBe(false);
  });
  it('restores the street map and label contrast, and avoids duplicating imagery sources',()=>{
    const map=mockMap();applyBasemap(map as unknown as Map,base,'satellite',true);
    applyBasemap(map as unknown as Map,base,'satellite',false);
    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.setLayoutProperty).toHaveBeenCalledWith('place-labels','visibility','none');
    applyBasemap(map as unknown as Map,base,'map',true);
    expect(map.setLayoutProperty).toHaveBeenCalledWith('roads','visibility','visible');
    expect(map.setPaintProperty).toHaveBeenCalledWith('place-labels','text-color','#334155');
  });
});
