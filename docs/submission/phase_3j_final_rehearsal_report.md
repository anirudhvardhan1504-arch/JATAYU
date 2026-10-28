# JATAYU — Phase 3J: Final Demo Rehearsal & Submission Lock Report

**Document Reference:** `docs/submission/phase_3j_final_rehearsal_report.md`  
**Execution Timestamp:** October 27, 2026 — 13:13:30+05:30  
**Repository Working Directory:** `C:\Users\Anirudh\OneDrive\Desktop\Jatayu`  
**Baseline Git Commit:** `22ccfdbf2ca61784a1a6ee683811f4fb603db1da`  
**Evaluator:** Senior Systems Architect & Lead Rehearsal Auditor  
**Final Verdict:** **`READY FOR DEMO`**

---

## 1. Executive Summary & Verdict

The JATAYU platform was subjected to a comprehensive, real-browser end-to-end rehearsal executing the exact three-minute presentation runbook (`docs/submission/phase_3i_three_minute_demo_script.md`).

All seven rehearsal journeys were verified against the live running deployment:
- **Port 5000:** Express Backend Daemon (healthy, `status: "ok"`)
- **Port 8080:** Frontend Application (healthy, `HTTP 200 OK`)
- **Total Console Errors:** **0 errors** logged throughout the entire rehearsal.
- **Reproducible Blockers Found:** **0 blockers**.
- **Application Code Modifications:** **0 modifications** (the verified baseline commit `22ccfdb` is preserved untouched).

### Verdict: **`READY FOR DEMO`**

---

## 2. Stage 1 — Baseline Integrity Check

The repository was verified prior to executing the rehearsal:

| Integrity Check | Expected Baseline | Observed Verification Result | Status |
| :--- | :--- | :--- | :---: |
| **Commit Hash (`git rev-parse HEAD`)** | `22ccfdbf2ca61784a1a6ee683811f4fb603db1da` | `22ccfdbf2ca61784a1a6ee683811f4fb603db1da` | **MATCH** |
| **Working-Tree Status (`git status`)** | Clean tracked tree; untracked `scratch/` | `## master`, `?? scratch/` | **VERIFIED** |
| **Phase 3I Release Readiness Report** | `docs/submission/phase_3i_release_readiness_report.md` | Present & verified (14,815 bytes) | **VERIFIED** |
| **Phase 3I Demo Acceptance Matrix** | `docs/submission/phase_3i_demo_acceptance_matrix.md` | Present & verified (11,954 bytes) | **VERIFIED** |
| **Phase 3I 3-Minute Demo Script** | `docs/submission/phase_3i_three_minute_demo_script.md` | Present & verified (7,157 bytes) | **VERIFIED** |
| **9 Runtime Source Assets** | All 9 files in `backend/src/data/` | Present & verified on disk | **VERIFIED** |

---

## 3. Stage 2 — Step-by-Step Rehearsal Matrix

The rehearsal script (`scratch/rehearsal_phase3j.cjs`) was executed using Chrome headless CDP against `http://127.0.0.1:8080` and `http://localhost:5000`:

| Step # | Demo Script Phase | User Action & Evaluated Feature | Observed Behavior & Evidence | Result |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **Act 1: Public Landing & Locality Selection** | Navigate to `http://127.0.0.1:8080`; search for `Chennai Central`. | Title: `JATAYU — Disaster Intelligence & Response Platform`. Locality search renders. Operational weather telemetry displays without errors. Screenshot: `rehearsal_3j_01_landing_page.png`. | **PASS** |
| **2** | **Act 2: Grounded AI Assistant** | Navigate to AI Assistant (`Command AI`); query situational status & next steps. | 5-part contract verified: `What We Know`, `Source and Time`, `What is Uncertain`, `What to Do Next`, `Where to Get Help`. National Emergency `112` and GCC `1913` cited. Screenshot: `rehearsal_3j_02_ai_assistant.png`. | **PASS** |
| **3** | **Act 3: SafeRoute Planning & Hazards** | Navigate to `SafeRoute`; route from Chennai Central to Guindy. | Route engine computes distance (13.2 km) and duration (26 mins). Highlights low-lying underpass hazard intersections along the corridor. Screenshot: `rehearsal_3j_03_saferoute.png`. | **PASS** |
| **4** | **Act 3: Facilities & Shelter Safety** | Navigate to `Emergency Help` (Facilities Directory); inspect shelter badges. | Pre-verified facilities load. Every shelter displays the **`UNKNOWN AVAILABILITY`** badge with directive to call dispatch before traveling. Zero fabricated bed counts. Screenshot: `rehearsal_3j_04_facilities.png`. | **PASS** |
| **5** | **Act 5: Climate Research & SFINCS** | Navigate to `Climate & Research`; test unauthenticated vs authenticated access. | Unauthenticated request to `/api/research/simulations/adyar-corridor-s2` returns `401 AUTH_REQUIRED`. Login with `researcher@jatayu.gov.in` returns `200 OK` with header `X-Data-Trust-Tier: EXPERIMENTAL_UNVALIDATED`. Screenshot: `rehearsal_3j_05_research.png`. | **PASS** |
| **6** | **Act 4: Offline Scenario Replay** | Click `Launch Recorded Demo Replay`; select `Cyclone Michaung Dec 2023`. | Persistent amber warning banner renders: `DEMO REPLAY — RECORDED HISTORICAL DISASTER DATA — NOT LIVE CONDITIONS`. Offline telemetry loads instantly from fixture. Screenshot: `rehearsal_3j_06_demo_replay.png`. | **PASS** |
| **7** | **Degraded-Network & Rate Limiting** | Out-of-bounds coordinate query; check rate limit & security headers. | Out-of-bounds coordinates return `400 INVALID_COORDINATES`. Defensive headers (`nosniff`, `SAMEORIGIN`, `strict-origin`) confirmed active. | **PASS** |

