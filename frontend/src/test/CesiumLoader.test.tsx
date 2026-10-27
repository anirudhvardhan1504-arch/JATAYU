import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import {
  loadCesium,
  isCesiumLoaded,
  resetCesiumLoaderForTesting,
} from '../utils/cesiumLoader';
import { Command3DErrorBoundary } from '../components/command3d/Command3DContainer';

describe('Cesium Dynamic On-Demand Loader & Regression Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetCesiumLoaderForTesting();
    // Clean DOM of injected scripts
    document.querySelectorAll('script[src*="Cesium"]').forEach((el) => el.remove());
    delete (window as any).Cesium;
    delete (window as any).CESIUM_BASE_URL;
  });

  afterEach(() => {
    document.querySelectorAll('script[src*="Cesium"]').forEach((el) => el.remove());
    delete (window as any).Cesium;
    delete (window as any).CESIUM_BASE_URL;
  });

  it('1. verifies production dist/index.html does NOT statically reference Cesium.js or widgets.css', () => {
    const distHtmlPath = path.resolve(__dirname, '../../dist/index.html');
    if (!fs.existsSync(distHtmlPath)) {
      throw new Error(`Production dist/index.html not found at ${distHtmlPath}`);
    }
    const html = fs.readFileSync(distHtmlPath, 'utf8');

    // Assert that unconditional static Cesium tags are absent from the HTML
    expect(html).not.toMatch(/<script[^>]+src="[^"]*cesium[^"]*Cesium\.js"/i);
    expect(html).not.toMatch(/<link[^>]+href="[^"]*cesium[^"]*widgets\.css"/i);

    // Verify standard citizen entry assets are present
    expect(html).toMatch(/<script[^>]+type="module"[^>]+src="\/assets\/index-[^"]+\.js"/i);
    expect(html).toMatch(/<div id="root"><\/div>/);
  });

  it('2. does not inject Cesium script or set window.Cesium before explicit load call', () => {
    expect(isCesiumLoaded()).toBe(false);
    expect(document.querySelector('script[src*="Cesium.js"]')).toBeNull();
  });

  it('3. dynamically injects Cesium script tag with CESIUM_BASE_URL and resolves when script loads', async () => {
    const loadPromise = loadCesium({ timeoutMs: 2000 });

    const script = document.querySelector<HTMLScriptElement>('script[src="/cesium/Cesium.js"]');
    expect(script).not.toBeNull();
    expect(script?.async).toBe(true);
    expect((window as any).CESIUM_BASE_URL).toBe('/cesium/');

    // Simulate browser script onload
    (window as any).Cesium = { Viewer: vi.fn(), version: '1.146.0' };
    script?.dispatchEvent(new Event('load'));

    const result = await loadPromise;
    expect(result).toBe((window as any).Cesium);
    expect(isCesiumLoaded()).toBe(true);
  });

  it('4. deduplicates concurrent and repeated load calls without injecting multiple script tags', async () => {
    const p1 = loadCesium({ timeoutMs: 2000 });
    const p2 = loadCesium({ timeoutMs: 2000 });

    const scripts = document.querySelectorAll('script[src="/cesium/Cesium.js"]');
    expect(scripts.length).toBe(1);

    // Simulate script load
    (window as any).Cesium = { loaded: true };
    scripts[0].dispatchEvent(new Event('load'));

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(r2);

    // Subsequent call after Cesium is already on window
    const p3 = await loadCesium();
    expect(p3).toBe((window as any).Cesium);
    expect(document.querySelectorAll('script[src="/cesium/Cesium.js"]').length).toBe(1);
  });

  it('5. handles script network error gracefully and cleans up DOM element', async () => {
    const loadPromise = loadCesium({ timeoutMs: 2000 });
    const script = document.querySelector<HTMLScriptElement>('script[src="/cesium/Cesium.js"]');
    expect(script).not.toBeNull();

    // Simulate script error
    script?.dispatchEvent(new Event('error'));

    await expect(loadPromise).rejects.toThrow('Network error loading Cesium 3D engine');
    expect(isCesiumLoaded()).toBe(false);
  });

  it('6. catches loading failures in Command3DErrorBoundary and displays fallback with return action', () => {
    const FaultyComponent: React.FC = () => {
      throw new Error('Script loading timed out');
    };

    const handleReturn = vi.fn();

    render(
      <Command3DErrorBoundary onReturnTo2D={handleReturn}>
        <FaultyComponent />
      </Command3DErrorBoundary>
    );

    expect(screen.getByText('Cesium 3D Engine Loading Failed')).toBeInTheDocument();
    expect(screen.getByText(/Script loading timed out/)).toBeInTheDocument();

    const returnBtn = screen.getByText('RETURN TO 2D MAPLIBRE CONSOLE');
    expect(returnBtn).toBeInTheDocument();
    fireEvent.click(returnBtn);
    expect(handleReturn).toHaveBeenCalledTimes(1);
  });
});
