import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapTimeline } from '../components/map/MapTimeline';
import type { ForecastGridResponse } from '../services/forecast';

describe('MapTimeline Component: Phase 3C Unified Timeline Integration', () => {
  const mockForecastGrid: ForecastGridResponse = {
    metadata: {
      provider: 'Open-Meteo ECMWF Open Data',
      model: 'ECMWF IFS (0.25°)',
      nativeResolution: '0.25° regular lat/lon',
      isFallback: false,
      runCycle: '00Z',
      initializationTime: '2026-11-13T00:00',
      generatedAt: '2026-11-13T00:05:00Z',
      validStartTime: '2026-11-13T00:00',
      validEndTime: '2026-11-16T00:00',
      totalTimesteps: 72,
      gridNodeCount: 42,
      deduplicatedNodeCount: 42,
      mode: 'sector',
      activeSector: 'mumbai',
      isInterpolatedMesh: true,
      disclosure: 'Mesoscale surface',
      attribution: 'ECMWF',
      isStale: false,
      cacheTtlMs: 3600000,
      billableCallsIncurred: 1,
      dailyBudgetRemaining: 7990,
    },
    nodes: [
      {
        requestedLat: 19.0,
        requestedLon: 72.8,
        modelLat: 19.0,
        modelLon: 72.75,
        elevationM: 10,
        accum24hMm: 20,
        accum72hMm: 50,
        maxWindGustKmh: 45,
        minPressureMslHpa: 1008,
        hourly: Array.from({ length: 72 }, (_, i) => ({
          time: `2026-11-13T${i.toString().padStart(2, '0')}:00`,
          precipitationMm: 2.0,
          rainMm: 2.0,
          showersMm: 0,
          temperatureC: 28,
          apparentTemperatureC: 30,
          relativeHumidityPercent: 70,
          pressureMslHpa: 1012,
          surfacePressureHpa: 1011,
          windSpeedKmh: 20,
          windDirectionDegrees: 240,
          windGustsKmh: 30,
          uMs: 5.0,
          vMs: 2.0,
        })),
      },
    ],
  };

  it('renders dual category selector (LIVE OBS vs 72H FORECAST) when both live and forecast layers are active', () => {
    const onModeChange = vi.fn();
    render(
      <MapTimeline
        timeline={null}
        activeFrameIndex={0}
        isPlaying={false}
        playbackSpeed={800}
        onTogglePlay={vi.fn()}
        onStepBack={vi.fn()}
        onStepForward={vi.fn()}
        onSeek={vi.fn()}
        onChangeSpeed={vi.fn()}
        showRadar={true}
        showSatellite={false}
        hasActiveForecastLayer={true}
        forecastGrid={mockForecastGrid}
        timelineMode="live"
        onChangeTimelineMode={onModeChange}
      />
    );

    const liveBtn = screen.getByText('LIVE OBS');
    const forecastBtn = screen.getByText('72H FORECAST');

    expect(liveBtn).toBeInTheDocument();
    expect(forecastBtn).toBeInTheDocument();

    fireEvent.click(forecastBtn);
    expect(onModeChange).toHaveBeenCalledWith('forecast');
  });

  it('renders 72-hour forecast timeline controls and metadata in forecast mode', () => {
    const onTogglePlay = vi.fn();
    const onStepBack = vi.fn();
    const onStepForward = vi.fn();
    const onSeek = vi.fn();
    const onSpeed = vi.fn();

    render(
      <MapTimeline
        timeline={null}
        activeFrameIndex={0}
        isPlaying={false}
        playbackSpeed={800}
        onTogglePlay={vi.fn()}
        onStepBack={vi.fn()}
        onStepForward={vi.fn()}
        onSeek={vi.fn()}
        onChangeSpeed={vi.fn()}
        showRadar={false}
        showSatellite={false}
        hasActiveForecastLayer={true}
        forecastGrid={mockForecastGrid}
        activeForecastTimestepIndex={12}
        isForecastPlaying={false}
        forecastPlaybackSpeed={800}
        onToggleForecastPlay={onTogglePlay}
        onStepBackForecast={onStepBack}
        onStepForwardForecast={onStepForward}
        onSeekForecast={onSeek}
        onChangeForecastSpeed={onSpeed}
        timelineMode="forecast"
      />
    );

    // Verify T+12h step label and model badge
    expect(screen.getByText('T+12h')).toBeInTheDocument();
    expect(screen.getByText('ECMWF IFS (0.25°)')).toBeInTheDocument();
    expect(screen.getByText('00Z')).toBeInTheDocument();
    expect(screen.getByText(/13\/72/)).toBeInTheDocument();

    // Verify Play button
    const playBtn = screen.getByLabelText(/Play animation loop/i);
    fireEvent.click(playBtn);
    expect(onTogglePlay).toHaveBeenCalled();

    // Verify Step Back / Forward buttons
    const stepBackBtn = screen.getByLabelText(/Previous forecast hour/i);
    fireEvent.click(stepBackBtn);
    expect(onStepBack).toHaveBeenCalled();

    const stepForwardBtn = screen.getByLabelText(/Next forecast hour/i);
    fireEvent.click(stepForwardBtn);
    expect(onStepForward).toHaveBeenCalled();

    // Verify Scrubber
    const scrubber = screen.getByLabelText(/Forecast Timestep Scrubber/i);
    expect(scrubber).toHaveAttribute('max', '71');
    expect(scrubber).toHaveValue('12');
    fireEvent.change(scrubber, { target: { value: '24' } });
    expect(onSeek).toHaveBeenCalledWith(24);

    // Verify Speed buttons
    const speed2x = screen.getByText('2x');
    fireEvent.click(speed2x);
    expect(onSpeed).toHaveBeenCalledWith(400);
  });

  it('displays FAILOVER and STALE badges in forecast timeline when active', () => {
    const fallbackGrid: ForecastGridResponse = {
      ...mockForecastGrid,
      metadata: {
        ...mockForecastGrid.metadata,
        model: 'NOAA GFS (0.25°)',
        isFallback: true,
        isStale: true,
      },
    };

    render(
      <MapTimeline
        timeline={null}
        activeFrameIndex={0}
        isPlaying={false}
        playbackSpeed={800}
        onTogglePlay={vi.fn()}
        onStepBack={vi.fn()}
        onStepForward={vi.fn()}
        onSeek={vi.fn()}
        onChangeSpeed={vi.fn()}
        showRadar={false}
        showSatellite={false}
        hasActiveForecastLayer={true}
        forecastGrid={fallbackGrid}
        activeForecastTimestepIndex={0}
        timelineMode="forecast"
      />
    );

    expect(screen.getByText('FAILOVER')).toBeInTheDocument();
    expect(screen.getByText('STALE')).toBeInTheDocument();
    expect(screen.getByText('NOAA GFS (0.25°)')).toBeInTheDocument();
  });
});