**Rehearsal Execution Telemetry:**  
- **Total Browser Console Errors Logged:** `0`  
- **Total Unhandled Exceptions:** `0`  

---

## 4. Stage 3 — Claims and Safety Audit

All presentation claims were audited against actual application behaviors:

1. **Replay vs. Live Clarity:**
   - Recorded replay is never presented as live observations. The persistent amber banner and explicit dropdown labels ("Cyclone Michaung Dec 2023", "Hyderabad Musi Oct 2020", "Mumbai Monsoon July 2023") make the historical replay status unmistakable.
2. **Scientific Simulation Quarantine:**
   - Adyar Basin SFINCS hydrodynamic outputs are server-enforced behind the `RESEARCHER` role. Unauthenticated requests receive HTTP 401. Responses carry `X-Data-Trust-Tier: EXPERIMENTAL_UNVALIDATED` and an explicit watermark disclaimer barring use as civilian evacuation guidance.
3. **Zero Fabricated Shelter Availability:**
   - In all API endpoints, database queries, and AI narratives, relief camp availability is strictly `UNKNOWN`. The application mandates calling GCC Helpline `1913`, BMC `1916`, GHMC `040-21111111`, or National Emergency `112` before departure.
4. **AI Freshness & Uncertainty Disclosures:**
   - The Grounded AI assistant discloses data providers (Open-Meteo, IMD) and explicitly highlights micro-drainage limitations (unavailability of real-time street drain blockage sensors).
5. **No Exposure of Secrets:**
   - The presentation workflow uses dedicated local mock credentials (`researcher@jatayu.gov.in` / `ResearcherDemo2026!`). No production keys, tokens, or private user data are required or exposed.
6. **Offline Capability Scope:**
   - Full offline operation is verified specifically for the **Historical Scenario Replay** mode (which operates completely from local fixtures without external network requests). Live routing and live weather depend on upstream connectivity (or degrade gracefully to local landmark dictionary and cached observations).

---

## 5. Stage 4 — Operational Notes & Submission Readiness

### Host Binding & Docker Image Notice
During rehearsal inspection, an important operational nuance was identified:
- If running Docker Compose (`docker compose up`), the existing container images may reflect earlier builds unless rebuilt with `docker compose build --no-cache`.
- For the live presentation, the project owner should either:
  - **Option A (Recommended for Local Dev):** Demonstrate via the active Vite development server at `http://127.0.0.1:8080` (where Phase 3I code is immediately live).
  - **Option B (For Containerized Staging):** Rebuild container images using `docker compose build --no-cache` prior to running `docker compose up -d`.

---

## 6. Single Most Important Action for the Project Owner

> [!IMPORTANT]
> **Do NOT modify application code, dependencies, or database configuration before the presentation.**  
> Keep the backend (`http://localhost:5000`) and frontend (`http://127.0.0.1:8080`) active in their current running state. Follow the timing and choreography in [phase_3i_three_minute_demo_script.md](file:///c:/Users/Anirudh/OneDrive/Desktop/Jatayu/docs/submission/phase_3i_three_minute_demo_script.md) for a seamless, grounded, and compelling hackathon demonstration.
