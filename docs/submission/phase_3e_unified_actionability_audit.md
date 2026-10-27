# JATAYU — Phase 3E: Unified Disaster Intelligence & Actionability Audit

**Date:** 26 October 2026  
**Auditor:** Senior Product Architect, Disaster-Management Domain Analyst & QA Auditor  
**Repository:** `C:\Users\Anirudh\OneDrive\Desktop\Jatayu`  
**Deployment Baseline:** Frontend `http://localhost:8080`, Backend `http://localhost:5000` (Docker Compose)  
**Audit Scope:** Read-only empirical capability verification, end-to-end user journey evaluation, trust & safety validation, and requirements traceability.

---

## 1. Executive Summary & Audit Baseline

### 1.1 Context & Objective
JATAYU is designed as an AI-powered disaster intelligence and response platform for the CipherCop 2026 hackathon (AI Disaster Response Track). Following successive development stages (Phases 2U through 3A), this **Phase 3E Unified Actionability Audit** rigorously verifies whether the live platform delivers actionable, grounded, and trust-calibrated value across its core personas:
1. **The Citizen in Peril:** Seeking immediate local hazard awareness, official warnings, safe transit options, and emergency shelter/hospital locations during extreme weather events.
2. **The Climate & Hydrology Researcher:** Investigating past extreme storms (e.g., 2015 Chennai Deluge, 2023 Cyclone Michaung), examining physical reanalysis rainfall profiles, inspecting satellite cloud dynamics, and analyzing hydrodynamic flood inundation models without confusing experimental simulations with certified operational forecasts.
3. **The Emergency Operations Responder:** Requiring unhallucinated situation reports (SITREPs), explicit data-tier separation (IMD official bulletins vs. indicative heuristics vs. quarantined physics models), and robust multilingual fallback operation under power or network constraints.

### 1.2 Audit Governance & Constraints
- **Strict Read-Only Enforcement:** No application code, database records, Docker configurations, scientific constants, or authentication parameters were altered during this audit.
- **Evidence-First Verification:** All conclusions are grounded in live HTTP probing against running Docker containers (`jatayu-web` and `jatayu-backend`), static code inspection, and 271 passing Vitest/backend automated regression tests.
- **Strict Anti-Hallucination & Data Integrity Rules:** No shelter vacancies or hospital bed availability were fabricated (`currentAvailability: "UNKNOWN"` is strictly adhered to). The Adyar SFINCS hydrodynamic simulation remains strictly quarantined under `EXPERIMENTAL_UNVALIDATED`.

---

## 2. Platform Architecture & Service Health Status

Live probes executed against the running Docker stack confirmed full operational readiness:

| Service / Component | Target / Port | Live Status | Evidence / Response Metric |
| :--- | :--- | :--- | :--- |
| **Backend API** | `http://localhost:5000/api/health` | **HEALTHY (200 OK)** | Uptime verified; Node.js v24.22.1; SQLite connected; Open-Meteo external endpoint responsive (`status: "ok"`). |
| **Frontend Web App** | `http://localhost:8080` | **HEALTHY (200 OK)** | Nginx Alpine serving Vite React SPA; production bundle loads in <250ms locally. |
| **Test Suite** | Node/Vitest Test Runner | **PASSED** | **271 passed, 2 skipped, 0 failed** across 25 test suites covering routes, auth, risk, weather, and UI components. |
| **TypeScript / Build** | `npm run build` | **PASSED** | Backend (`tsc`) and Frontend (`vite build`) compiled cleanly with 0 type errors. |

---

## 3. Stage 1: Verified vs. Unverified Capability Matrix

Every backend endpoint and core frontend module was probed to establish empirical capabilities:

