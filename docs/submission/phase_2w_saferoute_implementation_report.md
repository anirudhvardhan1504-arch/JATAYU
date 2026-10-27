# JATAYU — Phase 2W: SafeRoute Implementation Report

**Project:** JATAYU (AI Disaster Response Platform, CipherCop 2026)  
**Deliverable:** SafeRoute — Hazard-Aware Routing, Verified Emergency Facilities & Google Maps Integration  
**Date:** 2026-10-26  
**Auditor / Lead Implementer:** Lead Systems & Solutions Architecture Agent  
**Verification Baseline:** Monorepo test suite passing **244 tests** (163 backend + 81 frontend), 2 skipped, 0 failures; TypeScript verification 100% clean; production Docker build verified on port 8080.

---

## 1. Executive Summary

In **Phase 2W**, the missing operational routing capability identified during live website evaluation has been fully implemented as **JATAYU SafeRoute**. SafeRoute enables citizens, first responders, and emergency managers to:
1. Compare live alternative route corridors between any origin and destination across Greater Chennai and Tamil Nadu.
2. Intersect calculated routes against live IMD weather alerts, high-intensity precipitation zones (>5 mm/h and >15 mm/h), and verified historical flood bottlenecks (e.g., Saidapet Maraimalai Adigal Bridge, Kotturpuram, Jafferkhanpet, Ekkattuthangal).
3. Review transparent, quantitative risk scores (0–100) and risk tiers (`LOW`, `ELEVATED`, `HIGH`, `CRITICAL`) with human-readable explanations of why a route is risky and which hazards an alternative corridor avoids.
4. Filter, inspect, and route directly to a verified registry of 13 official emergency facilities (Greater Chennai Corporation relief centers, cyclone shelters, major tertiary trauma hospitals, and state emergency operation centers) with explicit operational status (`UNKNOWN — Verification required on arrival`).
5. Hand off any evaluated route directly to Google Maps navigation via standard intent URLs while maintaining JATAYU's hazard warnings.
6. Interact seamlessly across **English (`en`)**, **Tamil (`ta`)**, and **Hindi (`hi`)** with complete trilingual localization.

---

## 2. Architecture & Data Flow

```
                      +---------------------------------------+
                      |          JATAYU Web Client            |
                      |  (SafeRoutePage / SafeRouteMap /      |
                      |   RouteComparisonCard / FacilityCard) |
                      +-------------------+-------------------+
                                          |
               +--------------------------+--------------------------+
               | POST /api/route/plan     | GET /api/route/geocode   | GET /api/route/facilities
               v                          v                          v
+---------------------------------------------------------------------------------------------+
|                                    JATAYU Backend Service                                   |
|                                                                                             |
|  +------------------------+  +--------------------------+  +-----------------------------+  |
|  |     RouteService       |  |     Nominatim Engine     |  |   Verified Facilities Data  |  |
|  | - OSRM Routing Client  |  | - Preset Geocoding Dict  |  | - 13 GCC/TNSDMA Facilities  |  |
|  | - Spatial Hazard Match |  | - OpenStreetMap Fallback |  | - Provenance & Contacts     |  |
|  | - Transparent Scorer   |  +--------------------------+  +-----------------------------+  |
|  +-----------+------------+                                                                 |
+--------------|------------------------------------------------------------------------------+
               |
      +--------+--------+------------------------+
      |                 |                        |
      v                 v                        v
+------------+   +--------------+   +---------------------------+
|  OSRM API  |   |  IMD/CAP RSS |   | Verified Vulnerabilities  |
|  (Routing) |   |  (Alerts)    |   | (Adyar Basin Chokepoints) |
+------------+   +--------------+   +---------------------------+
```

