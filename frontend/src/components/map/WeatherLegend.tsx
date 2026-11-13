import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';

export interface WeatherLegendProps {
  showRadar?: boolean;
  showSatellite?: boolean;
  satelliteProductKey?: 'ir' | 'visible' | 'airmass' | 'viirs' | 'modis';
  showSimulation?: boolean;
  activeForecastLayer?: 'precipitation' | 'wind' | 'temperature' | 'humidity' | 'pressure' | null;
  // Phase 3D-2B: District Forecast Impact Layer
  showDistrictImpact?: boolean;
  isNationalMode?: boolean;
  className?: string;
}

export const WeatherLegend: React.FC<WeatherLegendProps> = ({
  showRadar = true,
  showSatellite = false,
  satelliteProductKey = 'ir',
  showSimulation = false,
  activeForecastLayer = null,
  showDistrictImpact = false,
  isNationalMode = false,
  className = '',
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // If nothing with a legend is enabled, don't display
  if (!showRadar && !showSatellite && !showSimulation && !activeForecastLayer && !showDistrictImpact) {
    return null;
  }

  return (
    <div
      className={`bg-navy-900/95 backdrop-blur-md border border-navy-700/80 rounded-xl p-2 shadow-2xl text-slate-300 font-mono text-[9px] pointer-events-auto transition-all select-none w-52 ${className}`}
      aria-label="Map Visual Legends"
    >
      <div className="flex items-center justify-between pb-1 mb-1 border-b border-navy-800 text-slate-400 font-semibold gap-1.5">
        <div className="flex items-center gap-1">
          <Layers className="w-3 h-3 text-amber-400" />
          <span className="uppercase tracking-wider">MAP LEGENDS</span>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-0.5 hover:bg-navy-800 rounded text-slate-400 hover:text-white cursor-pointer"
          title={isCollapsed ? 'Expand legend' : 'Collapse legend'}
          aria-label={isCollapsed ? 'Expand legend' : 'Collapse legend'}
        >
          {isCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="space-y-2 pt-0.5">
          {/* 1. Radar Reflectivity Legend */}
          {showRadar && (
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-0.5 text-[8.5px]">
                <span className="font-semibold">RADAR REFLECTIVITY (dBZ)</span>
                <span className="text-sky-400">RainViewer</span>
              </div>
              <div className="w-full h-2 rounded bg-gradient-to-r from-[#4A90E2] via-[#50E3C2] via-[#F8E71C] via-[#F5A623] to-[#D0021B]" />
              <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
                <span>10 (Light)</span>
                <span>35 (Mod)</span>
                <span>50 (Hvy)</span>
                <span>65+</span>
              </div>
            </div>
          )}

          {/* 1b. Satellite Imagery Legend */}
          {showSatellite && (
            <div className="pt-1.5 border-t border-navy-800">
              <div className="flex items-center justify-between text-slate-400 mb-0.5 text-[8.5px]">
                <span className="font-semibold text-cyan-400">
                  {satelliteProductKey === 'ir'
                    ? 'SATELLITE CLEAN IR (Band 13)'
                    : satelliteProductKey === 'airmass'
                    ? 'AIR MASS RGB COMPOSITE'
                    : 'OPTICAL TRUE COLOR'}
                </span>
                <span className="text-slate-500">GIBS</span>
              </div>
              {satelliteProductKey === 'ir' ? (
                <>
                  <div className="w-full h-2 rounded bg-gradient-to-r from-[#1E293B] via-[#475569] via-[#0284C7] via-[#DC2626] to-[#FFFFFF]" />
                  <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
                    <span>+30°C</span>
                    <span>0°C</span>
                    <span>-40°C</span>
                    <span>-80°C (Tops)</span>
                  </div>
                </>
              ) : satelliteProductKey === 'airmass' ? (
                <div className="text-[8px] text-slate-400 leading-tight">
                  <span className="text-emerald-400">■ Warm air</span> &bull; <span className="text-sky-400">■ Cold polar</span> &bull; <span className="text-amber-400">■ Dry intrusion</span>
                </div>
              ) : (
                <div className="text-[8px] text-slate-400 leading-tight">
                  Corrected solar reflectance (optical natural color)
                </div>
              )}
            </div>
          )}

          {/* 2. SFINCS Hydraulic Depth Legend */}
          {showSimulation && (
            <div className="pt-1.5 border-t border-navy-800">
              <div className="flex items-center justify-between text-slate-400 mb-1 text-[8.5px]">
                <span className="font-semibold text-amber-400">SFINCS FLOOD DEPTH</span>
                <span className="text-amber-500 font-bold">Adyar S2</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[8px]">
                <div className="flex items-center gap-1 bg-navy-950/80 px-1 py-0.5 rounded border border-navy-800">
                  <span className="w-1.5 h-1.5 rounded bg-[#FEF08A] flex-shrink-0" />
                  <span className="truncate">&lt; 0.5m</span>
                </div>
                <div className="flex items-center gap-1 bg-navy-950/80 px-1 py-0.5 rounded border border-navy-800">
                  <span className="w-1.5 h-1.5 rounded bg-[#FB923C] flex-shrink-0" />
                  <span className="truncate">0.5-1.5m</span>
                </div>
                <div className="flex items-center gap-1 bg-navy-950/80 px-1 py-0.5 rounded border border-navy-800">
                  <span className="w-1.5 h-1.5 rounded bg-[#DC2626] flex-shrink-0" />
                  <span className="truncate">&gt; 1.5m</span>
                </div>
              </div>
            </div>
          )}

          {/* 3. Forecast Precipitation Legend */}
          {activeForecastLayer === 'precipitation' && (
            <div className="pt-1.5 border-t border-navy-800">
              <div className="flex items-center justify-between text-slate-400 mb-0.5 text-[8.5px]">
                <span className="font-semibold text-sky-400">PRECIP RATE (mm/h)</span>
                <span className="text-slate-500">ECMWF</span>
              </div>
              <div className="w-full h-2 rounded bg-gradient-to-r from-[#E0F2FE] via-[#38BDF8] via-[#2563EB] to-[#7C3AED]" />
              <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
                <span>0 mm</span>
                <span>5 mm</span>
                <span>15 mm</span>
                <span>30+ mm</span>
              </div>
            </div>
          )}

          {/* 4. Forecast Wind Legend */}
          {activeForecastLayer === 'wind' && (
            <div className="pt-1.5 border-t border-navy-800">
              <div className="flex items-center justify-between text-slate-400 mb-0.5 text-[8.5px]">
                <span className="font-semibold text-teal-400">WIND SPEED (km/h)</span>
                <span className="text-slate-500">10m AGL</span>
              </div>
              <div className="w-full h-2 rounded bg-gradient-to-r from-[#99F6E4] via-[#14B8A6] via-[#0D9488] to-[#115E59]" />
              <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
                <span>0 km/h</span>
                <span>25 km/h</span>
                <span>50 km/h</span>
                <span>80+</span>
              </div>
            </div>
          )}

          {/* 5. Forecast Temperature Legend */}
          {activeForecastLayer === 'temperature' && (
            <div className="pt-1.5 border-t border-navy-800">
              <div className="flex items-center justify-between text-slate-400 mb-0.5 text-[8.5px]">
                <span className="font-semibold text-amber-300">TEMPERATURE (°C)</span>
                <span className="text-slate-500">2m</span>
              </div>
              <div className="w-full h-2 rounded bg-gradient-to-r from-[#3B82F6] via-[#10B981] via-[#FBBF24] to-[#EF4444]" />
              <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
                <span>10°C</span>
                <span>20°C</span>
                <span>30°C</span>
                <span>40°C+</span>
              </div>
            </div>
          )}

          {/* 6. Forecast Pressure Legend */}
          {activeForecastLayer === 'pressure' && (
            <div className="pt-1.5 border-t border-navy-800">
              <div className="flex items-center justify-between text-slate-400 mb-0.5 text-[8.5px]">
                <span className="font-semibold text-purple-300">PRESSURE (hPa)</span>
                <span className="text-slate-500">MSLP</span>
              </div>
              <div className="w-full h-2 rounded bg-gradient-to-r from-[#C084FC] via-[#A855F7] to-[#6B21A8]" />
              <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
                <span>990</span>
                <span>1005</span>
                <span>1015</span>
                <span>1025</span>
              </div>
            </div>
          )}

          {/* 7. District Forecast Impact Legend (Phase 3D-2B) */}
          {showDistrictImpact && (
            <div className="pt-1.5 border-t border-navy-800 space-y-1">
              <div className="p-1 bg-amber-950/40 border border-amber-600/40 rounded text-center">
                <span className="font-bold text-amber-300 text-[8px] block tracking-wider">
                  FORECAST RAINFALL — NOT FLOOD INUNDATION
                </span>
                <span className="text-[7.5px] text-slate-400">
                  {isNationalMode
                    ? 'INDICATIVE NATIONAL SYNOPTIC (1.5° Mesh)'
                    : 'MESOSCALE SECTOR SAMPLING (0.25° Mesh)'}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-400 mb-0.5 text-[8.5px]">
                <span className="font-semibold text-emerald-400">24H RAINFALL HAZARD (IMD)</span>
                <span className="text-slate-500">T+1..24</span>
              </div>

              <div className="space-y-0.5 text-[8px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-[#C026D3]" />
                    <span>Extremely Heavy</span>
                  </span>
                  <span className="font-mono text-slate-400">&ge; 204.5 mm</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-[#DC2626]" />
                    <span>Very Heavy</span>
                  </span>
                  <span className="font-mono text-slate-400">115.5–204.4 mm</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-[#EA580C]" />
                    <span>Heavy</span>
                  </span>
                  <span className="font-mono text-slate-400">64.5–115.4 mm</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-[#D97706]" />
                    <span>Moderate</span>
                  </span>
                  <span className="font-mono text-slate-400">15.0–64.4 mm</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-[#0284C7]" />
                    <span>Light</span>
                  </span>
                  <span className="font-mono text-slate-400">0.1–14.9 mm</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-[#334155]" />
                    <span>No Rain</span>
                  </span>
                  <span className="font-mono text-slate-400">0.0 mm (Nil)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-[#1E293B] border border-slate-600" />
                    <span>Insufficient Coverage</span>
                  </span>
                  <span className="font-mono text-slate-500">No Data</span>
                </div>
              </div>

              <div className="pt-0.5 text-[7.5px] text-slate-500 leading-tight">
                * Single-node districts: localized point sampling.<br />
                Historical choke points: static Chennai markers only.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
