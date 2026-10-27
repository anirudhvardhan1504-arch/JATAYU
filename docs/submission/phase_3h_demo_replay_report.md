# JATAYU — Phase 3H Controlled Demo Replay & Offline Resilience Report

**Platform:** JATAYU — AI-Powered Disaster Intelligence and Response Platform  
**Hackathon:** CipherCop 2026 — AI Disaster Response Track  
**Date:** October 27, 2026  
**Scope:** Controlled Replay Architecture, Scenario Fixtures, Offline Resilience, Shelter Integrity Mandate, UI Safeguards

---

## 1. Executive Summary

During live disaster demonstrations and hackathon evaluations, external third-party APIs (Open-Meteo, IMD RSS, OSRM, Overpass) can face rate limiting, network latency, or unexpected upstream outages. 

Phase 3H-C implements a **Controlled Offline Replay Architecture** that enables the platform to execute complete, deterministic disaster scenarios without active internet access, while strictly adhering to data provenance and integrity boundaries:
1. **Unmistakable Visual Demarcation:** The top of the application renders a persistent, high-contrast banner:  
   `DEMO REPLAY — RECORDED HISTORICAL DISASTER DATA — NOT LIVE CONDITIONS`.
2. **Three Scientifically Grounded Scenarios:**
   - **Chennai Coastal Deluge (Cyclone Michaung, Dec 2023):** 42mm/h peak intensity, 285mm antecedent 24h accumulation, Adyar basin inundation risk, saturated coastal soils, red IMD warnings.
   - **Hyderabad Musi River Inundation (Oct 2020 Cloudburst):** 192mm in 24 hours, Musi River overflow, GHMC relief centers.
   - **Mumbai Konkan Monsoon Surge (July 2023):** 215mm 24h accumulation coinciding with 4.3m astronomical high tide lock and Mithi catchment submergence.
3. **Shelter Vacancy & Dispatch Mandate:** ALL relief centers and evacuation shelters in replay fixtures strictly enforce `currentAvailability: "UNKNOWN"`. No automated dispatch or occupied/available counts are ever fabricated. Every shelter record carries an explicit verification mandate directing users to call official municipal helplines (112 / 1913 / 1916).
4. **Isolated Provenance:** All replay fixtures are tagged with `sourceType: "DEMO_DATA"` and `feedStatus: "DEMO_REPLAY"`, preventing any confusion with live operational observations.

---

## 2. Replay Architecture & Service Integration

### A. Activation Mechanisms
Replay mode can be triggered deterministically via any of the following decoupled channels:
1. **HTTP Request Header:** `X-Jatayu-Replay-Mode: true` (with optional `X-Jatayu-Replay-Scenario: <scenario_id>`).
2. **URL Query Parameter:** `?demo=replay` or `?replay=true` (with optional `&scenario=<scenario_id>`).
3. **Environment Flag:** `DEMO_REPLAY_MODE=true` in `backend/.env`.
4. **Interactive UI Toggle:** A single-click toggle button on the public interface that persists in `sessionStorage`.

### B. Route Interception
The following backend endpoints automatically serve scenario-grounded data when replay mode is active:
- `GET /api/weather/current`: Returns historical observation with `sourceType: "DEMO_DATA"`.
- `GET /api/weather/forecast`: Returns 72-hour historical forecast profile and soil moisture saturation profile.
- `GET /api/alerts`: Returns official regional bulletins with `feedStatus: "DEMO_REPLAY"`.
- `GET /api/risk/assessment`: Returns indicative flood risk assessment with calibrated weighting factors.
- `GET /api/route/facilities`: Returns verified emergency shelters with `currentAvailability: "UNKNOWN"`.
- `GET /api/demo/scenarios`: Enumerates all available replay scenarios and their geographical footprints.
- `GET /api/demo/scenario/:id`: Retrieves the complete scenario bundle for offline inspections.

---

## 3. Shelter Availability & Scientific Integrity

In real emergency deployments, presenting unverified shelter capacity or fabricated vacancy numbers is dangerous. JATAYU enforces strict invariant boundaries:
- Under both live operational mode and demo replay mode, shelter availability is permanently classified as `UNKNOWN`.
- Verification note mandate: `"Call 112 / 1913 before dispatch. Real-time vacancy is UNKNOWN."`
- The platform surfaces physical addresses, direct telephone contacts, and capacity benchmarks, but explicitly mandates phone or radio verification with municipal dispatchers before routing evacuees.

---

## 4. Automated Verification & Test Results

Test suite: `backend/src/tests/replay.test.ts`
- **Tests Executed:** 10 passing tests
- **Duration:** 61 ms
- **Test Scenarios Verified:**
  1. Scenario discovery lists all versioned historical events.
  2. Full scenario bundle retrieval returns typed weather, risk, alert, and facility data.
  3. Non-existent scenarios reject with HTTP 404 `SCENARIO_NOT_FOUND`.
  4. Query parameter `?demo=replay` activates replay data with `sourceType: "DEMO_DATA"`.
  5. Header `X-Jatayu-Replay-Mode: true` triggers replay isolation.
  6. Alerts endpoint returns `feedStatus: "DEMO_REPLAY"` and active bulletins.
  7. Risk assessment returns calibrated critical risk scores (e.g. 88/100).
  8. **Shelter Integrity:** 100% of returned facilities report `currentAvailability: "UNKNOWN"`; zero facilities report `AVAILABLE` or `OCCUPIED`.
  9. Multi-scenario switching between Chennai, Hyderabad, and Mumbai functions cleanly.