| Functional Area / Endpoint | Live Probed Route | Observed Status & Payload | Verified Capabilities | Explicit Non-Claims / Limitations |
| :--- | :--- | :--- | :--- | :--- |
| **Live Weather Telemetry** | `GET /api/weather/current?lat=13.0827&lon=80.2707` | **200 OK** | Real-time temperature (27.1°C), humidity (85%), precipitation (0 mm), wind speed/direction, surface soil moisture (0.354 m³/m³). | Powered by Open-Meteo NWP blends; not a direct hyper-local physical weather station on the user's rooftop. |
| **Forecast Profiles** | `GET /api/weather/forecast?lat=13.0827&lon=80.2707` | **200 OK** | 7-day hourly temperature, rain accumulation, wind gusts, and soil moisture saturation trends. | Forecasts are numerical predictions subject to model error bounds. |
| **Official Weather Alerts** | `GET /api/alerts?lat=13.0827&lon=80.2707` | **200 OK** (`LIVE_VERIFIED`) | Returns official IMD RSS-parsed nowcasts and bulletins; correctly reports 0 active warnings in calm conditions with timestamp and IMD source citation. | Alerts reflect official published bulletins; does not invent localized alerts if none are issued by IMD. |
| **Indicative Risk Scoring** | `GET /api/risk/assessment?lat=13.0827&lon=80.2707` | **200 OK** (`Score: 31, GUARDED`) | Blends rainfall accumulation, soil saturation index, and topological factors into risk tier (`LOW`, `GUARDED`, `ELEVATED`, `SEVERE`). | Explicitly tagged `INDICATIVE_MODEL` with `UNVALIDATED_PROTOTYPE` warning; not a municipal civil defense declaration. |
| **Universal Geocoding** | `GET /api/route/geocode?q=Saidapet` | **200 OK** | Multi-result disambiguation returning Saidapet Metro and Saidapet Flyover with coordinates and bounding boxes. | Relies on OpenStreetMap Nominatim; rate-limited and cached locally. |
| **Hazard-Aware SafeRoute** | `POST /api/route/plan` | **200 OK** (Primary 12.73 km, Alt 13.9 km) | Multi-route OSRM driving engine; evaluates hazard proximity (Saidapet bridge bottleneck detected within 294m); generates Google Maps handoff URL. | Non-guaranteed advisory screening; does not guarantee zero waterlogging; does not monitor real-time road closures or fallen trees. |
| **Emergency Facilities** | `GET /api/route/facilities?lat=13.0827&lon=80.2707` | **200 OK** (Ripon Cell, RGGGH, etc.) | Geodesic distance calculation, phone/hotline, verified facility types (shelter, hospital, control cell), Google Maps directions URL. | Strictly enforces `currentAvailability: "UNKNOWN"`; never claims live bed counts or vacant shelter cots without telemetry. |
| **Historical Weather & Climate** | `GET /api/weather/historical?startDate=2015-11-28&endDate=2015-12-04` | **200 OK** (169.3 mm accumulation) | Copernicus ERA5 reanalysis daily precipitation series for major historical storms (2015 Chennai Deluge, Cyclone Michaung). | Reanalysis is gridded (~25–30 km); not point rain gauge records. RainViewer radar is live nowcast only, not historical. |
| **Adyar Hydrodynamic SFINCS** | `GET /api/research/simulations/adyar-corridor-s2` | **401 Unauthorized** (Guest) / **200 OK** (Researcher) | Role-gated (`qa_commander`); returns 28.01 km river reach, 199,440 active grid cells (30m), peak discharge 3,180 m³/s, GeoJSON inundation contours. | Strictly quarantined under `EXPERIMENTAL_UNVALIDATED`; barred from triggering public route closures or civil alerts. |
| **Multilingual AI SITREP** | `POST /api/ai/chat` | **200 OK** (Deterministic fallback) | Structured tactical situation reports formatted cleanly in English, Tamil, and Hindi without external LLM keys. | Deterministic rule-based template fallback when OpenRouter API key is unset. |

---

## 4. Stage 2: Deep Evaluation of the Public Emergency Journey

The public emergency journey was evaluated against a citizen experiencing heavy rain and localized flooding in Chennai.

### Step 1: Initial Arrival & Clarity
- **Experience:** Citizen lands on `http://localhost:8080`. The hero headline immediately communicates purpose: *"AI-Powered Disaster Intelligence & Hazard-Aware Navigation"*.
- **Clarity:** A prominent status banner displays the current operational state with clear color-coded badges.
- **Verdict:** **EXCELLENT**. No confusing technical jargon or military command acronyms clutter the entry view.

### Step 2: Immediate Local Hazard Awareness
- **Experience:** Citizen clicks the primary CTA: *"Check My Area"*. The page smooth-scrolls to the local weather and risk card.
- **Telemetry:** Displays live temperature, precipitation (mm), wind speed, and soil saturation index.
- **Friction Identified:** If browser geolocation is denied or slow, the citizen must manually scroll up to the universal search bar in the Topbar to enter their locality.
- **Improvement Recommendation:** Provide an inline locality search box directly inside the Local Hazard Assessment card on the landing page for immediate fallback.

### Step 3: Official Warnings vs. Modeled Heuristic Risk
- **Separation:** The platform visually and logically separates:
  1. *Official Weather Bulletins:* Sourced from IMD Nowcast RSS with official timestamps and orange/red warning banners.
  2. *Indicative Risk Screening:* Sourced from JATAYU heuristic multi-factor score (`Score: 31, GUARDED`).
- **Attribution:** The risk card explicitly displays: *"INDICATIVE SCREENING MODEL: For personal situational awareness only. Not an official civil defence evacuation order."*
- **Verdict:** **OUTSTANDING COMPLIANCE**. Prevents dangerous confusion between official alerts and algorithmic estimates.

