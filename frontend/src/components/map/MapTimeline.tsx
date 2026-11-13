import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Globe, Radio, CloudRain } from 'lucide-react';
import { RainViewerTimeline, RadarAnimationFrame } from '../../services/radar';
import { SatelliteTimeline, SatelliteAnimationFrame } from '../../services/satellite';
import type { ForecastGridResponse } from '../../services/forecast';
import { getForecastTimeInfo } from '../../services/forecast-timeline';

export interface MapTimelineProps {
  // Radar timeline (backward compatible)
  timeline: RainViewerTimeline | null;
  activeFrameIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onTogglePlay: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSeek: (index: number) => void;
  onChangeSpeed: (ms: number) => void;

  // Phase 2C Satellite Timeline & Multi-track additions
  satelliteTimeline?: SatelliteTimeline | null;
  activeSatelliteFrameIndex?: number;
  isSatellitePlaying?: boolean;
  satellitePlaybackSpeed?: number;
  activeDriver?: 'satellite' | 'radar';
  onChangeDriver?: (driver: 'satellite' | 'radar') => void;
  onToggleSatellitePlay?: () => void;
  onStepBackSatellite?: () => void;
  onStepForwardSatellite?: () => void;
  onSeekSatellite?: (index: number) => void;
  onChangeSatelliteSpeed?: (ms: number) => void;

  isHDMode?: boolean;
  hdProductName?: string;
  hdCompositeDate?: string;
  showRadar?: boolean;
  showSatellite?: boolean;

  // Phase 3C: Unified 72-Hour Forecast Timeline additions
  forecastGrid?: ForecastGridResponse | null;
  activeForecastTimestepIndex?: number;
  isForecastPlaying?: boolean;
  forecastPlaybackSpeed?: number;
  onToggleForecastPlay?: () => void;
  onStepBackForecast?: () => void;
  onStepForwardForecast?: () => void;
  onSeekForecast?: (index: number) => void;
  onChangeForecastSpeed?: (ms: number) => void;
  timelineMode?: 'live' | 'forecast';
  onChangeTimelineMode?: (mode: 'live' | 'forecast') => void;
  hasActiveForecastLayer?: boolean;

  className?: string;
}

