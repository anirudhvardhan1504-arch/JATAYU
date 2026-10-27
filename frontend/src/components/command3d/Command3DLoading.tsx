import React from 'react';
import { Globe, Loader2 } from 'lucide-react';

export const Command3DLoading: React.FC = () => {
  return (
    <div className="h-[750px] w-full rounded-lg bg-navy-950 border border-navy-800 flex flex-col items-center justify-center p-8 text-slate-300 animate-fadeIn">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full bg-navy-900 border border-navy-700 flex items-center justify-center text-amber-400">
          <Globe className="w-8 h-8 animate-pulse" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
      </div>

      <h3 className="text-sm font-mono font-bold tracking-wider text-white uppercase mb-2">
        Loading 3D Command Module
      </h3>
      <p className="text-xs text-slate-400 font-sans max-w-sm text-center mb-4">
        Asynchronously mounting Cesium 3D geospatial engine and ESRI World Imagery terrain assets...
      </p>

      <div className="flex items-center gap-2 text-[11px] font-mono text-amber-400/90 bg-navy-900 px-3 py-1.5 rounded border border-navy-800">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>INITIALIZING WEBGL2 SHADER PIPELINE</span>
      </div>
    </div>
  );
};
