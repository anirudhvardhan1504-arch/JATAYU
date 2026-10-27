import React from 'react';
import { ShieldAlert, ArrowLeft, Lock, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AccessDeniedViewProps {
  onReturnToMap: () => void;
  onOpenLogin: () => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  onReturnToMap,
  onOpenLogin,
}) => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="h-[700px] w-full rounded-lg bg-navy-950 border border-navy-800 flex flex-col items-center justify-center p-8 text-slate-300">
      <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-700/60 flex items-center justify-center text-red-400 mb-6">
        <Lock className="w-8 h-8" />
      </div>

      <h3 className="text-base font-mono font-bold tracking-wider text-white uppercase mb-2">
        Tactical 3D Access Restricted
      </h3>

      <div className="max-w-md text-center text-xs text-slate-400 font-sans space-y-2 mb-6">
        {isAuthenticated ? (
          <p>
            Your current authenticated role (
            <span className="font-mono font-semibold text-amber-400">{user?.role}</span>) lacks
            the required capability{' '}
            <code className="px-1.5 py-0.5 bg-navy-900 border border-navy-700 rounded text-amber-300 font-mono text-[11px]">
              command3d:view_globe
            </code>
            . 3D Globe operations are restricted to Researcher, Government, and Admin roles.
          </p>
        ) : (
          <p>
            The 3D Command Globe requires verified operational credentials. Please authenticate
            with an authorized command account to initialize the 3D globe session.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onReturnToMap}
          className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 text-white font-mono text-xs rounded border border-navy-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>RETURN TO 2D MAP</span>
        </button>

        {!isAuthenticated && (
          <button
            onClick={onOpenLogin}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-navy-950 font-mono font-bold text-xs rounded transition-colors shadow-sm"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>SIGN IN TO COMMAND</span>
          </button>
        )}
      </div>

      <div className="mt-8 flex items-center gap-2 text-[10px] font-mono text-slate-500 bg-navy-900/60 px-3 py-1.5 rounded border border-navy-800">
        <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
        <span>JATAYU SERVER-ENFORCED CAPABILITY CHECK FAILED (HTTP 403 / CLIENT GATE)</span>
      </div>
    </div>
  );
};
