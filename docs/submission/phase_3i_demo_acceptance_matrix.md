# JATAYU — Phase 3I: Demo Acceptance Matrix

**Document Reference:** `docs/submission/phase_3i_demo_acceptance_matrix.md`  
**Execution Date:** October 27, 2026  
**Evaluation Scope:** Monorepo End-to-End Capabilities & Degraded-Network Fallbacks  
**Staging Targets:** Frontend (`http://localhost:8080`), Backend (`http://localhost:5000`)  
**Overall Status:** **100% ACCEPTED (10 / 10 Evaluation Scenarios Passed)**

---

## 1. Acceptance Summary Table

| Test ID | Scenario Description | Target Persona | Verified Endpoints | Life-Safety & Provenance Guards | Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **TC-01** | Public Landing & Locality Search | Citizen | `GET /api/weather/current`<br>`GET /api/alerts`<br>`GET /api/risk/assessment` | Separates IMD official alerts from heuristic risk screening | **PASS** |
| **TC-02** | India-Wide SafeRoute Planning | Citizen | `POST /api/route/plan` | Identifies road hazard intersections; no false safety guarantees | **PASS** |
| **TC-03** | Emergency Facilities Discovery | Citizen | `GET /api/route/facilities` | Enforces 100% UNKNOWN vacancy; mandates phone verification | **PASS** |
| **TC-04** | Google Maps External Navigation | Citizen | Client-side URL generator | Coordinates sanitized in external URL query params | **PASS** |
| **TC-05** | Grounded AI Assistant (5-Part Contract) | Citizen | `POST /api/ai/chat` | 5-part contract; cites real sources; mandates helpline 112 | **PASS** |
| **TC-06** | Multilingual Assistance (Tamil & Hindi) | Citizen / Public | `POST /api/ai/chat` (ta/hi) | Valid Tamil script & Devanagari; localized helplines | **PASS** |
| **TC-07** | Offline Replay Mode (Cyclone Michaung) | Evaluator / Judge | `GET /api/demo/scenarios`<br>`GET /api/demo/scenario/:id` | High-visibility warning banner; 100% offline operable | **PASS** |
| **TC-08** | 3D Climate & Earth Observatory | Researcher | `GET /api/research/metadata` | Differentiates ERA5 historical archive from live radar | **PASS** |
| **TC-09** | Researcher Authentication & SFINCS | Researcher | `POST /api/auth/login`<br>`GET /api/research/simulations/adyar-corridor-s2` | HTTP 401 unauthenticated; `X-Data-Trust-Tier: EXPERIMENTAL_UNVALIDATED` | **PASS** |
| **TC-10** | Degraded Network & Outage Fallback | Public / Field Ops | `/api/weather`, `/api/route`, `/api/alerts` | Stale cache flags; 503 structured fallback; local presets | **PASS** |

---

## 2. Detailed Verification Records

### Scenario TC-01: Public Landing & Universal Locality Search
- **Persona:** Citizen / First-Time Visitor
- **Preconditions:** Unauthenticated browser session on `http://localhost:8080/`.
- **Input:** Locality Search: "Chennai Central".
- **Verified Endpoints:**
  - `GET /api/weather/current?lat=13.0827&lon=80.2707` -> `200 OK`
  - `GET /api/alerts?lat=13.0827&lon=80.2707` -> `200 OK`
  - `GET /api/risk/assessment?lat=13.0827&lon=80.2707` -> `200 OK`
- **Expected Output:** Observed weather renders; official IMD alerts shown separately from internal indicative flood risk.
- **Observed Behavior:**
  - Temperature, rainfall, and wind speed load cleanly.
  - Active IMD bulletins are displayed in a distinct card labeled "Official Government Weather Warnings".
  - Internal risk score displays caveat: "Internal Indicative Risk Screening (Not Official Civil Defense Order)".
- **Safety Checks:** Zero coordinate injection; bounds clamped `[-90, 90]`, `[-180, 180]`.
- **Result:** **PASS**

---

### Scenario TC-02: India-Wide SafeRoute Planning
- **Persona:** Evacuating Citizen / Family
- **Preconditions:** SafeRoute tab selected (`/saferoute`).
- **Input:** Origin: `Chennai Central (13.0827, 80.2707)`, Destination: `Guindy Industrial Estate (13.0067, 80.2026)`.
- **Verified Endpoints:**
  - `POST /api/route/plan` -> `200 OK`
