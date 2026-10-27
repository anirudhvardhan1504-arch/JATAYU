# JATAYU — Phase 3H Evaluation Plan, Performance Benchmarks & Usability Protocol

**Platform:** JATAYU — AI-Powered Disaster Intelligence and Response Platform  
**Hackathon:** CipherCop 2026 — AI Disaster Response Track  
**Date:** October 27, 2026  
**Scope:** Quantitative Performance Benchmarking, Reliability Metrics, Citizen Usability Protocol (5–8 Participants), Rigorous Usability Rubric

---

## 1. Quantitative Performance Benchmarks

The benchmark suite (`backend/scripts/benchmark_phase3h.ts`) was executed against the live application stack (`http://localhost:5000`).

### Summary Benchmark Results

| System Subsystem | Operations Tested | Success Rate | Mean Latency | P95 Latency | Min / Max Latency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Geocoding & Municipal Search** | 8 queries (Metros, landmarks, suburbs) | **100% (8/8)** | **561 ms** | **1,099 ms** | 212 ms / 1,099 ms |
| **SafeRoute & Hazard Evaluation** | 4 India-wide route planning pairs | **100% (4/4)** | **1,247 ms** | **3,458 ms** | 450 ms / 3,458 ms |
| **Grounded AI Retrieval Synthesis** | 5 queries across EN, TA, and HI | **100% (5/5)** | **4 ms** | **4 ms** | 3 ms / 4 ms |

### Key Benchmark Takeaways
1. **Offline & Online Resilience:** Geocoding queries reliably fallback to offline municipal gazetteers when upstream Nominatim is rate-limited, maintaining a 100% success rate.
2. **Deterministic Route Hazard Intersections:** Multi-kilometer route plans crossing river corridors (Adyar in Chennai, Musi in Hyderabad, Mithi in Mumbai) evaluate flood vulnerability points within ~1.2s.
3. **Sub-10ms Grounded Intelligence Synthesis:** When operating in deterministic retrieval mode, the 5-part grounded assistant responds in under 10 ms with 100% structural contract compliance.

---

## 2. Citizen Usability Testing Protocol (5–8 Participants)

### A. Participant Profile & Recruitment Criteria
- **Cohort Size:** 5 to 8 participants.
- **Demographics:** Adults residing in flood-prone Indian metropolitan or coastal districts (e.g. Chennai, Mumbai, Hyderabad, Kolkata).
- **Technical Literacy:** Non-expert citizens; familiar with basic smartphone web browsing, but without formal disaster-response or GIS training.
- **Status:** `PENDING LIVE PARTICIPANT COHORT` (Instrument designed and ready for live execution during hackathon jury evaluation).

### B. Standardized Testing Tasks

#### Task 1: Locating Real-Time Local Weather & Hazard Warnings
- **Prompt to Participant:** *"You hear that heavy rain is coming to your area. Use JATAYU to find out if there are active official government weather warnings for your locality, what the rainfall intensity is, and what the current flood risk score is."*
- **Success Criteria:**
  1. Participant successfully locates the search bar or allows browser geolocation.
  2. Participant correctly identifies whether an official IMD warning is active (Red, Orange, Yellow, or Green).
  3. Participant identifies the indicative flood risk tier.
- **Target Time on Task (ToT):** < 45 seconds.

#### Task 2: Planning an Evacuation Route around Hazards
- **Prompt to Participant:** *"You need to travel from your home to an emergency hospital. Use the SafeRoute feature to find a route. Check if the proposed route crosses any flood-vulnerable areas, and open the route for navigation."*
- **Success Criteria:**
  1. Participant navigates to SafeRoute.
  2. Sets origin and destination.
  3. Reviews alternative route options and reads hazard intersection explanations.
  4. Clicks the Google Maps navigation handoff.
- **Target Time on Task (ToT):** < 90 seconds.

#### Task 3: Finding Nearby Relief Centers & Vacancy Verification
- **Prompt to Participant:** *"Find the nearest emergency evacuation center or relief shelter to your location. Check if you can immediately go there or what you need to do first."*
- **Success Criteria:**
  1. Locates the Facilities tab or nearby facilities list.
  2. Identifies nearest facility address and contact telephone number.
  3. **Critical Integrity Check:** Participant correctly understands that bed availability is `UNKNOWN` and that calling the municipal helpline (1913/112) is mandatory before traveling.
- **Target Time on Task (ToT):** < 60 seconds.

---

## 3. Usability Evaluation Metrics & Rubric

### A. Core Usability Metrics
1. **Task Completion Rate (TCR):**
   - Unassisted Success: 100%
   - Assisted Success: 50%
   - Failure: 0%
   - *Target Cohort TCR:* >= 85%
2. **System Usability Scale (SUS):**
   - Standard 10-item Likert scale questionnaire administered immediately post-session.
   - *Target SUS Score:* >= 75 (Grade A / Excellent usability for public-safety tools).
3. **Safety Integrity Comprehension (SIC):**
   - 100% of participants must correctly identify that shelter vacancies must be confirmed by phone before dispatch.
   - 0% confusion between indicative mathematical risk models and mandatory civil evacuation orders.

### B. Live Session Tracking Form (Ready for Jury / Tester Execution)

| Participant ID | Target City | Task 1 (TCR / Time) | Task 2 (TCR / Time) | Task 3 (TCR / Time) | SUS Score (0–100) | Notes & Observations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **P-01** | Chennai | `PENDING COHORT` | `PENDING COHORT` | `PENDING COHORT` | `PENDING` | Scheduled for jury walkthrough |
| **P-02** | Mumbai | `PENDING COHORT` | `PENDING COHORT` | `PENDING COHORT` | `PENDING` | Scheduled for jury walkthrough |
| **P-03** | Hyderabad | `PENDING COHORT` | `PENDING COHORT` | `PENDING COHORT` | `PENDING` | Scheduled for jury walkthrough |
| **P-04** | Kolkata | `PENDING COHORT` | `PENDING COHORT` | `PENDING COHORT` | `PENDING` | Scheduled for jury walkthrough |
| **P-05** | Delhi | `PENDING COHORT` | `PENDING COHORT` | `PENDING COHORT` | `PENDING` | Scheduled for jury walkthrough |