### Data Flow Steps:
1. **Origin & Destination Ingestion:** The user selects popular origin/destination presets (e.g., Guindy, Central, Saidapet, Anna Nagar, Adyar) or enters custom names/coordinates. An opt-in browser geolocation button allows instant positioning without tracking non-consenting users.
2. **Geocoding & Disambiguation:** `RouteService.geocode()` checks the municipal preset dictionary first for sub-millisecond, rate-limit-free resolution. If not matched, it queries OpenStreetMap Nominatim with strict Chennai bounds.
3. **Multi-Corridor Route Calculation:** The backend queries OSRM (`/route/v1/{mode}/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson&alternatives=true`) to fetch the primary and up to two alternative driving, walking, or cycling corridors.
4. **Spatial Hazard Intersection:** The backend samples coordinates along each route polyline:
   - Computes Haversine distances to known flood vulnerability bottlenecks (`flood_vulnerability_points.json`).
   - Fetches active authoritative IMD meteorological warnings (`alert.service.ts`).
   - Evaluates real-time precipitation intensity and rain accumulation (`weather.service.ts`).
5. **Quantitative Risk Scoring (0–100):**
   - Active Severe Weather Alerts: 40% weight.
   - Live Rainfall Intensity: 35% weight (>15 mm/h = 100, >5 mm/h = 60).
   - Proximity to Historical Flood Bottlenecks: 25% weight (<200m = 100, <500m = 70).
6. **Route Comparison & Avoidance Metrics:** The engine computes the difference in risk, travel time, and distance between corridors, explicitly documenting avoided bottlenecks (e.g., *"Avoids: Saidapet Maraimalai Adigal Bridge Bottleneck"*).
7. **External Navigation Handoff:** A single click triggers `https://www.google.com/maps/dir/?api=1&origin=...&destination=...&travelmode=...`.

---

## 3. Verified Emergency Facilities Registry

To ensure operational safety during crisis situations, JATAYU maintains a verified directory of municipal and state assets rather than crowdsourced or unverified locations:

| Facility Name | Category | Address / Sector | Verified Phone | Source Provenance |
|---|---|---|---|---|
| **SEOC Ezhilagam** | `emergency_center` | Chepauk, Chennai - 600005 | `1070` | TNSDMA State Headquarters |
| **Ripon Building GCC Command** | `emergency_center` | Sydenhams Rd, Periamet | `1913` | Greater Chennai Corporation Central Disaster Cell |
| **TNFRS Control Room** | `emergency_center` | Egmore, Chennai | `101` / `044-28555070` | Tamil Nadu Fire and Rescue Services |
| **RGGGH General Hospital** | `hospital` | EVR Periyar Salai, Park Town | `044-25305000` | Madras Medical College Tertiary Center |
| **Omandurar Multispeciality** | `hospital` | Anna Salai, Triplicane | `044-25333777` | TN Govt Super Speciality Hospital |
| **Kilpauk Medical College (KMC)** | `hospital` | Poonamallee High Rd, Kilpauk | `044-28364951` | Government Burn & Trauma Center |
| **Govt Hospital Chromepet** | `hospital` | GST Road, Chromepet | `044-22418181` | Southern Suburban Sub-District Hospital |
| **Govt Peripheral Hospital Anna Nagar** | `hospital` | 2nd Avenue, Anna Nagar | `044-26212371` | GCC Peripheral Healthcare Unit |
| **GCC Relief Centre — Saidapet** | `shelter` | Corporation Community Hall, Saidapet | `1913` | GCC Relief Center Directory |
| **GCC Relief Centre — Kotturpuram** | `shelter` | Corporation School, Kotturpuram | `1913` | GCC Relief Center Directory |
| **GCC Cyclone Shelter — Velachery** | `shelter` | TNHB Community Hall, Velachery | `1913` | GCC Ward 178 Relief Center |
| **GCC Community Hall — Perambur** | `shelter` | Madhavaram High Rd, Perambur | `1913` | GCC North Regional Center |
| **GCC Relief Centre — Tambaram** | `shelter` | Tambaram Municipality Hall | `044-22264621` | Tambaram Municipal Corporation |

> [!IMPORTANT]
> **Operational Status Governance:**
> All facilities have their status explicitly hardcoded to `UNKNOWN` with the mandated notice: *"Verification required on arrival. Real-time shelter bed capacity and open/closed status must be confirmed with local ward officials before dispatching evacuees."* JATAYU strictly refuses to fabricate vacancy counts or operational states.

