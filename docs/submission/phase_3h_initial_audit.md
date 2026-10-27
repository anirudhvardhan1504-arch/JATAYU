# JATAYU — Phase 3H: Repository Audit & Reproducible Baseline Report

**Project:** JATAYU — AI-Powered Disaster Intelligence & Hazard-Aware Navigation  
**Phase:** Phase 3H-A (Repository Audit and Reproducible Build)  
**Date:** 27 October 2026  
**Auditor:** Lead Software Architect, Application Security Engineer & QA Lead  
**Execution Target:** Frontend `http://localhost:8080`, Backend `http://localhost:5000`

---

## 1. Executive Summary

This initial audit establishes an objective, empirical baseline of the JATAYU repository prior to implementing Phase 3H enhancements. Every finding is classified strictly into:
1. **Directly Observed Facts:** Verified by tool execution, filesystem inspection, or live HTTP probes during this session.
2. **Reported Baselines:** Inherited claims from prior phase documentation requiring active confirmation.
3. **Unverified Capabilities:** Features dependent on unconfigured external keys or hardware not present in the current environment.
4. **Reproduced Defects:** Real engineering issues reproduced under controlled test conditions.

---

## 2. Directly Observed Repository State

### 2.1 Workspace & Git Environment
- **Root Directory:** `C:\Users\Anirudh\OneDrive\Desktop\Jatayu`
- **Branch:** `master`
- **Git Commit State:** Initialized repository with uncommitted staged/untracked tree. No pre-existing remote configured.
- **Node Runtime:** Node.js `v24.12.0` (npm `v11.1.0`) on Windows 11 host.
- **Workspace Architecture:** npm workspaces with root `package.json`, `backend/`, and `frontend/`.

### 2.2 Workspace Package Configurations
- **Root (`package.json`):**
  - Name: `jatayu` (v0.1.0)
  - Workspaces: `["backend", "frontend"]`
  - Scripts: `dev`, `build`, `test`, `typecheck`
- **Backend (`backend/package.json`):**
  - Dependencies: `express@4.21.2`, `dotenv@16.4.7`, `cors@2.8.5`, `fast-xml-parser@5.11.2`, `shapefile@0.6.6`, `which-polygon@2.2.1`.
  - Database: Native SQLite engine via Node.js built-in `node:sqlite` (`DatabaseSync`).
  - Build script: `"build": "tsc"` (compiles TypeScript to `dist/`).
- **Frontend (`frontend/package.json`):**
  - Core Stack: `react@18.3.1`, `react-dom@18.3.1`, `maplibre-gl@5.2.0`, `cesium@1.146.0`, `recharts@2.15.1`, `tailwindcss@3.4.17`, `vite@6.2.0`.
  - Deferred Cesium Loader: Custom Vite plugin `cesiumDeferredLoaderPlugin` strips Cesium CSS/JS from public `index.html` until lazy activation.

### 2.3 Running Services & Health Checks
- **Backend Daemon (Port 5000):** Responsive at `http://localhost:5000/api/health`.
  ```json
  {
    "status": "ok",
    "platform": "JATAYU Disaster Intelligence Platform",
    "version": "0.1.0",
    "services": {
      "database": { "provider": "SQLite (node:sqlite)", "status": "ready" },
      "weather": { "provider": "Open-Meteo", "status": "ready" },
      "ai": { "configured": false, "provider": "OpenRouter", "message": "OpenRouter API key is not set. The platform runs in scaffolding mode." }
    }
  }
  ```
- **Frontend Server (Port 8080):** Responsive at `http://localhost:8080/`, proxying `/api` requests to backend on port 5000.
- **Chrome DevTools Protocol (CDP):** Verified headless Chromium session captures 16 clean screenshots with 0 console errors.

---

## 3. Findings & Defect Classification