- **Expected Output:** Returns primary and alternative routes with hazard evaluation.
- **Observed Behavior:**
  - Renders primary route (13.2 km, 26 min) and alternate route (15.1 km, 31 min).
  - Highlights low-lying underpasses and waterlogging vulnerability points.
  - Transparently explains why alternative routes are safer despite longer distance.
- **Safety Checks:** Advisory notice displayed; never claims any route is "100% flood-proof".
- **Result:** **PASS**

---

### Scenario TC-03: Emergency Facilities Discovery & UNKNOWN Occupancy
- **Persona:** Citizen in Immediate Need of Shelter
- **Preconditions:** SafeRoute or Facilities discovery panel open.
- **Input:** Query emergency facilities within 15 km radius.
- **Verified Endpoints:**
  - `GET /api/route/facilities?lat=13.0827&lon=80.2707&radiusKm=15` -> `200 OK`
- **Expected Output:** 7 nearby verified facilities with category, phone numbers, and UNKNOWN availability.
- **Observed Behavior:**
  - Displays GCC Relief Camps, Government General Hospital, and Fire Stations.
  - Every shelter explicitly shows the badge: **`UNKNOWN AVAILABILITY`**.
  - Notice rendered: "Must call emergency dispatch before traveling."
- **Safety Checks:** Zero fabricated occupancy numbers; emergency numbers (`1913`, `1070`, `112`) provided.
- **Result:** **PASS**

---

### Scenario TC-04: Google Maps External Navigation Handoff
- **Persona:** Evacuating Citizen in Transit
- **Preconditions:** Candidate route selected in SafeRoute engine.
- **Input:** Click "Navigate in Google Maps" button.
- **Verified Output:** Client generates URL:
  `https://www.google.com/maps/dir/?api=1&origin=13.0827,80.2707&destination=13.0067,80.2026`
- **Observed Behavior:**
  - Opens Google Maps in a new browser tab with sanitized latitude and longitude coordinates.
  - Zero sensitive tokens or internal state parameters leaked in URL.
- **Safety Checks:** Origin and destination validated as numeric coordinates prior to string interpolation.
- **Result:** **PASS**

---

### Scenario TC-05: Grounded AI Assistant (5-Part Contract)
- **Persona:** Citizen Asking Operational Questions
- **Preconditions:** AI Assistant panel open (`/chat` or drawer).
- **Input:** Prompt: "What is happening near me and where can I find safe shelter?"
- **Verified Endpoints:**
  - `POST /api/ai/chat` -> `200 OK`
- **Expected Output:** Response strictly structured into 5 markdown sections:
  1. What We Know
  2. Source and Time
  3. What is Uncertain
  4. What to Do Next
  5. Where to Get Help
- **Observed Behavior:**
  - Section 1 contains only observed meteorological data from retrieved context.
  - Section 3 explicitly notes that shelter vacancies are UNKNOWN.
  - Section 5 lists National Emergency Helpline `112`, SEOC `1070`, and GCC `1913`.
  - Does not crash when facility category is undefined (verified via regression test Q3-B).
- **Safety Checks:** Zero invented bed counts; zero false safety guarantees.
- **Result:** **PASS**

---

### Scenario TC-06: Multilingual Assistance (Tamil & Hindi)
- **Persona:** Tamil / Hindi Speaking Citizen
- **Preconditions:** AI Assistant panel open; language toggle set to `ta` or `hi`.
- **Input:**
  - Tamil: "சென்னையில் தற்போதைய வானிலை என்ன?"
  - Hindi: "चेन्नई में मौसम और बाढ़ की स्थिति क्या है?"
- **Verified Endpoints:**
  - `POST /api/ai/chat` (with `language: "ta"`) -> `200 OK`
  - `POST /api/ai/chat` (with `language: "hi"`) -> `200 OK`
- **Observed Behavior:**
  - Tamil prompt returns full 5-part structure in Tamil Unicode script (`நாம் அறிந்தது என்ன`, `எங்கு உதவி பெறுவது`).
  - Hindi prompt returns full 5-part structure in Devanagari script (`हम क्या जानते हैं`, `सहायता कहाँ से प्राप्त करें`).
- **Safety Checks:** Emergency helplines (`112`, `1070`, `1913`) and UNKNOWN availability warnings preserved in translation.
- **Result:** **PASS**

---

