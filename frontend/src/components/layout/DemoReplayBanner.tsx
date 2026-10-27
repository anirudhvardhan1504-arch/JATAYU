import React from 'react';
import { AlertTriangle, RotateCcw, Play } from 'lucide-react';

export interface DemoReplayBannerProps {
  isReplayMode: boolean;
  scenarioId: string;
  onScenarioChange: (scenarioId: string) => void;
  onToggleReplay: (enabled: boolean) => void;
}

export const DemoReplayBanner: React.FC<DemoReplayBannerProps> = ({
  isReplayMode,
  scenarioId,
  onScenarioChange,
  onToggleReplay,
}) => {
  if (!isReplayMode) {
    return (
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium text-slate-300">Live Operational Telemetry Active</span>
        </div>
        <button
          onClick={() => onToggleReplay(true)}
          className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800/80 px-2.5 py-0.5 rounded transition-colors text-[11px]"
          title="Switch to recorded historical disaster telemetry for offline evaluation"
        >
          <Play className="w-3 h-3" />
          <span>Launch Recorded Demo Replay</span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Demo Replay Notification"
      className="bg-amber-500 text-slate-950 px-4 py-2 flex flex-wrap items-center justify-between shadow-md text-xs sm:text-sm font-medium z-50 border-b border-amber-600"
    >
      <div className="flex items-center gap-2.5 my-0.5">
        <span className="flex items-center gap-1 px-2 py-0.5 bg-black text-amber-400 font-bold rounded uppercase tracking-wider text-[10px]">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          DEMO REPLAY
        </span>
        <span className="font-semibold tracking-tight text-slate-950">
          RECORDED HISTORICAL DISASTER DATA — NOT LIVE CONDITIONS
        </span>
      </div>

      <div className="flex items-center gap-3 my-0.5">
        <div className="flex items-center gap-1.5">
          <label htmlFor="replay-scenario-select" className="text-xs font-semibold text-slate-900">
            Scenario:
          </label>
          <select
            id="replay-scenario-select"
            value={scenarioId}
            onChange={(e) => onScenarioChange(e.target.value)}
            className="bg-slate-950 text-white font-medium rounded px-2.5 py-1 text-xs border border-amber-700 focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="chennai_deluge_2023">Chennai Deluge (Cyclone Michaung Dec 2023)</option>
            <option value="hyderabad_musi_2020">Hyderabad Musi Cloudburst (Oct 2020)</option>
            <option value="mumbai_monsoon_2023">Mumbai Monsoon Surge (July 2023)</option>
          </select>
        </div>

        <button
          onClick={() => onToggleReplay(false)}
          className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded text-xs transition-colors"
        >
          <RotateCcw className="w-3 h-3 text-amber-400" />
          <span>Return to Live Data</span>
        </button>
      </div>
    </div>
  );
};