### Category A — Directly Observed Facts
1. **Separation of Risk & Official Warnings:** `AlertService` ingests IMD RSS bulletins with source attribution (`IMD Nowcast RSS`) and keeps them distinct from heuristic risk screening cards.
2. **SFINCS Hydrodynamic Quarantine:** Endpoint `GET /api/research/simulations/adyar-corridor-s2` requires `RESEARCHER`, `GOVERNMENT`, or `ADMIN` role. Unauthenticated requests return HTTP 401; responses set `X-Data-Trust-Tier: EXPERIMENTAL_UNVALIDATED`.
3. **Emergency Shelter Availability:** All facility records strictly return `currentAvailability: "UNKNOWN"`.
4. **Multilingual Coverage:** 100% dictionary coverage in English (`en`), Tamil (`ta`), and Hindi (`hi`).

### Category B — Historical Reported Baselines (Phase 3G)
1. **Automated Test Counts:** 283 passed, 2 skipped (smoke live network tests) across backend and frontend.
2. **SafeRoute OSRM Engine:** Dual-route calculation with Saidapet bottleneck evaluation.
3. **ERA5 Historical Reanalysis:** 2015 Chennai Deluge preset rendering 7-day storm precipitation (169.3 mm).

### Category C — Unverified Capabilities & External Limitations
1. **Live Generative LLM Completion:** `OPENROUTER_API_KEY` is not configured in `.env`. The system operates in deterministic fallback mode (sub-second structured markdown generator). Generative completions against live Claude 3.5 Sonnet remain unverified in the local environment.
2. **Remote Continuous Integration:** No `.github/workflows/` directory exists in the repository. No automated remote CI runs have occurred.
3. **Live Cellular Emergency Broadcasts:** System does not interface with cellular broadcast systems (CBC) or NDMA SMS gateways (simulated via in-app alerts).

### Category D — Newly Reproduced Defects
1. **Defect D-01: Asset Packaging Discrepancy for Local Host Builds:**
   - *Description:* In `backend/package.json`, `"build": "tsc"` only transpiles TypeScript to `backend/dist/`. The runtime JSON data files in `backend/src/data/geo/` (`verified_facilities.json`, `flood_vulnerability_points.json`, `imd_district_synonyms.json`) are not copied to `dist/data/geo/`.
   - *Impact:* While the multi-stage Docker build explicitly executed `cp -r ./backend/src/data/geo/* ./backend/dist/data/geo/`, launching `node backend/dist/index.js` on a developer host without Docker caused `RouteService.loadData()` to find 0 facilities and 0 vulnerability points.
   - *Status:* Confirmed and reproducible. Fix planned in Phase 3H-A.
2. **Defect D-02: SQLite Test Hook Timeout under Windows CPU Throttling:**
   - *Description:* In `backend/src/tests/command.test.ts` and `research.test.ts`, `beforeAll` sequentially hashes 5 to 7 passwords using PBKDF2-HMAC-SHA512 (100,000 iterations). Under high CPU load or concurrent test execution on Windows, this exceeds vitest's default 10,000ms hook timeout.
   - *Status:* Confirmed and reproducible. Fix planned in Phase 3H-A.
3. **Defect D-03: Dependency Advisories Identified in `npm audit`:**
   - *Description:* `npm audit` reports 6 vulnerabilities: `body-parser` (DoS via trailing bytes), `postcss-selector-parser` (DoS via flat selector), `maplibre-gl` (DOM.sanitize bypass), and `tinypool`/`vitest` (dev-only prototype pollution).
   - *Status:* Confirmed and documented for Phase 3H-B remediation.

---

## 4. Verification Checkpoints for Stage 1 Transition

| Milestone | Target | Verification Method |
| :--- | :--- | :--- |
| **Asset Packaging** | Clean `npm --workspace=backend run build` bundles all runtime JSON assets | Check `backend/dist/data/geo/verified_facilities.json` exists |
| **Runtime Path Resolution** | `RouteService` loads facilities from compiled `dist/` without relying on CWD | Probe `GET /api/route/facilities` returns count > 0 |
| **CI Automation** | Add `.github/workflows/ci.yml` covering build, typecheck, test, asset check | Local workflow dry-run validation |
| **Test Suite Health** | All tests pass cleanly without hook timeouts | Run `npm test` across entire monorepo |
