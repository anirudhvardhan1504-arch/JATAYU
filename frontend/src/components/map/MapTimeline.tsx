import React from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { RainViewerTimeline, RadarAnimationFrame } from '../../services/radar';

export interface MapTimelineProps {
  timeline: RainViewerTimeline | null;
  activeFrameIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onTogglePlay: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSeek: (index: number) => void;
  onChangeSpeed: (ms: number) => void;
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
  className = '',
}) => {
  const radarFrames = timeline?.radarFrames || [];
  const activeFrame: RadarAnimationFrame | null =
    activeFrameIndex >= 0 && activeFrameIndex < radarFrames.length ? radarFrames[activeFrameIndex] : null;

  const totalFrames = radarFrames.length;
  const isNowcast = activeFrame?.relativeTime.startsWith('+') ?? false;

  return (
    <div
      className={`pointer-events-auto w-full max-w-2xl bg-navy-900/95 backdrop-blur-md border border-navy-700/80 rounded-xl px-3 py-1.5 shadow-2xl flex flex-row items-center justify-between gap-2.5 text-slate-200 font-mono text-xs select-none transition-all ${className}`}
      aria-label="Map Animation Timeline"
    >
      {/* 1. Playback Controls & Frame Badge */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Play / Pause Button */}
        <button
          onClick={onTogglePlay}
          disabled={totalFrames === 0}
          className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md transition-colors cursor-pointer disabled:opacity-40"
          title={isPlaying ? 'Pause timeline loop' : 'Play timeline loop'}
          aria-label={isPlaying ? 'Pause timeline loop' : 'Play timeline loop'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
        </button>

        {/* Step Backwards */}
        <button
          onClick={onStepBack}
          disabled={totalFrames === 0}
          className="p-1.5 rounded-md bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
          title="Previous frame"
          aria-label="Previous frame"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        {/* Step Forward */}
        <button
          onClick={onStepForward}
          disabled={totalFrames === 0}
          className="p-1.5 rounded-md bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
          title="Next frame"
          aria-label="Next frame"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        {/* Current Timestamp Badge */}
        <div className="px-2 py-0.5 rounded-md bg-navy-950 border border-navy-800 flex items-center gap-1.5 text-[11px]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isNowcast ? 'bg-amber-400 animate-ping' : 'bg-blue-500 animate-pulse'
            }`}
          />
          <span className="font-bold text-white">
            {activeFrame ? activeFrame.label : 'Live Stream'}
          </span>
          <span className={`text-[10px] ${isNowcast ? 'text-amber-400' : 'text-blue-400'}`}>
            {activeFrame ? activeFrame.relativeTime : ''}
          </span>
        </div>
      </div>

      {/* 2. Compact Timeline Scrubber Track */}
      <div className="flex-1 flex items-center gap-2 min-w-[120px]">
        <input
          type="range"
          min="0"
          max={totalFrames > 0 ? totalFrames - 1 : 0}
          value={activeFrameIndex >= 0 ? activeFrameIndex : 0}
          onChange={(e) => onSeek(Number(e.target.value))}
          disabled={totalFrames === 0}
          aria-label="Timeline Scrubber"
          className="w-full accent-blue-500 h-1 bg-navy-800 rounded cursor-pointer disabled:opacity-40"
        />
        <span className="text-[9px] text-slate-400 whitespace-nowrap hidden sm:inline">
          {totalFrames > 0 ? `${activeFrameIndex + 1}/${totalFrames}` : 'Live'}
        </span>
      </div>

      {/* 3. Speed Selector */}
      <div className="flex items-center gap-1 text-[9px] border-l border-navy-800 pl-2 flex-shrink-0">
        <span className="text-slate-400 hidden sm:inline">SPD:</span>
        {[
          { label: '1x', ms: 800 },
          { label: '2x', ms: 400 },
        ].map((spd) => (
          <button
            key={spd.label}
            onClick={() => onChangeSpeed(spd.ms)}
            className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
              playbackSpeed === spd.ms
                ? 'bg-blue-600 text-white font-bold'
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
