# JATAYU — Phase 2R: Adyar Simulation GeoJSON Rendering Fix Report

**Execution Timestamp:** 2026-10-26 08:08:00 UTC  
**Author:** Lead Systems & Geospatial Architecture Agent  
**Repository Directory:** `C:\Users\Anirudh\OneDrive\Desktop\Jatayu`  
**Target Environment:** Staging Dashboard (`http://localhost:8080`)  
**Overall Status:** **VERIFIED & REPAIRED (ALL 209 MONOREPO TESTS PASSING)**  

---

## 1. Root Cause Analysis

### Discrepancy Overview
During the Phase 2P verification audit and Phase 2Q rehearsal, a frontend-backend schema mismatch was discovered:
1. **Backend Implementation:** The backend endpoint `GET /api/research/simulations/adyar-corridor-s2` in `backend/src/routes/research.route.ts` returned an envelope containing:
   - `data_trust_tier: "EXPERIMENTAL_UNVALIDATED"`
   - `trust_badge: "⚠️ EXPERIMENTAL SIMULATION — NOT VALIDATED FOR OFFICIAL CIVIL DEFENSE"`
   - `disclaimer: "..."`
   - `metadata: { ... }`
   - `geojson: <GeoJSON.FeatureCollection>`
2. **Frontend Expectation:** The frontend TypeScript interface in `frontend/src/services/research.ts` declared `contours: GeoJSON.FeatureCollection` instead of `geojson`, and `frontend/src/pages/LiveMapPage.tsx` passed `simulationGeojson={simulationData?.contours}` to the `<TacticalMap />` component.
3. **Operational Consequence:** Because `simulationData.contours` was undefined, `TacticalMap` never received the vector geometries. While the Amber Warning Banner and the sidebar Depth Table were displayed, the MapLibre GL layer `adyar-simulation-source` was not added to the map canvas, preventing polygon fills from rendering on the map.

---

## 2. Response Schema Comparison

### Schema Before Fix
```typescript
// frontend/src/services/research.ts (Before)
export interface SimulationResponse {
  data_trust_tier: string;
  model_version: string;
  scenario: string;
  metadata: SimulationMetadata;
  contours: GeoJSON.FeatureCollection; // MISMATCH: Backend sends `geojson`
}
```

### Schema After Fix
```typescript
// frontend/src/services/research.ts (After)
export interface SimulationMetadata {
  status?: string;
  horizon_hours?: number;
  peak_depth_m?: number;
  flooded_cells_pct?: number;
  deep_channel_cells_pct?: number;
  mean_depth_m?: number;
  generated_at?: string;
  crs?: string;
  reach_length_km?: number;
  model_engine?: string;
  grid_resolution_m?: number;
  disclaimer?: string;
  total_inundated_area_km2?: number;
  scenario?: string;
  domain_bounds_utm44n?: {
    x_min: number;
    x_max: number;
    y_min: number;
    y_max: number;
  };
  depth_bands_km2?: {
    shallow_0_1_to_0_5m: number;
    moderate_0_5_to_1_5m: number;
    critical_gt_1_5m: number;
  };
  simulation_horizon_hours?: number;
  solver?: string;
}

export interface SimulationResponse {
  data_trust_tier: string;
  trust_badge?: string;
  disclaimer?: string;
  requestedBy?: {
    userId: string;
    role: string;
  };
  metadata: SimulationMetadata;
  geojson: GeoJSON.FeatureCollection; // CORRECTED: Matches backend API contract
  contours?: GeoJSON.FeatureCollection; // Backwards-compatible fallback
  model_version?: string;
  scenario?: string;
}
```

---

## 3. Files Modified & Changes Made

1. **`frontend/src/services/research.ts`**:
   - Replaced inaccurate response type interface with strongly-typed `SimulationResponse` and `SimulationMetadata`.
   - Added zero-`any` runtime validation guard: `isGeoJSONFeatureCollection(data: unknown): data is GeoJSON.FeatureCollection`.
2. **`frontend/src/pages/LiveMapPage.tsx`**:
   - Updated `handleToggleSimulation` to validate `data.geojson` using `isGeoJSONFeatureCollection` prior to storing in state.
   - Replaced `simulationData?.contours` with `simulationData?.geojson ?? simulationData?.contours ?? null` in `<TacticalMap />` props.
   - Added clear, non-crashing empty state indicator: displays *"No inundation contour geometries found in simulation dataset"* when features array is empty.
   - Typed catch block with `err: unknown` to prevent silent parsing failures or unhandled crashes.
3. **`frontend/src/components/map/TacticalMap.tsx`**:
   - Replaced `any | null` props with strongly-typed `simulationGeojson?: GeoJSON.FeatureCollection | null` and `simulationMeta?: SimulationMetadata | null`.
   - Refactored `src: any` to `as maplibregl.GeoJSONSource | undefined` when updating data via `src.setData()`.
   - Replaced hardcoded metadata extent label with dynamic formatter checking `total_inundated_area_km2` or `reach_length_km`.