### Step 4: Action Recommendations
- **Experience:** Citizens receive clear, tiered, actionable guidance based on current risk levels (e.g., *"Secure loose objects", "Avoid underpasses and low-lying river bridges", "Keep emergency kit ready"*).
- **Multilingual Support:** Action advice renders seamlessly in English, Tamil, and Hindi via the global language toggle (`Topbar.tsx`).

### Step 5: SafeRoute Navigation Planning
- **Experience:** Citizen navigates to `/saferoute`. Origin and destination can be set via:
  - Universal autocomplete place search (powered by backend Nominatim proxy).
  - Browser GPS one-click button.
  - Direct map click selection.
- **Execution:** Live OSRM routing calculates driving options in <1.5 seconds.

### Step 6: Route Comparison & Bottleneck Explanation
- **Evaluation:** SafeRoute presents:
  - Primary Route: Shortest travel time (e.g., 12.73 km, 16 mins).
  - Alternative Route: Secondary path avoiding dense transit corridors (e.g., 13.9 km, 19 mins).
- **Hazard Intersections:** The backend detects proximity to vulnerable physical terrain. For a route passing the Saidapet corridor, it alerts: *"Route approaches Saidapet Bridge bottleneck (within 294 m). Historical inundation risk during Adyar river surges."*
- **Safety Disclaimer:** Prominently states: *"Advisory screening only. Does not guarantee impassable water depths or unmonitored road obstacles."*

### Step 7: Emergency Facility Discovery
- **Experience:** Citizen clicks to inspect nearby emergency relief shelters, government hospitals, and civic control centers.
- **Sorting:** Results are sorted by geodesic distance from origin/current location.
- **Truth in Advertising:** Crucially, each facility badge reads: `VACANCY: UNKNOWN`. The card explicitly advises: *"Please contact facility or toll-free control room (1913) prior to transit to verify active shelter admission."*
- **Handoff:** Provides a direct `Open in Google Maps` link for live GPS navigation.

### Step 8: Offline / Low-Connectivity Readiness
- **Capabilities:**
  - Emergency phone numbers (112, 1070, 1077, 1913) are displayed as clickable `tel:` links.
  - Print / PDF summary styling allows citizens to print route hazard sheets and emergency contact lists before network towers fail.

### Step 9: Multilingual Usability
- **Languages:** English, Tamil (தமிழ்), Hindi (हिन्दी).
- **Quality:** Key emergency terms (e.g., புயல் எச்சரிக்கை, आपातकालीन आश्रय, ஆபத்து நிலை) are accurately localized without automated machine mistranslations.

---

## 5. Stage 3: Deep Evaluation of the Climate & Research Journey

The research journey was evaluated using the perspective of a hydrologist or disaster management researcher investigating extreme precipitation events in Tamil Nadu.

### Step 1: Historical Event Discovery
- **Interface:** Researcher opens the **Earth & Climate Observatory** (`/research`).
- **Presets:** Pre-configured historical presets are immediately available:
  - *2015 Chennai Deluge (28 Nov – 04 Dec 2015)*
  - *2023 Cyclone Michaung (01 Dec – 05 Dec 2023)*
- **Data Source:** Backend queries Copernicus ECMWF ERA5 reanalysis via Open-Meteo Historical Weather API.

### Step 2: Physical Rainfall Accumulation vs. Sensor Confusion
- **Data Integrity:** The platform renders an interactive daily precipitation bar chart displaying genuine historical reanalysis metrics (e.g., 169.3 mm cumulative rainfall for the selected 2015 window).
- **Distinction:** The UI clearly notes: *"Data represents Copernicus ERA5 atmospheric reanalysis gridded across ~25 km resolution, not discrete municipal tipping-bucket rain gauge telemetry."*

### Step 3: Satellite Imagery vs. Ground Truth
- **NASA GIBS Integration:** Researcher switches to the **Satellite Cloud Imagery** tab.
- **Transparency:** The viewer embeds NASA GIBS MODIS Terra / Aqua Corrected Reflectance imagery.
- **Scientific Caveat:** Prominent notice states: *"Optical satellite imagery reflects cloud-top reflectance and convective cloud mass, not direct ground surface water depth."*

### Step 4: Doppler Radar Nowcast Distinction
- **Radar Integration:** RainViewer real-time Doppler radar mosaic is accessible via the **Doppler Radar** tab.
- **Temporal Nuance:** RainViewer provides a rolling 2-hour observation loop of active convective precipitation.
- **Crucial Researcher Guardrail:** When a historical event from 2015 is selected in the timeline, the radar tab explicitly notes: *"Doppler radar feed reflects real-time atmospheric nowcast observations and is not an archive of the 2015 historical storm."* This prevents invalid retrospective assumptions.

