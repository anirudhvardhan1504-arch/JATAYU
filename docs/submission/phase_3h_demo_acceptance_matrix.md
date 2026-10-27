# JATAYU Phase 3H — Demo Acceptance Matrix

**Document Reference:** `docs/submission/phase_3h_demo_acceptance_matrix.md`  
**Execution Date:** October 27, 2026  
**Evaluation Scope:** 8 End-to-End Demonstration Journeys  
**Environment:** Staging Frontend (`http://localhost:8080`), Express Backend (`http://localhost:5000`)  
**Overall Acceptance Status:** **100% ACCEPTED (8 / 8 Journeys Passed)**

---

## Acceptance Summary Dashboard

| Journey # | Persona | Demonstration Journey | Key Safety / Provenance Check | Result |
| :---: | :--- | :--- | :--- | :---: |
| **J-01** | Citizen | Public Landing & Universal Locality Search | Distinguishes IMD official alerts from heuristic risk score | **PASS** |
| **J-02** | Citizen | India-Wide Hazard-Aware SafeRoute Planning | Route hazard evaluation without false safety declarations | **PASS** |
| **J-03** | Citizen | Emergency Facilities Discovery & Shelter Safety | Shelter availability is strictly `UNKNOWN`; calls mandated | **PASS** |
| **J-04** | Citizen | Google Maps Turn-by-Turn Navigation Handoff | Coordinates sanitized in external URL handoff | **PASS** |
| **J-05** | Public / Judge | Offline Historical Replay Scenarios | High-visibility warning banner; authentic archived data | **PASS** |
| **J-06** | Citizen / Commander | Grounded AI Assistant (5-Part Contract & i18n) | 5-part contract; emergency helplines; zero hallucination | **PASS** |
| **J-07** | Researcher | 3D Earth & Climate Research Observatory | Temporal distinction between historical reanalysis and radar | **PASS** |
| **J-08** | Researcher | Researcher Login & Quarantined SFINCS Simulation | SFINCS locked behind RBAC; marked `EXPERIMENTAL_UNVALIDATED` | **PASS** |

---

## Detailed Journey Acceptance Records

### Journey J-01: Public Landing & Universal Locality Search
- **Persona:** Citizen / First-Time Visitor
- **Preconditions:** Unauthenticated browser session on `http://localhost:8080/`.
- **User Actions:**
  1. Open homepage.
  2. Type "Chennai Central" into the locality search box.
  3. Select suggested location from the dropdown.
- **Verified Endpoints:**
  - `GET /api/weather/current?lat=13.0827&lon=80.2707` -> `200 OK`
  - `GET /api/alerts?lat=13.0827&lon=80.2707` -> `200 OK`
  - `GET /api/risk/evaluate?lat=13.0827&lon=80.2707` -> `200 OK`
- **Observed Behavior:**
  - Local weather telemetry (temperature, rainfall, wind speed) renders within 300 ms.
  - Active IMD warning bulletins are displayed in a separate card from internal risk screening.
  - Heuristic risk level is explicitly labeled: "Internal Indicative Risk Screening (Not Official Civil Defense Order)".
- **Safety / Provenance Checks:**
  - [x] Input coordinates validated and clamped.
  - [x] Data provenance clearly marked (Open-Meteo NWP & IMD Nowcast).
- **Status:** **PASS**

---

### Journey J-02: India-Wide Hazard-Aware SafeRoute Planning
- **Persona:** Citizen / Evacuating Family
- **Preconditions:** SafeRoute tab selected (`/saferoute`).
- **User Actions:**
  1. Set Origin: `Chennai Central (13.0827, 80.2707)`.
  2. Set Destination: `Guindy Industrial Estate (13.0067, 80.2026)`.
  3. Click "Calculate Safe Route".
- **Verified Endpoints:**
  - `POST /api/route/plan` -> `200 OK`
- **Observed Behavior:**
  - Returns primary route and alternatives with distance (13.2 km) and duration (26 mins).
  - Evaluates intermediate flood vulnerability points along the corridor.
  - Identifies hazard intersections (e.g. low-lying subway crossings near Saidapet).
