import { describe, it, expect } from 'vitest';
import {
  SATELLITE_PRODUCTS,
  SECTOR_VIEWING_CHARACTERISTICS,
  getSatelliteTileUrl,
  getEstimatedLiveObservationTime,
  generateSatelliteTimeline,
} from '../services/satellite';

describe('Satellite Service Unit Tests', () => {
  it('defines valid satellite products for live and HD modes', () => {
    expect(SATELLITE_PRODUCTS.ir).toBeDefined();
    expect(SATELLITE_PRODUCTS.visible).toBeDefined();
    expect(SATELLITE_PRODUCTS.airmass).toBeDefined();
    expect(SATELLITE_PRODUCTS.viirs).toBeDefined();
    expect(SATELLITE_PRODUCTS.modis).toBeDefined();

    expect(SATELLITE_PRODUCTS.ir.mode).toBe('live');
    expect(SATELLITE_PRODUCTS.ir.maxZoom).toBe(6);
    expect(SATELLITE_PRODUCTS.ir.format).toBe('png');

    expect(SATELLITE_PRODUCTS.visible.mode).toBe('live');
    expect(SATELLITE_PRODUCTS.visible.isDaylightOnly).toBe(true);
    expect(SATELLITE_PRODUCTS.visible.maxZoom).toBe(7);

    expect(SATELLITE_PRODUCTS.viirs.mode).toBe('hd');
    expect(SATELLITE_PRODUCTS.viirs.nativeResolution).toBe('250 m at equator');
    expect(SATELLITE_PRODUCTS.viirs.format).toBe('jpg');
    expect(SATELLITE_PRODUCTS.viirs.maxZoom).toBe(9);
  });

  it('constructs correct NASA GIBS EPSG:3857 WMTS REST tile URLs', () => {
    const irUrl = getSatelliteTileUrl('ir');
    expect(irUrl).toContain('Himawari_AHI_Band13_Clean_Infrared');
    expect(irUrl).toContain('GoogleMapsCompatible_Level6');
    expect(irUrl).toContain('/default/default/');
    expect(irUrl).toContain('{z}/{y}/{x}.png');

    const visibleUrl = getSatelliteTileUrl('visible', '2026-11-12T06:00:00Z');
    expect(visibleUrl).toContain('Himawari_AHI_Band3_Red_Visible_1km');
    expect(visibleUrl).toContain('GoogleMapsCompatible_Level7');
    expect(visibleUrl).toContain('/default/2026-11-12T06:00:00Z/');
    expect(visibleUrl).toContain('{z}/{y}/{x}.png');

    const viirsUrl = getSatelliteTileUrl('viirs');
    expect(viirsUrl).toContain('VIIRS_NOAA20_CorrectedReflectance_TrueColor');
    expect(viirsUrl).toContain('GoogleMapsCompatible_Level9');
    expect(viirsUrl).toContain('{z}/{y}/{x}.jpg');
  });

  it('computes approximate live observation time accounting for ~40min GIBS latency', () => {
    const obs = getEstimatedLiveObservationTime();
    expect(obs.latencyMinutes).toBe(40);
    expect(obs.observationIso).toBeDefined();
    expect(obs.observationTimeLabel).toContain('UTC (approx.)');
  });

  it('contains geographic viewing characteristics for Indian operational sectors', () => {
    expect(SECTOR_VIEWING_CHARACTERISTICS.Mumbai).toBeDefined();
    expect(SECTOR_VIEWING_CHARACTERISTICS.Mumbai.viewingAngle).toContain('~72°');
    expect(SECTOR_VIEWING_CHARACTERISTICS.Guwahati).toBeDefined();
    expect(SECTOR_VIEWING_CHARACTERISTICS.Guwahati.viewingAngle).toContain('~50°');
    expect(SECTOR_VIEWING_CHARACTERISTICS.Chennai).toBeDefined();
    expect(SECTOR_VIEWING_CHARACTERISTICS.Kolkata).toBeDefined();
    expect(SECTOR_VIEWING_CHARACTERISTICS.Dehradun).toBeDefined();
  });

  it('generates chronological geostationary observation timeline with 10-minute cadence', () => {
    const timeline = generateSatelliteTimeline('ir', 12);
    expect(timeline.productKey).toBe('ir');
    expect(timeline.latencyMinutes).toBe(40);
    expect(timeline.frames.length).toBe(12);

    // Verify chronological order and 10-minute (600s) spacing
    for (let i = 0; i < timeline.frames.length - 1; i++) {
      const current = timeline.frames[i];
      const next = timeline.frames[i + 1];
      expect(next.time - current.time).toBe(600); // 10 minutes
      expect(current.isLatest).toBe(false);
      expect(current.tileUrl).toContain(current.isoString);
    }

    const latestFrame = timeline.frames[timeline.frames.length - 1];
    expect(latestFrame.isLatest).toBe(true);
    expect(latestFrame.relativeTime).toContain('40m ago (Latest)');
    expect(latestFrame.tileUrl).toContain('Himawari_AHI_Band13_Clean_Infrared');
    expect(latestFrame.tileUrl).toContain(latestFrame.isoString);
  });

  it('isolates HD daily optical composites from 10-minute geostationary animation', () => {
    const viirsTimeline = generateSatelliteTimeline('viirs');
    expect(viirsTimeline.productKey).toBe('viirs');
    expect(viirsTimeline.frames.length).toBe(1);
    expect(viirsTimeline.frames[0].relativeTime).toBe('Daily Composite');
    expect(viirsTimeline.frames[0].isLatest).toBe(true);
    expect(viirsTimeline.frames[0].tileUrl).toContain('VIIRS_NOAA20_CorrectedReflectance_TrueColor');

    const modisTimeline = generateSatelliteTimeline('modis');
    expect(modisTimeline.frames.length).toBe(1);
    expect(modisTimeline.frames[0].relativeTime).toBe('Daily Composite');
    expect(modisTimeline.frames[0].tileUrl).toContain('MODIS_Terra_CorrectedReflectance_TrueColor');
  });
});