4. **`frontend/src/test/TacticalMap.test.tsx`**:
   - Fixed `mockGeojson` typing to satisfy `GeoJSON.FeatureCollection`.
   - Added comprehensive integration tests covering:
     - End-to-end consumption of `data.geojson` from `fetchAdyarSimulation`.
     - Prevention of duplicate sources/layers on repeated user toggles (`MUTED` -> `ACTIVE` -> `MUTED` -> `ACTIVE`).
     - Graceful handling of malformed GeoJSON without application crashing.
     - Graceful handling of empty GeoJSON feature arrays with clear user feedback.
     - Role-based access quarantine preventing unauthorized or citizen queries.

---

## 4. Regression & Verification Results

### A. Monorepo Test Suite (`npm test`)
- **Backend Tests:** 10 passed, 1 skipped (smoke.live.test.ts); **144 tests passed, 2 skipped**.
- **Frontend Tests:** 7 passed; **65 tests passed** (including 5 new Phase 2R integration tests).
- **Total:** **209 passed, 2 skipped, 0 failures**.

### B. Live Endpoint RBAC & Trust-Header Verification
Tested directly against the active container environment:
- **Anonymous Access:**
  - `GET /api/research/simulations/adyar-corridor-s2` -> **HTTP 401 Unauthorized** (`code: "AUTH_REQUIRED"`).
- **Citizen Access (Role: `CITIZEN`):**
  - `GET /api/research/simulations/adyar-corridor-s2` -> **HTTP 403 Forbidden** (`code: "FORBIDDEN"`).
- **Researcher Access (Role: `RESEARCHER`):**
  - `GET /api/research/simulations/adyar-corridor-s2` -> **HTTP 200 OK**.
  - Header: `X-Data-Trust-Tier: EXPERIMENTAL_UNVALIDATED`.
  - Body:
    - `features count`: 3 MultiPolygons (`critical`, `moderate`, `shallow`).
    - `status`: `EXPERIMENTAL_UNVALIDATED`.
    - `reach_length_km`: 28.01 km.

### C. Web Container Live Deployment
- Static production bundle rebuilt with Vite:
  - `dist/index.html` (1.17 kB)
  - `dist/assets/index-BjawqlHZ.js` (1,758.76 kB)
- Replaced production assets in `jatayu-web:/usr/share/nginx/html/`.
- Reloaded Nginx configuration (`nginx -s reload`).
- Verified HTTP 200 and updated bundle script hash served at `http://localhost:8080/`.

---

## 5. UI Rendering & Interaction Checklist

| UI Element / Feature | Status | Verification Detail |
| :--- | :---: | :--- |
| **Simulation Toggle Button** | **PASS** | Toggles smoothly between `MUTED` and `ACTIVE`. |
| **Amber Warning Banner** | **PASS** | `⚠️ EXPERIMENTAL SIMULATION — NOT VALIDATED FOR OFFICIAL CIVIL DEFENSE` locks to top center of map while simulation is active. |
| **Vector Inundation Contours** | **PASS** | Valid `FeatureCollection` delivered to MapLibre GL `adyar-simulation-source`; polygons render with depth-classified fills and borders. |
| **Depth Band Legend** | **PASS** | Displays 3 classification tiers: Shallow Ponding (0.10–0.50m), Moderate Depth (0.50–1.50m), Critical Hazard (>1.50m). |
| **Polygon Click Inspector** | **PASS** | Popup displays depth band, stage height range, subgrid carving status, and `EXPERIMENTAL_UNVALIDATED` disclaimer. |
| **Camera Navigation** | **PASS** | "FOCUS ADYAR CORRIDOR" button re-centers map to $(13.010^\circ\text{N}, 80.180^\circ\text{E})$. |
| **Citizen Quarantine** | **PASS** | Public view displays locked card `ROLE ACCESS QUARANTINE: Restricted to RESEARCHER, GOVERNMENT, and ADMIN`. |

---

## 6. Remaining Limitations

1. **Synthetic Forcing & Uncalibrated Bathymetry:** The underlying simulation remains classified as `EXPERIMENTAL_UNVALIDATED` due to synthetic SCS Type II precipitation (3-hour burst) and parabolic HydroMT subgrid carving ($H_{bed} = 3.85\text{ m}, W = 81\text{ m}$) uncalibrated to in-situ ADCP acoustic soundings.
2. **Temporal Mismatch with Satellite Reference:** The 2015 UNOSAT flood footprint reflects a receding flood state (~48 hours post-peak deluge) and cannot be used for dynamic peak validation.
3. **Data Trust Separation:** Experimental simulation contours remain strictly quarantined from civil defense alerts, public warnings, and indicative operational threat matrices.
