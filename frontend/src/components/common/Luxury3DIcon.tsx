import React from 'react';

export type Luxury3DIconType =
  | 'weather-sun-cloud'
  | 'weather-storm'
  | 'radar-globe'
  | 'shield-emerald'
  | 'warning-beacon'
  | 'ai-neural'
  | 'supply-kit'
  | 'route-compass'
  | 'facility-hospital';

interface Luxury3DIconProps {
  type: Luxury3DIconType;
  size?: number | string;
  className?: string;
}

export const Luxury3DIcon: React.FC<Luxury3DIconProps> = ({
  type,
  size = 48,
  className = '',
}) => {
  const dimension = typeof size === 'number' ? `${size}px` : size;

  switch (type) {
    case 'weather-sun-cloud':
      return (
        <div
          style={{ width: dimension, height: dimension }}
          className={`relative inline-flex items-center justify-center filter drop-shadow-[0_8px_16px_rgba(0,217,154,0.25)] ${className}`}
        >
          <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
            <defs>
              {/* Sun Gradient */}
              <radialGradient id="sunGrad" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#FFF7D6" />
                <stop offset="40%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#F59E0B" />
              </radialGradient>
              {/* Sun Glow */}
              <filter id="sunGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              {/* Cloud Volumetric Gradient */}
              <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="45%" stopColor="#E2E8F0" />
                <stop offset="85%" stopColor="#94A3B8" />
                <stop offset="100%" stopColor="#64748B" />
              </linearGradient>
              {/* Cloud Specular Rim */}
              <linearGradient id="cloudRim" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#42F5B0" stopOpacity="0.4" />
              </linearGradient>
            </defs>

            {/* Glowing Sun in the background */}
            <circle cx="54" cy="28" r="18" fill="url(#sunGrad)" filter="url(#sunGlow)" />
            {/* Sun Rays subtle glow */}
            <circle cx="54" cy="28" r="22" stroke="#FBBF24" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.6" />

            {/* 3D Volumetric Soft Cloud in Foreground */}
            <g filter="drop-shadow(0 6px 12px rgba(8,13,13,0.6))">
              <path
                d="M26 62h32a14 14 0 0 0 2-27.8 19 19 0 0 0-36-3A13.5 13.5 0 0 0 26 62z"
                fill="url(#cloudGrad)"
              />
              {/* Top Highlight Rim */}
              <path
                d="M26 62h32a14 14 0 0 0 2-27.8 19 19 0 0 0-36-3A13.5 13.5 0 0 0 26 62z"
                stroke="url(#cloudRim)"
                strokeWidth="1.5"
                fill="none"
              />
            </g>
          </svg>
        </div>
      );

    case 'weather-storm':
      return (
        <div
          style={{ width: dimension, height: dimension }}
          className={`relative inline-flex items-center justify-center filter drop-shadow-[0_8px_20px_rgba(66,245,176,0.3)] ${className}`}
        >
          <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
            <defs>
              <linearGradient id="stormCloud" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#64748B" />
                <stop offset="60%" stopColor="#334155" />
                <stop offset="100%" stopColor="#1E293B" />
              </linearGradient>
              <linearGradient id="lightning" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFF7D6" />
                <stop offset="50%" stopColor="#42F5B0" />
                <stop offset="100%" stopColor="#00D99A" />
              </linearGradient>
            </defs>
            <path
              d="M24 46h32a14 14 0 0 0 2-27.8 19 19 0 0 0-36-3A13.5 13.5 0 0 0 24 46z"
              fill="url(#stormCloud)"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.5"
            />
            {/* 3D Lightning Bolt */}
            <path
              d="M40 38l-6 16h8l-4 14 16-20h-9l5-10h-10z"
              fill="url(#lightning)"
              filter="drop-shadow(0 0 8px #42F5B0)"
            />
          </svg>
        </div>
      );

    case 'radar-globe':
      return (
        <div
          style={{ width: dimension, height: dimension }}
          className={`relative inline-flex items-center justify-center filter drop-shadow-[0_8px_24px_rgba(0,217,154,0.35)] ${className}`}
        >
          <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
            <defs>
              <radialGradient id="globeGrad" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#163A30" />
                <stop offset="55%" stopColor="#0E231D" />
                <stop offset="100%" stopColor="#080D0D" />
              </radialGradient>
              <linearGradient id="orbitalRing" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#42F5B0" />
                <stop offset="50%" stopColor="#00D99A" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#10251F" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            {/* Deep Obsidian-Emerald Spherical Body */}
            <circle cx="40" cy="40" r="28" fill="url(#globeGrad)" stroke="rgba(0,217,154,0.4)" strokeWidth="1.5" />
            {/* Grid Lat/Long Lines */}
            <ellipse cx="40" cy="40" rx="28" ry="11" stroke="rgba(66,245,176,0.3)" strokeWidth="1" />
            <ellipse cx="40" cy="40" rx="13" ry="28" stroke="rgba(66,245,176,0.25)" strokeWidth="1" />
            <line x1="40" y1="12" x2="40" y2="68" stroke="rgba(66,245,176,0.3)" strokeWidth="1" />
            <line x1="12" y1="40" x2="68" y2="40" stroke="rgba(66,245,176,0.3)" strokeWidth="1" />
            {/* Sweeping Radar Beam */}
            <path d="M40 40 L60 20 A28 28 0 0 0 40 12 Z" fill="rgba(66,245,176,0.2)" />
            {/* Outer Orbital Ring */}
            <ellipse cx="40" cy="40" rx="36" ry="14" stroke="url(#orbitalRing)" strokeWidth="2" transform="rotate(-25 40 40)" />
            {/* Target Beacon */}
            <circle cx="48" cy="30" r="3" fill="#42F5B0" filter="drop-shadow(0 0 6px #42F5B0)" />
          </svg>
        </div>
      );

    case 'shield-emerald':
      return (
        <div
          style={{ width: dimension, height: dimension }}
          className={`relative inline-flex items-center justify-center filter drop-shadow-[0_8px_20px_rgba(0,217,154,0.3)] ${className}`}
        >
          <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
            <defs>
              <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1E4D3E" />
                <stop offset="45%" stopColor="#10251F" />
                <stop offset="100%" stopColor="#080D0D" />
              </linearGradient>
              <linearGradient id="shieldBevel" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#75EFC0" />
                <stop offset="60%" stopColor="#00D99A" />
                <stop offset="100%" stopColor="#00704F" />
              </linearGradient>
            </defs>
            {/* Beveled Outer Shield */}
            <path
              d="M40 12L62 20v22c0 14.5-9.5 28-22 32-12.5-4-22-17.5-22-32V20l22-8z"
              fill="url(#shieldGrad)"
              stroke="url(#shieldBevel)"
              strokeWidth="2.5"
            />
            {/* Inner Emerald Glow Checkmark */}
            <path
              d="M31 39l7 7 14-14"
              stroke="#42F5B0"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="drop-shadow(0 0 8px #42F5B0)"
            />
          </svg>
        </div>
      );

    case 'warning-beacon':
      return (
        <div
          style={{ width: dimension, height: dimension }}
          className={`relative inline-flex items-center justify-center filter drop-shadow-[0_8px_20px_rgba(245,158,11,0.3)] ${className}`}
        >
          <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
            <defs>
              <linearGradient id="warnGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>
            <path
              d="M40 14L68 62H12L40 14z"
              fill="rgba(245,158,11,0.15)"
              stroke="url(#warnGrad)"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path d="M40 30v16" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" />
            <circle cx="40" cy="54" r="2.5" fill="#FBBF24" />
          </svg>
        </div>
      );

    case 'ai-neural':
      return (
        <div
          style={{ width: dimension, height: dimension }}
          className={`relative inline-flex items-center justify-center filter drop-shadow-[0_8px_20px_rgba(66,245,176,0.35)] ${className}`}
        >
          <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
            <defs>
              <linearGradient id="neuralGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#42F5B0" />
                <stop offset="100%" stopColor="#00D99A" />
              </linearGradient>
            </defs>
            {/* Center Node */}
            <circle cx="40" cy="40" r="10" fill="#10251F" stroke="#42F5B0" strokeWidth="2.5" filter="drop-shadow(0 0 8px #42F5B0)" />
            {/* Synaptic Network Branches */}
            <circle cx="20" cy="24" r="5" fill="#00D99A" />
            <circle cx="60" cy="24" r="5" fill="#00D99A" />
            <circle cx="20" cy="56" r="5" fill="#00D99A" />
            <circle cx="60" cy="56" r="5" fill="#00D99A" />
            <line x1="40" y1="40" x2="20" y2="24" stroke="rgba(66,245,176,0.5)" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="40" y1="40" x2="60" y2="24" stroke="rgba(66,245,176,0.5)" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="40" y1="40" x2="20" y2="56" stroke="rgba(66,245,176,0.5)" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="40" y1="40" x2="60" y2="56" stroke="rgba(66,245,176,0.5)" strokeWidth="2" strokeDasharray="3 3" />
          </svg>
        </div>
      );

    case 'supply-kit':
      return (
        <div
          style={{ width: dimension, height: dimension }}
          className={`relative inline-flex items-center justify-center filter drop-shadow-[0_8px_20px_rgba(0,217,154,0.25)] ${className}`}
        >
          <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
            <rect x="16" y="28" width="48" height="36" rx="6" fill="#10251F" stroke="#00D99A" strokeWidth="2" />
            <path d="M28 28V20a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v8" stroke="#42F5B0" strokeWidth="2.5" strokeLinecap="round" />
            <rect x="36" y="40" width="8" height="12" rx="1" fill="#42F5B0" />
            <rect x="34" y="42" width="12" height="8" rx="1" fill="#42F5B0" />
          </svg>
        </div>
      );

    case 'route-compass':
      return (
        <div
          style={{ width: dimension, height: dimension }}
          className={`relative inline-flex items-center justify-center filter drop-shadow-[0_8px_20px_rgba(0,217,154,0.3)] ${className}`}
        >
          <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
            <circle cx="40" cy="40" r="28" fill="#10251F" stroke="#00D99A" strokeWidth="2" />
            <circle cx="40" cy="40" r="24" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="2 3" />
            <polygon points="40,18 46,38 40,34 34,38" fill="#42F5B0" filter="drop-shadow(0 0 4px #42F5B0)" />
            <polygon points="40,62 46,42 40,46 34,42" fill="#64748B" />
            <circle cx="40" cy="40" r="3" fill="#FFFFFF" />
          </svg>
        </div>
      );

    case 'facility-hospital':
      return (
        <div
          style={{ width: dimension, height: dimension }}
          className={`relative inline-flex items-center justify-center filter drop-shadow-[0_8px_20px_rgba(0,217,154,0.3)] ${className}`}
        >
          <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
            <rect x="18" y="22" width="44" height="42" rx="4" fill="#10251F" stroke="#00D99A" strokeWidth="2" />
            <path d="M40 30v18M31 39h18" stroke="#42F5B0" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="26" y1="56" x2="34" y2="56" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
            <line x1="46" y1="56" x2="54" y2="56" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          </svg>
        </div>
      );

    default:
      return null;
  }
};