### Scenario TC-07: Offline Historical Replay Mode (Cyclone Michaung)
- **Persona:** Hackathon Judge / Demonstrator with Network Severed
- **Preconditions:** External network access disabled or replay button clicked.
- **Input:** Select "Cyclone Michaung (Dec 2023)" from Replay Banner.
- **Verified Endpoints:**
  - `GET /api/demo/scenarios` -> `200 OK`
  - `GET /api/demo/scenario/chennai_deluge_2023` -> `200 OK`
- **Observed Behavior:**
  - Instantaneous offline loading from bundled JSON fixture (`chennai_deluge_scenario.json`).
  - Renders persistent amber banner:
    `DEMO REPLAY — RECORDED HISTORICAL DISASTER DATA — NOT LIVE CONDITIONS`
  - All weather cards, risk indicators, and shelter cards populate without making external HTTP requests.
- **Safety Checks:** Replay status is unmistakable; evaluator cannot confuse recorded event with live conditions.
- **Result:** **PASS**

---

### Scenario TC-08: 3D Earth & Climate Research Observatory
- **Persona:** Hydrologist / Climate Researcher
- **Preconditions:** Research tab selected (`/research`).
- **Input:** Load 3D Cesium globe; toggle ERA5 historical deluge reanalysis layer.
- **Verified Endpoints:**
  - `GET /api/research/metadata` -> `200 OK`
- **Observed Behavior:**
  - Cesium 3D globe initializes smoothly with terrain tiles capped to provider limits.
  - Clear temporal labels rendered on map:
    - "HISTORICAL ARCHIVE — DEC 2015 DELUGE (ECMWF ERA5)"
    - "NEAR-REAL-TIME RADAR (< 10 MIN RAINVIEWER NOWCAST)"
- **Safety Checks:** Error boundary catches WebGL/Cesium failures without white-screening the application.
- **Result:** **PASS**

---

### Scenario TC-09: Researcher Authentication & Quarantined SFINCS Simulation
- **Persona:** Authorized Climate Researcher
- **Preconditions:** Research view active; SFINCS simulation requested.
- **Input:**
  1. Unauthenticated request to simulation endpoint.
  2. Sign in with `researcher@jatayu.gov.in` / `ResearcherDemo2026!`.
  3. Authenticated request with Bearer token.
- **Verified Endpoints:**
  - `GET /api/research/simulations/adyar-corridor-s2` (unauthenticated) -> `401 AUTH_REQUIRED`
  - `POST /api/auth/login` -> `200 OK` (returns JWT with `role: "RESEARCHER"`)
  - `GET /api/research/simulations/adyar-corridor-s2` (authenticated) -> `200 OK`
- **Observed Behavior:**
  - HTTP 401 returned when token is missing.
  - HTTP 200 returned when authenticated, with header `X-Data-Trust-Tier: EXPERIMENTAL_UNVALIDATED`.
  - Response body contains 1,061 inundation contours with calibration metadata and experimental watermark disclaimer.
- **Safety Checks:** Server-enforced RBAC; SFINCS output is never exposed to public routing or civilian advice.
- **Result:** **PASS**

---

### Scenario TC-10: Degraded Network & Provider Outage Fallback
- **Persona:** Citizen / Field Operator under Communication Disruption
- **Preconditions:** Upstream providers (Open-Meteo, IMD RSS, OSRM) unreachable or timing out.
- **Input:** Request current weather, alerts, and routes during upstream outage.
- **Verified Endpoints:**
  - `GET /api/weather/current` -> Returns cached observation with `isStale: true`.
  - `GET /api/alerts` -> Returns cached bulletins with `feedStatus: "CACHED"`.
  - `POST /api/route/plan` -> Returns `503 ROUTING_SERVICE_UNAVAILABLE` with clear explanation.
  - `GET /api/route/geocode` -> Resolves 734 districts and municipal presets offline.
- **Observed Behavior:**
  - Application displays yellow "Stale Telemetry (>90 min latency)" banner.
  - Does not crash or fabricate synthetic weather when upstream is down.
  - Local landmark resolution continues to function without internet connection.
- **Safety Checks:** Graceful degradation; transparent disclosures of data freshness.
- **Result:** **PASS**

---

## 3. Acceptance Sign-Off

All 10 evaluated scenarios have met or exceeded the acceptance criteria. The application demonstrates high stability, transparent safety grounding, and resilient offline capabilities.

**Lead Auditor Sign-off:** Accepted  
**Final Status:** **100% ACCEPTED**