### Step 5: Quarantined Hydrodynamic Simulation Access
- **Authentication & RBAC:**
  - Unauthenticated users attempting to query `GET /api/research/simulations/adyar-corridor-s2` receive `401 Unauthorized`.
  - Non-privileged roles (`CITIZEN`, `OPERATOR`) cannot view hydraulic velocity or depth contours.
  - Logging in as `qa_commander` (RESEARCHER role) unlocks the experimental Adyar SFINCS simulation suite.
- **Dataset Parameters Verified:**
  - Simulation Reach: 28.01 km of the Adyar River corridor (from Chembarambakkam outflow to Bay of Bengal).
  - Spatial Resolution: 30-meter computational grid.
  - Grid Size: 199,440 active computational cells.
  - Peak Inflow Boundary Condition: 3,180 m³/s reservoir release surge.
- **Quarantine Wall:** The API response injects header `X-Data-Trust-Tier: EXPERIMENTAL_UNVALIDATED`. The frontend displays a persistent yellow scientific quarantine banner:
  > *"EXPERIMENTAL RESEARCH RUN ONLY: This SFINCS hydrodynamic run (adyar-corridor-s2) has not been certified against calibrated municipal gauging data. Strictly prohibited from driving automated civil evacuation alerts or road closures."*

---

## 6. Stage 4: Responder & Decision Support Workflow Evaluation

### 6.1 Operational Evidence Triage
The operational response workflow (`/response`) enables field commanders and district coordinators to triage incoming situation data:
- Separates high-confidence official alerts from crowd-reported or heuristic indicators.
- Summarizes regional hazard posture across key urban basins (Adyar, Cooum, Buckingham Canal, Kosasthalaiyar).

### 6.2 Deterministic Situation Reporting (SITREP)
When emergency commanders request an operational SITREP via `/chat`:
- If an LLM API key (`OPENROUTER_API_KEY`) is active, the assistant generates a structured briefing citing official sources.
- If no external API key is configured, the system engages its **Deterministic Local Fallback Generator**.
- The fallback SITREP synthesizes:
  - Current meteorological parameters.
  - Active IMD alert status.
  - Evaluated route risk levels and critical river crossings.
  - Verified emergency contacts (112, 1070, 1913).
- Output is rendered cleanly in English, Tamil, or Hindi according to the active session language.

---

## 7. Trust and Safety Risk Register

| Risk ID | Hazard / Vulnerability | Severity | Current Platform Mitigation | Residual Risk & Action Required |
| :--- | :--- | :--- | :--- | :--- |
| **TR-01** | User assumes SafeRoute guarantees a 100% dry road during flash flood. | **HIGH** | Explicit advisory screening disclaimer; terrain bottleneck proximity warnings (e.g. Saidapet bridge). | Add an explicit confirmation prompt if a route enters a known flood-prone basin during an active RED alert. |
| **TR-02** | Evacuee arrives at emergency shelter that is at full capacity or unstaffed. | **HIGH** | Hardcoded `currentAvailability: "UNKNOWN"`; advice to call 1913/hotline before transit. | In future phase, integrate municipal shelter occupancy API if published by GCC/TNSDMA. |
| **TR-03** | Civil agency acts on uncalibrated SFINCS inundation simulation for evacuation order. | **CRITICAL** | Strict RBAC quarantine (Researcher/Admin only); `EXPERIMENTAL_UNVALIDATED` header; persistent warning banners. | Maintain quarantine wall indefinitely until physical calibration against 2023 sensor hydrographs is validated. |
| **TR-04** | Loss of cellular/WiFi connectivity during severe cyclone landfall. | **HIGH** | Static emergency contacts; printable route summaries; lightweight bundle size (<250 KB gzip). | Add browser Service Worker for offline PWA caching of cached routes and contact cards. |
| **TR-05** | Public confusion between optical satellite cloud imagery and ground flood depth. | **MEDIUM** | Explanatory labels on NASA GIBS viewer stating images show cloud-top reflectance. | Provide split-screen visual key comparing cloud cover vs. surface elevation. |

---

## 8. Summary Audit Conclusion

The JATAYU platform successfully bridges public usability, scientific depth, and operational rigor:
1. **It honors data trust boundaries** by never conflating official IMD warnings, heuristic risk scoring, and experimental hydrodynamic models.
2. **It avoids false promises** in routing and shelter capacity, protecting citizens from hazardous assumptions.
3. **It empowers research** through authentic reanalysis and satellite feeds while keeping uncalibrated simulations safely quarantined.
4. **It operates reliably** with 271 passing tests, clean builds, healthy containers, and robust deterministic fallbacks.
