import React, { Component, ReactNode, Suspense, lazy } from 'react';
import { Command3DLoading } from './Command3DLoading';
import { loadCesium } from '../../utils/cesiumLoader';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

interface Props {
  selectedLocation: { name: string; lat: number; lon: number };
  onSelectLocation?: (loc: { name: string; lat: number; lon: number }) => void;
  onReturnTo2D: () => void;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

export class Command3DErrorBoundary extends Component<
  { onReturnTo2D: () => void; children: ReactNode },
  State
> {
  constructor(props: { onReturnTo2D: () => void; children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: any): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Failed to initialize 3D geospatial runtime.',
    };
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[750px] w-full rounded-lg bg-navy-950 border border-navy-800 flex flex-col items-center justify-center p-8 text-slate-300">
          <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-700/60 flex items-center justify-center text-red-400 mb-6">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-base font-mono font-bold tracking-wider text-white uppercase mb-2">
            Cesium 3D Engine Loading Failed
          </h3>
          <p className="max-w-md text-center text-xs text-slate-400 mb-6 font-sans">
            {this.state.errorMessage}. Please check network connectivity or return to the 2D
            MapLibre tactical map.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={this.props.onReturnTo2D}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-navy-950 font-mono font-bold text-xs rounded transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>RETURN TO 2D MAPLIBRE CONSOLE</span>
            </button>
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-1.5 px-3 py-2 bg-navy-800 hover:bg-navy-700 text-slate-200 border border-navy-700 font-mono text-xs rounded transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>RETRY</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy-load Cesium 3D module on-demand only after loadCesium() resolves
const LazyCommand3DView = lazy(async () => {
  await loadCesium();
  return import('./Command3DView');
});

export const Command3DContainer: React.FC<Props> = (props) => {
  return (
    <Command3DErrorBoundary onReturnTo2D={props.onReturnTo2D}>
      <Suspense fallback={<Command3DLoading />}>
        <LazyCommand3DView {...props} />
      </Suspense>
    </Command3DErrorBoundary>
  );
};

export default Command3DContainer;
