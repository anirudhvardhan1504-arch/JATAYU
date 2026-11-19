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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-charcoal/95 border border-white/15 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden text-jatayu-primary backdrop-blur-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-obsidian/60 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-dark-emerald/70 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(0,217,154,0.3)]">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                Command Authentication
              </h3>
              <p className="text-[10px] text-jatayu-muted font-sans">
                Privileged Access Verification
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-jatayu-muted hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="px-6 py-2.5 bg-amber-950/40 border-b border-amber-500/30 text-[11px] text-amber-300 flex items-start gap-2">
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
          <div className="mx-6 mt-4 p-3.5 bg-obsidian/70 border border-emerald-500/30 rounded-2xl shadow-subtle">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                LOCAL EVALUATOR DEMO ACCESS
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                RESEARCHER
              </span>
            </div>
            <p className="text-[10px] text-jatayu-muted mb-2.5 leading-relaxed font-sans">
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
              className="w-full py-2 px-3 bg-dark-emerald/60 hover:bg-dark-emerald text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/60 rounded-xl text-[11px] font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_12px_rgba(0,217,154,0.15)]"
            >
              <span>⚡ Quick Fill Demo Researcher (qa_commander)</span>
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {(localError || error) && (
            <div className="p-3 bg-red-950/70 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-start gap-2 shadow-panel">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{localError || error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-jatayu-secondary mb-1.5">
              Operator Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
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
                className="w-full pl-10 pr-3 py-2 bg-obsidian/70 border border-white/10 rounded-xl text-xs text-jatayu-primary placeholder:text-jatayu-muted focus:outline-none focus:border-emerald-500 font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-jatayu-secondary mb-1.5">
              Access Secret
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                disabled={isLoading}
                className="w-full pl-10 pr-3 py-2 bg-obsidian/70 border border-white/10 rounded-xl text-xs text-jatayu-primary placeholder:text-jatayu-muted focus:outline-none focus:border-emerald-500 font-mono transition-colors"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-mono text-jatayu-muted hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono font-bold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(0,217,154,0.3)] cursor-pointer"
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