/**
 * Semi-Circular Arc Gauge Component inspired by Reference Images 2 & 4
 */
interface ArcGaugeProps {
  value: number; // 0 to 100
  label: string;
  sublabel?: string;
  statusText?: string;
  statusVariant?: 'low' | 'moderate' | 'high' | 'critical';
  size?: number;
  className?: string;
}

export const ArcGauge: React.FC<ArcGaugeProps> = ({
  value,
  label,
  sublabel,
  statusText,
  statusVariant = 'low',
  size = 140,
  className = '',
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));
  // Semi-circle arc: radius = 50, stroke width = 8, start angle = 180deg (left), end = 360deg (right)
  const radius = 45;
  const strokeWidth = 8;
  const circumference = Math.PI * radius; // length of half-circle
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  const colorMap = {
    low: {
      stroke: 'url(#gaugeLowGrad)',
      text: 'text-emerald-400',
      badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-800',
    },
    moderate: {
      stroke: 'url(#gaugeModGrad)',
      text: 'text-amber-400',
      badge: 'bg-amber-950/60 text-amber-300 border-amber-800',
    },
    high: {
      stroke: 'url(#gaugeHighGrad)',
      text: 'text-orange-400',
      badge: 'bg-orange-950/60 text-orange-300 border-orange-800',
    },
    critical: {
      stroke: 'url(#gaugeCritGrad)',
      text: 'text-red-400',
      badge: 'bg-red-950/60 text-red-300 border-red-800',
    },
  }[statusVariant];

  return (
    <div
      style={{ width: size, height: size * 0.75 }}
      className={`relative flex flex-col items-center justify-end select-none ${className}`}
    >
      <svg
        viewBox="0 0 120 70"
        className="w-full h-full overflow-visible"
        fill="none"
      >
        <defs>
          <linearGradient id="gaugeLowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10251F" />
            <stop offset="50%" stopColor="#00D99A" />
            <stop offset="100%" stopColor="#42F5B0" />
          </linearGradient>
          <linearGradient id="gaugeModGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00D99A" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#FBBF24" />
          </linearGradient>
          <linearGradient id="gaugeHighGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
          <linearGradient id="gaugeCritGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
        </defs>

        {/* Background Track Arc */}
        <path
          d="M 15 65 A 45 45 0 0 1 105 65"
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Foreground Progress Arc */}
        <path
          d="M 15 65 A 45 45 0 0 1 105 65"
          fill="none"
          stroke={colorMap.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>

      {/* Numerical read-out inside arc */}
      <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
        <span className={`text-xl font-bold font-mono tracking-tight ${colorMap.text}`}>
          {clampedValue}%
        </span>
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
          {label}
        </span>
        {sublabel && (
          <span className="text-[9px] text-slate-500 font-mono">
            {sublabel}
          </span>
        )}
        {statusText && (
          <span className={`mt-0.5 text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border ${colorMap.badge}`}>
            {statusText}
          </span>
        )}
      </div>
    </div>
  );
};