export const MapTimeline: React.FC<MapTimelineProps> = ({
  timeline,
  activeFrameIndex,
  isPlaying,
  playbackSpeed,
  onTogglePlay,
  onStepBack,
  onStepForward,
  onSeek,
  onChangeSpeed,

  satelliteTimeline,
  activeSatelliteFrameIndex = 0,
  isSatellitePlaying = false,
  satellitePlaybackSpeed = 800,
  activeDriver = 'satellite',
  onChangeDriver,
  onToggleSatellitePlay,
  onStepBackSatellite,
  onStepForwardSatellite,
  onSeekSatellite,
  onChangeSatelliteSpeed,

  isHDMode = false,
  hdProductName = 'Daily True Color',
  hdCompositeDate = '',
  showRadar = true,
  showSatellite = false,

  forecastGrid,
  activeForecastTimestepIndex = 0,
  isForecastPlaying = false,
  forecastPlaybackSpeed = 800,
  onToggleForecastPlay,
  onStepBackForecast,
  onStepForwardForecast,
  onSeekForecast,
  onChangeForecastSpeed,
  timelineMode,
  onChangeTimelineMode,
  hasActiveForecastLayer = false,

  className = '',
}) => {
  // Determine effective mode: 'live' or 'forecast'
  const liveActive = showRadar || showSatellite;
  const forecastActive = Boolean(hasActiveForecastLayer || forecastGrid);

  let effectiveMode: 'live' | 'forecast' = 'live';
  if (forecastActive && !liveActive) {
    effectiveMode = 'forecast';
  } else if (liveActive && !forecastActive) {
    effectiveMode = 'live';
  } else if (forecastActive && liveActive) {
    effectiveMode = timelineMode || 'forecast';
  }

  // Determine effective driver within live mode ('satellite' or 'radar')
  const bothLiveActive = showRadar && showSatellite;
  let effectiveLiveDriver: 'satellite' | 'radar' = 'radar';
  if (showSatellite && !showRadar) {
    effectiveLiveDriver = 'satellite';
  } else if (showRadar && !showSatellite) {
    effectiveLiveDriver = 'radar';
  } else if (bothLiveActive) {
    effectiveLiveDriver = activeDriver;
  }

  const isSatTrack = effectiveMode === 'live' && effectiveLiveDriver === 'satellite';
  const isForecastTrack = effectiveMode === 'forecast';

  const radarFrames = timeline?.radarFrames || [];
  const satFrames = satelliteTimeline?.frames || [];
  const totalForecastSteps = forecastGrid?.nodes?.[0]?.hourly?.length || 72;

  const totalFrames = isForecastTrack
    ? totalForecastSteps
    : isSatTrack
    ? (isHDMode ? 1 : satFrames.length)
    : radarFrames.length;

  const currentFrameIdx = isForecastTrack
    ? activeForecastTimestepIndex
    : isSatTrack
    ? activeSatelliteFrameIndex
    : activeFrameIndex;

  const currentSatFrame: SatelliteAnimationFrame | null =
    isSatTrack && currentFrameIdx >= 0 && currentFrameIdx < satFrames.length
      ? satFrames[currentFrameIdx]
      : null;

  const currentRadarFrame: RadarAnimationFrame | null =
    !isSatTrack && !isForecastTrack && currentFrameIdx >= 0 && currentFrameIdx < radarFrames.length
      ? radarFrames[currentFrameIdx]
      : null;

  const forecastInfo = isForecastTrack
    ? getForecastTimeInfo(forecastGrid, currentFrameIdx)
    : null;

  const activePlaying = isForecastTrack
    ? isForecastPlaying
    : isSatTrack
    ? isSatellitePlaying
    : isPlaying;

  const activeSpeed = isForecastTrack
    ? forecastPlaybackSpeed
    : isSatTrack
    ? satellitePlaybackSpeed
    : playbackSpeed;

  const handleTogglePlay = () => {
    if (isForecastTrack) {
      if (onToggleForecastPlay) onToggleForecastPlay();
      else onTogglePlay();
    } else if (isSatTrack) {
      if (isHDMode) return;
      if (onToggleSatellitePlay) onToggleSatellitePlay();
      else onTogglePlay();
    } else {
      onTogglePlay();
    }
  };

  const handleStepBack = () => {
    if (isForecastTrack) {
      if (onStepBackForecast) onStepBackForecast();
      else onStepBack();
    } else if (isSatTrack) {
      if (isHDMode) return;
      if (onStepBackSatellite) onStepBackSatellite();
      else onStepBack();
    } else {
      onStepBack();
    }
  };

  const handleStepForward = () => {
    if (isForecastTrack) {
      if (onStepForwardForecast) onStepForwardForecast();
      else onStepForward();
    } else if (isSatTrack) {
      if (isHDMode) return;
      if (onStepForwardSatellite) onStepForwardSatellite();
      else onStepForward();
    } else {
      onStepForward();
    }
  };

  const handleSeek = (idx: number) => {
    if (isForecastTrack) {
      if (onSeekForecast) onSeekForecast(idx);
      else onSeek(idx);
    } else if (isSatTrack) {
      if (isHDMode) return;
      if (onSeekSatellite) onSeekSatellite(idx);
      else onSeek(idx);
    } else {
      onSeek(idx);
    }
  };

  const handleChangeSpeed = (ms: number) => {
    if (isForecastTrack) {
      if (onChangeForecastSpeed) onChangeForecastSpeed(ms);
      else onChangeSpeed(ms);
    } else if (isSatTrack) {
      if (onChangeSatelliteSpeed) onChangeSatelliteSpeed(ms);
      else onChangeSpeed(ms);
    } else {
      onChangeSpeed(ms);
    }
  };

  const isNowcast = currentRadarFrame?.relativeTime.startsWith('+') ?? false;

  return (
    <div
      className={`pointer-events-auto w-full max-w-4xl bg-navy-900/95 backdrop-blur-md border border-navy-700/80 rounded-xl px-3 py-1.5 shadow-2xl flex flex-row items-center justify-between gap-2 text-slate-200 font-mono text-xs select-none transition-all ${className}`}
      aria-label="Map Animation Timeline"
    >
      {/* 1. Category Switcher (LIVE OBS vs 72H FORECAST) */}
      {liveActive && forecastActive && (
        <div className="flex items-center bg-navy-950 p-0.5 rounded-lg border border-navy-800 flex-shrink-0">
          <button
            onClick={() => onChangeTimelineMode && onChangeTimelineMode('live')}
            aria-label="Switch to Live observations timeline"
            title="Focus timeline on Live observations (Radar / Satellite)"
            className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
              effectiveMode === 'live'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3 h-3 text-blue-300" />
            <span>LIVE OBS</span>
            {(isPlaying || isSatellitePlaying) && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-ping" />
            )}
          </button>
          <button
            onClick={() => onChangeTimelineMode && onChangeTimelineMode('forecast')}
            aria-label="Switch to NWP 72-Hour Forecast timeline"
            title="Focus timeline on 72-Hour NWP numerical forecasts"
            className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
              effectiveMode === 'forecast'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CloudRain className="w-3 h-3 text-emerald-300" />
            <span>72H FORECAST</span>
            {isForecastPlaying && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
            )}
          </button>
        </div>
      )}

      {/* 2. Sub-Track Driver Selector within Live Mode (Satellite vs Radar) */}
      {effectiveMode === 'live' && bothLiveActive && (
        <div className="flex items-center bg-navy-950 p-0.5 rounded-lg border border-navy-800 flex-shrink-0">
          <button
            onClick={() => onChangeDriver && onChangeDriver('satellite')}
            aria-label="Focus timeline on NASA GIBS Satellite"
            title="Focus timeline on NASA GIBS Satellite"
            className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
              effectiveLiveDriver === 'satellite'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3 h-3 text-cyan-300" />
            <span>SAT</span>
            {isSatellitePlaying && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping" />
            )}
          </button>
          <button
            onClick={() => onChangeDriver && onChangeDriver('radar')}
            aria-label="Focus timeline on RainViewer Radar"
            title="Focus timeline on RainViewer Radar"
            className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
              effectiveLiveDriver === 'radar'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3 h-3 text-blue-300" />
            <span>RADAR</span>
            {isPlaying && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-ping" />
            )}
          </button>
        </div>
      )}

      {/* 3. Playback Controls & Frame Badge */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Play / Pause Button */}
        <button
          onClick={handleTogglePlay}
          disabled={totalFrames <= 1 || (effectiveMode === 'live' && isHDMode)}
          className={`w-7 h-7 rounded-lg text-white flex items-center justify-center shadow-md transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
            isForecastTrack
              ? 'bg-emerald-600 hover:bg-emerald-500'
              : isSatTrack
              ? 'bg-cyan-600 hover:bg-cyan-500'
              : 'bg-blue-600 hover:bg-blue-500'
          }`}
          title={
            effectiveMode === 'live' && isHDMode
              ? 'Daily composite cannot be animated as 10-minute geostationary frames'
              : activePlaying
              ? 'Pause animation loop'
              : 'Play animation loop'
          }
          aria-label={activePlaying ? 'Pause animation loop' : 'Play animation loop'}
        >
          {activePlaying ? (
            <Pause className="w-3.5 h-3.5 fill-white" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
          )}
        </button>

        {/* Step Backwards */}
        <button
          onClick={handleStepBack}
          disabled={totalFrames <= 1 || (effectiveMode === 'live' && isHDMode)}
          className="p-1.5 rounded-md bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
          title={isForecastTrack ? 'Previous forecast hour (T-1h)' : 'Previous frame'}
          aria-label={isForecastTrack ? 'Previous forecast hour' : 'Previous frame'}
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        {/* Step Forward */}
        <button
          onClick={handleStepForward}
          disabled={totalFrames <= 1 || (effectiveMode === 'live' && isHDMode)}
          className="p-1.5 rounded-md bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
          title={isForecastTrack ? 'Next forecast hour (T+1h)' : 'Next frame'}
          aria-label={isForecastTrack ? 'Next forecast hour' : 'Next frame'}
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        {/* Current Timestamp & Latency Badge */}
        <div className="px-2 py-0.5 rounded-md bg-navy-950 border border-navy-800 flex items-center gap-1.5 text-[11px] max-w-[240px] sm:max-w-none truncate">
          {isForecastTrack && forecastInfo ? (
            <>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isForecastPlaying ? 'bg-emerald-400 animate-ping' : 'bg-emerald-400'
                }`}
              />
              <span className="font-bold text-amber-300 font-mono whitespace-nowrap">
                {forecastInfo.stepLabel}
              </span>
              <span className="font-bold text-white whitespace-nowrap">
                {forecastInfo.formattedUtc}
              </span>
              <span className="text-[10px] text-cyan-300 hidden md:inline">
                {forecastInfo.model}
              </span>
              <span className="text-[9px] px-1 py-0.2 bg-navy-800 text-slate-300 rounded border border-navy-700 hidden lg:inline">
                {forecastInfo.runCycle}
              </span>
              {forecastInfo.isFallback && (
                <span className="bg-amber-900/80 text-amber-300 px-1 rounded text-[8.5px] font-bold">
                  FAILOVER
                </span>
              )}
              {forecastInfo.isStale && (
                <span className="bg-rose-900/80 text-rose-300 px-1 rounded text-[8.5px] font-bold">
                  STALE
                </span>
              )}
            </>
          ) : isHDMode ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="font-bold text-emerald-300 truncate">
                {hdProductName}
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                {hdCompositeDate} (Daily Swath)
              </span>
            </>
          ) : isSatTrack ? (
            <>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  currentSatFrame?.isLatest
                    ? 'bg-cyan-400 animate-pulse'
                    : 'bg-slate-400'
                }`}
              />
              <span className="font-bold text-white whitespace-nowrap">
                {currentSatFrame ? currentSatFrame.utcLabel : 'Loading'}
              </span>
              <span className="text-[10px] text-slate-400 hidden md:inline">
                ({currentSatFrame?.label})
              </span>
              <span className="text-[10px] text-cyan-400 whitespace-nowrap">
                {currentSatFrame ? currentSatFrame.relativeTime : ''}
              </span>
              <span className="text-[9px] px-1 py-0.2 bg-navy-800 text-amber-300 rounded border border-amber-900/50 hidden lg:inline">
                ~40m latency
              </span>
            </>
          ) : (
            <>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isNowcast ? 'bg-amber-400 animate-ping' : 'bg-blue-500 animate-pulse'
                }`}
              />
              <span className="font-bold text-white whitespace-nowrap">
                {currentRadarFrame ? currentRadarFrame.label : 'Live Stream'}
              </span>
              <span className={`text-[10px] ${isNowcast ? 'text-amber-400' : 'text-blue-400'} whitespace-nowrap`}>
                {currentRadarFrame ? currentRadarFrame.relativeTime : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 4. Timeline Scrubber Track */}
      <div className="flex-1 flex items-center gap-2 min-w-[90px]">
        <input
          type="range"
          min="0"
          max={totalFrames > 0 ? totalFrames - 1 : 0}
          value={currentFrameIdx >= 0 ? currentFrameIdx : 0}
          onChange={(e) => handleSeek(Number(e.target.value))}
          disabled={totalFrames <= 1 || (effectiveMode === 'live' && isHDMode)}
          aria-label={isForecastTrack ? 'Forecast Timestep Scrubber' : 'Timeline Scrubber'}
          className={`w-full h-1 bg-navy-800 rounded cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
            isForecastTrack
              ? 'accent-emerald-500'
              : isSatTrack
              ? 'accent-cyan-500'
              : 'accent-blue-500'
          }`}
        />
        <span className="text-[9px] text-slate-400 whitespace-nowrap hidden sm:inline">
          {isForecastTrack
            ? `${forecastInfo?.stepLabel || 'T+00h'} (${currentFrameIdx + 1}/72)`
            : isHDMode
            ? 'Daily'
            : totalFrames > 0
            ? `${currentFrameIdx + 1}/${totalFrames}`
            : 'Live'}
        </span>
      </div>

      {/* 5. Playback Speed Selector (0.5x, 1x, 2x) */}
      <div className="flex items-center gap-1 text-[9px] border-l border-navy-800 pl-2 flex-shrink-0">
        <span className="text-slate-400 hidden sm:inline">SPD:</span>
        {[
          { label: '0.5x', ms: 1600 },
          { label: '1x', ms: 800 },
          { label: '2x', ms: 400 },
        ].map((spd) => (
          <button
            key={spd.label}
            onClick={() => handleChangeSpeed(spd.ms)}
            disabled={totalFrames <= 1 || (effectiveMode === 'live' && isHDMode)}
            className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
              activeSpeed === spd.ms
                ? isForecastTrack
                  ? 'bg-emerald-600 text-white font-bold'
                  : isSatTrack
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'bg-blue-600 text-white font-bold'
                : 'bg-navy-800 text-slate-400 hover:text-white'
            }`}
          >
            {spd.label}
          </button>
        ))}
      </div>
    </div>
  );
};