- **Safety / Provenance Checks:**
  - [x] Route does not declare absolute safety; includes advisory disclaimer.
  - [x] Clear explanation of why alternative routes might be safer despite longer distance.
- **Status:** **PASS**

---

### Journey J-03: Emergency Facilities Discovery & Shelter Safety
- **Persona:** Citizen Seeking Immediate Shelter
- **Preconditions:** SafeRoute or Facilities discovery panel open.
- **User Actions:**
  1. Query emergency facilities within 15 km of current location.
  2. Inspect facility cards (GCC Relief Centers, Hospitals, Fire Stations).
- **Verified Endpoints:**
  - `GET /api/route/facilities?lat=13.0827&lon=80.2707&radiusKm=15` -> `200 OK`
- **Observed Behavior:**
  - Displays pre-verified facilities with distance, category, and telephone numbers.
  - Every relief camp / shelter shows availability badge: **`UNKNOWN`**.
  - Displays explicit notice: "Always verify availability via emergency helpline before traveling."
- **Safety / Provenance Checks:**
  - [x] Zero fabricated vacancy numbers (e.g. "45 beds open" never displayed).
  - [x] Mandates calling GCC Helpline (`1913`) or State Emergency (`1070`).
- **Status:** **PASS**

---

### Journey J-04: Google Maps Turn-by-Turn Navigation Handoff
- **Persona:** Citizen in Transit
- **Preconditions:** Route calculated in SafeRoute engine.
- **User Actions:**
  1. Click "Navigate in Google Maps" button on selected route.
- **Verified Endpoints:**
  - Client-side navigation URL generation: `https://www.google.com/maps/dir/?api=1&origin=13.0827,80.2707&destination=13.0067,80.2026`
- **Observed Behavior:**
  - Opens Google Maps in a new browser tab with origin and destination coordinates intact.
  - Validates that coordinates are sanitized numbers before building the URL.
- **Safety / Provenance Checks:**
  - [x] No sensitive tokens or internal state leaked in external URL query params.
  - [x] Coordinates sanitized against XSS or parameter injection.
- **Status:** **PASS**

---

### Journey J-05: Offline Historical Replay Scenarios
- **Persona:** Judge / Evaluator in Offline or Demonstrator Mode
- **Preconditions:** Offline mode or evaluation drill.
- **User Actions:**
  1. In the header bar, click "Historical Scenario Replay".
  2. Select "December 2015 Chennai Deluge".
  3. Verify loaded conditions and facility states.
- **Verified Endpoints:**
  - `GET /api/replay/scenarios` -> `200 OK`
  - `GET /api/replay/scenarios/chennai_deluge` -> `200 OK`
- **Observed Behavior:**
  - Loads recorded rainfall (494 mm/24h) and peak wind data instantly from bundled fixture.
  - High-visibility banner renders across the top:
    `DEMO REPLAY — RECORDED HISTORICAL DISASTER DATA — NOT LIVE CONDITIONS`
- **Safety / Provenance Checks:**
  - [x] Authenticity verified against ECMWF ERA5 reanalysis and IMD bulletins.
  - [x] Persistent disclaimer ensures evaluator never mistakes historical data for live emergency.
  - [x] 100% UNKNOWN vacancy compliance preserved in all historical facilities.
- **Status:** **PASS**

---

### Journey J-06: Grounded AI Assistant (5-Part Contract & i18n)
- **Persona:** Citizen / Field Operator Asking Critical Questions
- **Preconditions:** AI Assistant panel open (`/chat` or floating drawer).
- **User Actions:**
  1. Prompt: "What is happening near me and where can I find help?"
  2. Switch language to Tamil (தமிழ்) and prompt: "என் பகுதிக்கு அருகில் என்ன நடக்கிறது?"
  3. Switch language to Hindi (हिन्दी) and prompt: "चेन्नई में बाढ़ की स्थिति क्या है?"
- **Verified Endpoints:**
  - `POST /api/ai/chat` -> `200 OK`
