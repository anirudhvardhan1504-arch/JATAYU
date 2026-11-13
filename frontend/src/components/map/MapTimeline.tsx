import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Globe, Radio } from 'lucide-react';
import { RainViewerTimeline, RadarAnimationFrame } from '../../services/radar';
import { SatelliteTimeline, SatelliteAnimationFrame } from '../../services/satellite';

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
  className = '',
}) => {
  // Determine effective driver
  const bothActive = showRadar && showSatellite;
  let effectiveDriver: 'satellite' | 'radar' = 'radar';
  if (showSatellite && !showRadar) {
    effectiveDriver = 'satellite';
  } else if (showRadar && !showSatellite) {
    effectiveDriver = 'radar';
  } else if (bothActive) {
    effectiveDriver = activeDriver;
  }

  // Active track properties
  const isSatTrack = effectiveDriver === 'satellite';
  const radarFrames = timeline?.radarFrames || [];
  const satFrames = satelliteTimeline?.frames || [];

  const totalFrames = isSatTrack ? (isHDMode ? 1 : satFrames.length) : radarFrames.length;
  const currentFrameIdx = isSatTrack ? activeSatelliteFrameIndex : activeFrameIndex;

  const currentSatFrame: SatelliteAnimationFrame | null =
    isSatTrack && currentFrameIdx >= 0 && currentFrameIdx < satFrames.length
      ? satFrames[currentFrameIdx]
      : null;

  const currentRadarFrame: RadarAnimationFrame | null =
    !isSatTrack && currentFrameIdx >= 0 && currentFrameIdx < radarFrames.length
      ? radarFrames[currentFrameIdx]
      : null;

  const activePlaying = isSatTrack ? isSatellitePlaying : isPlaying;
  const activeSpeed = isSatTrack ? satellitePlaybackSpeed : playbackSpeed;

  const handleTogglePlay = () => {
    if (isSatTrack) {
      if (isHDMode) return;
      if (onToggleSatellitePlay) onToggleSatellitePlay();
      else onTogglePlay();
    } else {
      onTogglePlay();
    }
  };

  const handleStepBack = () => {
    if (isSatTrack) {
      if (isHDMode) return;
      if (onStepBackSatellite) onStepBackSatellite();
      else onStepBack();
    } else {
      onStepBack();
    }
  };

  const handleStepForward = () => {
    if (isSatTrack) {
      if (isHDMode) return;
      if (onStepForwardSatellite) onStepForwardSatellite();
      else onStepForward();
    } else {
      onStepForward();
    }
  };

  const handleSeek = (idx: number) => {
    if (isSatTrack) {
      if (isHDMode) return;
      if (onSeekSatellite) onSeekSatellite(idx);
      else onSeek(idx);
    } else {
      onSeek(idx);
    }
  };

  const handleChangeSpeed = (ms: number) => {
    if (isSatTrack) {
      if (onChangeSatelliteSpeed) onChangeSatelliteSpeed(ms);
      else onChangeSpeed(ms);
    } else {
      onChangeSpeed(ms);
    }
  };

  const isNowcast = currentRadarFrame?.relativeTime.startsWith('+') ?? false;

  return (
    <div
      className={`pointer-events-auto w-full max-w-3xl bg-navy-900/95 backdrop-blur-md border border-navy-700/80 rounded-xl px-3 py-1.5 shadow-2xl flex flex-row items-center justify-between gap-2 text-slate-200 font-mono text-xs select-none transition-all ${className}`}
      aria-label="Map Animation Timeline"
    >
      {/* 1. Dual-Track Driver Selector (Rendered when both Satellite and Radar are active) */}
      {bothActive && (
        <div className="flex items-center bg-navy-950 p-0.5 rounded-lg border border-navy-800 flex-shrink-0">
          <button
            onClick={() => onChangeDriver && onChangeDriver('satellite')}
            aria-label="Focus timeline on NASA GIBS Satellite"
            title="Focus timeline on NASA GIBS Satellite"
            className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
              effectiveDriver === 'satellite'
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
              effectiveDriver === 'radar'
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

      {/* 2. Playback Controls & Frame Badge */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Play / Pause Button */}
        <button
          onClick={handleTogglePlay}
          disabled={totalFrames <= 1 || isHDMode}
          className={`w-7 h-7 rounded-lg text-white flex items-center justify-center shadow-md transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
            isSatTrack ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-blue-600 hover:bg-blue-500'
          }`}
          title={
            isHDMode
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
          disabled={totalFrames <= 1 || isHDMode}
          className="p-1.5 rounded-md bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
          title="Previous frame"
          aria-label="Previous frame"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        {/* Step Forward */}
        <button
          onClick={handleStepForward}
          disabled={totalFrames <= 1 || isHDMode}
          className="p-1.5 rounded-md bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
          title="Next frame"
          aria-label="Next frame"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        {/* Current Timestamp & Latency Badge */}
        <div className="px-2 py-0.5 rounded-md bg-navy-950 border border-navy-800 flex items-center gap-1.5 text-[11px] max-w-[210px] sm:max-w-none truncate">
          {isHDMode ? (
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

      {/* 3. Compact Timeline Scrubber Track */}
      <div className="flex-1 flex items-center gap-2 min-w-[90px]">
        <input
          type="range"
          min="0"
          max={totalFrames > 0 ? totalFrames - 1 : 0}
          value={currentFrameIdx >= 0 ? currentFrameIdx : 0}
          onChange={(e) => handleSeek(Number(e.target.value))}
          disabled={totalFrames <= 1 || isHDMode}
          aria-label="Timeline Scrubber"
          className={`w-full h-1 bg-navy-800 rounded cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
            isSatTrack ? 'accent-cyan-500' : 'accent-blue-500'
          }`}
        />
        <span className="text-[9px] text-slate-400 whitespace-nowrap hidden sm:inline">
          {isHDMode ? 'Daily' : totalFrames > 0 ? `${currentFrameIdx + 1}/${totalFrames}` : 'Live'}
        </span>
      </div>

      {/* 4. Speed Selector (0.5x, 1x, 2x) */}
      <div className="flex items-center gap-1 text-[9px] border-l border-navy-800 pl-2 flex-shrink-0">
        <span className="text-slate-400 hidden sm:inline">SPD:</span>
        {[
          { label: '0.5x', ms: 1200 },
          { label: '1x', ms: 800 },
          { label: '2x', ms: 400 },
        ].map((spd) => (
          <button
            key={spd.label}
            onClick={() => handleChangeSpeed(spd.ms)}
            disabled={totalFrames <= 1 || isHDMode}
            className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
              activeSpeed === spd.ms
                ? isSatTrack
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