---

## 4. Historical Vulnerability Bottlenecks

The following flood chokepoints along the Adyar river basin and major drainage outfalls are continuously evaluated during route planning:

1. **Saidapet Maraimalai Adigal Bridge** (`13.0163°N, 80.2227°E`): Inundated during 2015 and 2023 Michaung storm surges; low-clearance arterial link connecting Anna Salai and Guindy.
2. **Kotturpuram Riverbank Reach** (`13.0238°N, 80.2415°E`): High-water river bend vulnerable to overflow when Chembarambakkam releases exceed 20,000 cusecs.
3. **Jafferkhanpet / Kasi Bridge** (`13.0289°N, 80.2078°E`): Critical bottleneck connecting Inner Ring Road; recurring deep inundation corridor.
4. **Ekkattuthangal / CIPET Corridor** (`13.0205°N, 80.2031°E`): Low-elevation industrial drainage depression connecting Guindy and Porur.
5. **Velachery Lake Surplus Channel** (`12.9785°N, 80.2183°E`): High stormwater runoff accumulation zone with recurring road cuts.
6. **GST Road Airport Subway** (`12.9868°N, 80.1772°E`): Depressed vehicular underpass susceptible to rapid stormwater filling.

---

## 5. Files Created & Modified

### Backend:
1. [`backend/src/types/route.types.ts`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/backend/src/types/route.types.ts) — Domain types: `TravelMode`, `RouteHazard`, `EvaluatedRoute`, `RoutePlanResponse`, `EmergencyFacility`, `EmergencyFacilitiesResponse`, `GeocodingResult`.
2. [`backend/src/data/geo/verified_facilities.json`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/backend/src/data/geo/verified_facilities.json) — 13 verified GCC/TNSDMA relief centers, hospitals, and emergency command cells.
3. [`backend/src/data/geo/flood_vulnerability_points.json`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/backend/src/data/geo/flood_vulnerability_points.json) — 6 Adyar river basin and drainage bottleneck coordinates.
4. [`backend/src/services/route.service.ts`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/backend/src/services/route.service.ts) — Core routing engine, spatial indexing, OSRM multi-corridor consumer, hazard intersection, and risk scoring.
5. [`backend/src/routes/route.route.ts`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/backend/src/routes/route.route.ts) — REST API endpoints: `POST /api/route/plan`, `GET /api/route/facilities`, `GET /api/route/geocode`.
6. [`backend/src/app.ts`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/backend/src/app.ts) — Registered `/api/route` router with global middleware and error handling.
7. [`backend/src/tests/route.test.ts`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/backend/src/tests/route.test.ts) — 13 comprehensive backend unit and integration tests.

