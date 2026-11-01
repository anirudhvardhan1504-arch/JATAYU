import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLatestRadarInfo, getRainViewerTimeline } from '../services/radar';

describe('JATAYU Phase 4 Radar Service Unit Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('1. correctly parses valid RainViewer metadata payload into latest radar frame', async () => {
    const mockPayload = {
      version: 'v2',
      generated: 1700000000,
      host: 'https://tilecache.rainviewer.com',
      radar: {
        past: [
          { time: 1699999000, path: '/v2/radar/1699999000' },
          { time: 1700000000, path: '/v2/radar/1700000000' },
        ],
        nowcast: [],
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPayload,
    } as any);

    const result = await getLatestRadarInfo();
    expect(result).not.toBeNull();
    expect(result?.host).toBe('https://tilecache.rainviewer.com');
    expect(result?.timestamp).toBe(1700000000);
    expect(result?.latestPath).toBe('/v2/radar/1700000000');
    expect(result?.tileUrl).toContain('https://tilecache.rainviewer.com/v2/radar/1700000000/256/{z}/{x}/{y}/2/1_1.png');
    expect(result?.sourceAttribution).toContain('RainViewer');
  });

  it('2. handles network failure gracefully by returning null without throwing', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network connection failed'));

    const result = await getLatestRadarInfo();
    expect(result).toBeNull();
  });

  it('3. handles empty radar past frames by returning null', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: 'v2',
        generated: 1700000000,
        host: 'https://tilecache.rainviewer.com',
        radar: { past: [], nowcast: [] },
      }),
    } as any);

    const result = await getLatestRadarInfo();
    expect(result).toBeNull();
  });

  it('4. builds full radar and satellite animation timeline', async () => {
    const mockTimelinePayload = {
      version: 'v2',
      generated: 1700000000,
      host: 'https://tilecache.rainviewer.com',
      radar: {
        past: [{ time: 1699999000, path: '/v2/radar/1' }],
        nowcast: [{ time: 1700001000, path: '/v2/radar/2' }],
      },
      satellite: {
        infrared: [{ time: 1699999000, path: '/v2/sat/1' }],
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTimelinePayload,
    } as any);

    const timeline = await getRainViewerTimeline();
    expect(timeline).not.toBeNull();
    expect(timeline?.radarFrames.length).toBe(2);
    expect(timeline?.satelliteFrames.length).toBe(1);
    expect(timeline?.satelliteAvailable).toBe(true);
    expect(timeline?.radarFrames[0].tileUrl).toContain('/256/{z}/{x}/{y}/2/1_1.png');
    expect(timeline?.satelliteFrames[0].tileUrl).toContain('/256/{z}/{x}/{y}/0/0_0.png');
  });
});
