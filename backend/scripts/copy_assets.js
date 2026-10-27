#!/usr/bin/env node
/**
 * JATAYU Asset Bundler
 * Copies required geo and research runtime data assets into backend/dist/data
 * Fails deterministically if any required asset is missing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

const REQUIRED_FILES = [
  'src/data/geo/verified_facilities.json',
  'src/data/geo/flood_vulnerability_points.json',
  'src/data/geo/imd_district_synonyms.json',
  'src/data/geo/india_districts_simplified.geojson',
  'src/data/research/adyar_corridor_s2_inundation_contours.geojson',
  'src/data/research/adyar_corridor_s2_meta.json',
  'src/data/replay/chennai_deluge_scenario.json',
  'src/data/replay/hyderabad_musi_scenario.json',
  'src/data/replay/mumbai_monsoon_scenario.json',
];

console.log('[Asset Bundler] Verifying and copying required runtime assets to dist/data...');

// 1. Verify all required source files exist
for (const relFile of REQUIRED_FILES) {
  const fullPath = path.resolve(backendDir, relFile);
  if (!fs.existsSync(fullPath)) {
    console.error(`[Asset Bundler ERROR] Required source asset missing: ${fullPath}`);
    process.exit(1);
  }
}

// 2. Ensure dist/data directories exist
const distGeoDir = path.resolve(backendDir, 'dist/data/geo');
const distResearchDir = path.resolve(backendDir, 'dist/data/research');
const distReplayDir = path.resolve(backendDir, 'dist/data/replay');

fs.mkdirSync(distGeoDir, { recursive: true });
fs.mkdirSync(distResearchDir, { recursive: true });
fs.mkdirSync(distReplayDir, { recursive: true });

// 3. Copy geo assets
const srcGeoDir = path.resolve(backendDir, 'src/data/geo');
fs.cpSync(srcGeoDir, distGeoDir, {
  recursive: true,
  force: true,
  filter: (src) => !src.endsWith('.ts'), // Do not copy typescript helper scripts
});

// 4. Copy research assets if present
const srcResearchDir = path.resolve(backendDir, 'src/data/research');
if (fs.existsSync(srcResearchDir)) {
  fs.cpSync(srcResearchDir, distResearchDir, { recursive: true, force: true });
}

// 5. Copy replay scenario assets
const srcReplayDir = path.resolve(backendDir, 'src/data/replay');
if (fs.existsSync(srcReplayDir)) {
  fs.cpSync(srcReplayDir, distReplayDir, { recursive: true, force: true });
}

// 5. Verification: ensure destination files exist
let copiedCount = 0;
for (const relFile of REQUIRED_FILES) {
  const distRel = relFile.replace(/^src\//, 'dist/');
  const distPath = path.resolve(backendDir, distRel);
  if (!fs.existsSync(distPath)) {
    console.error(`[Asset Bundler ERROR] Verification failed: ${distPath} does not exist in dist.`);
    process.exit(1);
  }
  copiedCount++;
}

console.log(`[Asset Bundler SUCCESS] Verified and bundled ${copiedCount} runtime assets into dist/data.`);