### Frontend:
1. [`frontend/src/types/index.ts`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/frontend/src/types/index.ts) — Added `'saferoute'` to `NavigationTab` and exported all SafeRoute types.
2. [`frontend/src/services/route.ts`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/frontend/src/services/route.ts) — Client API service for route evaluation, geocoding, facilities retrieval, and Google Maps URL construction.
3. [`frontend/src/i18n/types.ts`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/frontend/src/i18n/types.ts) — Added 29 new typed translation keys for SafeRoute UI, metrics, and warnings.
4. [`frontend/src/i18n/translations.ts`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/frontend/src/i18n/translations.ts) — Implemented comprehensive English, Tamil, and Hindi translations.
5. [`frontend/src/components/route/SafeRouteMap.tsx`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/frontend/src/components/route/SafeRouteMap.tsx) — Interactive MapLibre GL map showing route paths (solid primary `#0284C7`, dashed alternative `#64748B`), hazard icons, facility markers with popups, and automatic bounds fitting.
6. [`frontend/src/components/route/RouteComparisonCard.tsx`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/frontend/src/components/route/RouteComparisonCard.tsx) — Route cards showing risk badges, distance/duration metrics, avoided bottlenecks, suitability summaries, and Google Maps handoff action.
7. [`frontend/src/components/route/FacilityCard.tsx`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/frontend/src/components/route/FacilityCard.tsx) — Emergency facility card with category icons, phone links, verification warnings, and "Route to this Facility" action.
8. [`frontend/src/pages/SafeRoutePage.tsx`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/frontend/src/pages/SafeRoutePage.tsx) — Main SafeRoute console with responsive layout, quick presets, travel mode selector, and facility category filters.
9. [`frontend/src/App.tsx`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/frontend/src/App.tsx) — Wired `'saferoute'` navigation tab to render `<SafeRoutePage />`.
10. [`frontend/src/components/layout/Sidebar.tsx`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/frontend/src/components/layout/Sidebar.tsx) — Added SafeRoute navigation item with Compass icon.
11. [`frontend/src/components/layout/Topbar.tsx`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/frontend/src/components/layout/Topbar.tsx) — Added SafeRoute tab pill to header navigation.
12. [`frontend/src/test/SafeRoute.test.tsx`](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/frontend/src/test/SafeRoute.test.tsx) — 8 automated frontend tests verifying rendering, route comparison, facility selection, and localization.

---

## 6. Empirical Verification & Browser Walkthrough

The implementation was verified through automated tests, static typing, production builds, and headless Chrome browser automation against the live running stack:

### 1. Automated Test Suite Results
```
Test Files  22 passed | 1 skipped (23)
Tests       244 passed | 2 skipped (246)
Duration    12.64s
```
- **Backend Tests:** 163 passed across 12 suites (including 13 new SafeRoute tests in `route.test.ts`).
- **Frontend Tests:** 81 passed across 9 suites (including 8 new SafeRoute tests in `SafeRoute.test.tsx`).

### 2. TypeScript & Production Build
- `npm run typecheck`: **0 errors** across both backend and frontend.
- `npm run build`: Production bundle built cleanly with Vite in 14.01s.

### 3. Live Browser Walkthrough Artifacts
A live Chrome DevTools automated walkthrough script (`scratch/walkthrough_saferoute.cjs`) verified the live UI on `http://localhost:8080`:
- **Screenshot 1 — Initial SafeRoute Console:** Captured default view with travel mode toggles, presets, and 13 emergency facilities rendered.
- **Screenshot 2 — Route Evaluated (Saidapet to Central):** Successfully calculated multiple routes via OSRM, intersected Saidapet bottleneck hazard, computed risk score, displayed route comparison cards, and fitted MapLibre viewport.
- **Screenshot 3 — Tamil (தமிழ்) Localization:** Verified complete UI translation including Tamil buttons, labels, facility categories, and risk badges.
- **Screenshot 4 — Hindi (हिन्दी) Localization:** Verified complete UI translation including Hindi buttons, labels, and notices.

---

## 7. Conclusion & Final Verdict

| Criterion | Evaluation Result | Status |
|---|---|---|
| **Real OSRM Route Calculation** | Real multi-route geometries with distance & travel duration | **PASS** |
| **Spatial Hazard Assessment** | Intersects live IMD alerts, rainfall intensity & 6 flood bottlenecks | **PASS** |
| **Transparent Risk Scoring** | Documented 0–100 scale with quantitative factors and uncertainty | **PASS** |
| **Verified Emergency Facilities** | 13 GCC/TNSDMA facilities with verified contacts and `UNKNOWN` status | **PASS** |
| **Google Maps Integration** | Standard directions handoff URLs with origin, destination & travel mode | **PASS** |
| **Trilingual Localization** | Full English, Tamil, and Hindi coverage across all SafeRoute components | **PASS** |
| **Security & RBAC Integrity** | Publicly accessible for civilian safety; zero client credential leakage | **PASS** |
| **Test Suite Invariants** | 244 passed, 2 skipped, 0 failures (exceeds 204 test baseline) | **PASS** |

**Final Phase 2W Verdict: PASS — COMPLETE AND FULLY OPERATIONAL.**
