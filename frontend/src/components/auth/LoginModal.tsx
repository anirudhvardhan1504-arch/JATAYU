import React, { useState } from 'react';
import { ShieldCheck, Lock, User, AlertCircle, X, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { login, isLoading, error, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!username.trim() || !password.trim()) {
      setLocalError('Both username and password are required.');
      return;
    }

    try {
      await login(username.trim(), password);
      setUsername('');
      setPassword('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed. Please check credentials.');
    }
  };

  const handleClose = () => {
    setLocalError(null);
    clearError();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-navy-900 border border-navy-700 rounded-lg shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-navy-950 border-b border-navy-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-navy-800 border border-navy-700 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                Command Authentication
              </h3>
              <p className="text-[10px] text-slate-400 font-sans">
                Privileged Access Verification
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="px-6 py-2.5 bg-amber-950/30 border-b border-amber-900/40 text-[11px] text-amber-300/90 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <span>
            Authorized disaster response personnel only. Token issued in React memory; no credentials or tokens are saved to disk.
          </span>
        </div>

        {/* Local Demo Evaluator Access */}
        {(typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            Boolean((import.meta as any)?.env?.DEV))) && (
          <div className="mx-6 mt-4 p-3 bg-navy-950 border border-amber-500/40 rounded-md">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                LOCAL EVALUATOR DEMO ACCESS
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                RESEARCHER
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mb-2 leading-relaxed font-sans">
              Pre-configured evaluation account for validating the Adyar SFINCS hydrodynamic model and command telemetry.
            </p>
            <button
              type="button"
              onClick={() => {
                setUsername('qa_commander');
                setPassword('JatayuResearcher2026!');
                setLocalError(null);
                clearError();
              }}
              className="w-full py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:border-amber-500/60 rounded text-[11px] font-mono font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>⚡ Quick Fill Demo Researcher (qa_commander)</span>
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {(localError || error) && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{localError || error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Operator Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. command_officer"
                autoComplete="username"
                autoFocus
                disabled={isLoading}
                className="w-full pl-9 pr-3 py-2 bg-navy-950 border border-navy-700 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Access Secret
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                disabled={isLoading}
                className="w-full pl-9 pr-3 py-2 bg-navy-950 border border-navy-700 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 rounded text-xs font-mono text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-navy-950 font-mono font-bold text-xs rounded transition-colors shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>AUTHENTICATING...</span>
                </>
              ) : (
                <span>VERIFY IDENTITY</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