- **Observed Behavior:**
  - Output strictly adheres to the 5-part contract:
    1. What We Know
    2. Source and Time
    3. What is Uncertain
    4. What to Do Next
    5. Where to Get Help
  - Tamil and Hindi prompts return responses in natural Tamil script and Devanagari script.
- **Safety / Provenance Checks:**
  - [x] National Emergency Number `112` and municipal helplines (`1913`, `1070`) are always present.
  - [x] Refuses to declare streets "guaranteed flood-free"; cites micro-drainage limits.
  - [x] Quarantines SFINCS models from civilian guidance.
- **Status:** **PASS**

---

### Journey J-07: Earth & Climate Research Observatory
- **Persona:** Disaster Researcher / Hydrologist
- **Preconditions:** Research tab selected (`/research`).
- **User Actions:**
  1. Open 3D Cesium Earth view.
  2. Load ERA5 2015 Deluge reanalysis layer.
  3. Toggle RainViewer radar layer and observe temporal labeling.
- **Verified Endpoints:**
  - `GET /api/research/metadata` -> `200 OK`
- **Observed Behavior:**
  - Cesium 3D globe renders smooth terrain with maximum tile level constraints.
  - Temporal badges explicitly differentiate:
    - **ERA5 Deluge:** "HISTORICAL ARCHIVE — DEC 2015"
    - **RainViewer:** "NEAR-REAL-TIME RADAR NOWCAST (< 10 MIN)"
- **Safety / Provenance Checks:**
  - [x] Temporal integrity maintained; historical data cannot be confused with live radar.
  - [x] Cesium tile errors caught by error boundary without crashing the interface.
- **Status:** **PASS**

---

### Journey J-08: Researcher Authentication & Quarantined SFINCS Simulation
- **Persona:** Authorized Climate Researcher
- **Preconditions:** Research view active; SFINCS simulation panel requested.
- **User Actions:**
  1. Attempt to view SFINCS simulation unauthenticated -> Observe auth required guard.
  2. Sign in with `researcher@jatayu.gov.in` / `ResearcherDemo2026!`.
  3. Access Adyar Basin Scenario 2 Inundation Simulation.
- **Verified Endpoints:**
  - `POST /api/auth/login` -> `200 OK` (returns JWT with `role: "RESEARCHER"`)
  - `GET /api/research/simulations/adyar-corridor-s2` (without token) -> `401 AUTH_REQUIRED`
  - `GET /api/research/simulations/adyar-corridor-s2` (with Bearer token) -> `200 OK`
- **Observed Behavior:**
  - Returns 6.6 MB GeoJSON containing 1,061 inundation contours with metadata.
  - HTTP response header includes `X-Data-Trust-Tier: EXPERIMENTAL_UNVALIDATED`.
  - UI renders permanent watermark: "EXPERIMENTAL HYDRODYNAMIC SIMULATION — RESEARCH USE ONLY".
- **Safety / Provenance Checks:**
  - [x] Role-Based Access Control (RBAC) enforced on both client and server.
  - [x] Explicitly quarantined: Never fed to civilian route planning or evacuation orders.
- **Status:** **PASS**

---

## Acceptance Sign-Off Matrix

| Journey | Evaluated Feature | Acceptance Criteria Met | Lead QA Sign-off |
| :---: | :--- | :---: | :---: |
| **J-01** | Locality Search & Alerts | YES | **ACCEPTED** |
| **J-02** | Hazard-Aware SafeRoute | YES | **ACCEPTED** |
| **J-03** | Facilities & Shelter Safety | YES | **ACCEPTED** |
| **J-04** | Google Maps Handoff | YES | **ACCEPTED** |
| **J-05** | Offline Historical Replay | YES | **ACCEPTED** |
| **J-06** | Grounded AI 5-Part Contract | YES | **ACCEPTED** |
| **J-07** | 3D Climate Observatory | YES | **ACCEPTED** |
| **J-08** | SFINCS Simulation RBAC | YES | **ACCEPTED** |

**Final Rehearsal Outcome:** All 8 demonstration journeys passed acceptance criteria. No critical defects or safety violations remain open.
