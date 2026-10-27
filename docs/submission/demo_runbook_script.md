# JATAYU — 3–5 Minute Live Demonstration Runbook & Pitch Script

**Competition:** CipherCop 2026 — Disaster Response Platform Showcase  
**Presenter:** Lead Systems Architect & Tactical Operations Lead  
**Live Target:** `http://localhost:8080`  
**Target Duration:** Exactly 4 Minutes (3m 30s Pitch + 30s Q&A Transition)  

---

## Technical Setup Checklist (T-minus 60 Seconds)

1. Ensure Docker containers are healthy:
   ```bash
   docker ps
   # Verify: jatayu-web (Up, port 8080) and jatayu-backend (Up, port 5000)
   ```
2. Open Chrome / Edge browser to: `http://localhost:8080`
3. Have browser devtools or a terminal tab open for rapid telemetry interrogation if requested by judges.

---

## Timed Demo Script & Click Walkthrough

### 0:00 – 0:45 | The Problem & The JATAYU Mission
* **Visual on Screen:** Overview Dashboard (`http://localhost:8080`) showing real-time national alert status, weather radar feeds, and active operational sectors.
* **Speaker Script:**
  > "Distinguished judges, when extreme deluges hit densely populated urban basins—like Chennai in 2015—first responders face a fatal paradox. 
  > 
  > On one hand, meteorological telemetry is fragmented: warnings arrive at a coarse district level, with zero street-level hydrodynamic consequence mapping. 
  > On the other hand, raw physics simulations—like 2D hydraulic solvers—are computational heavyweights that are completely unvalidated without ground-truth riverbed soundings. Publishing uncalibrated numerical outputs to the public triggers panic and chaotic evacuations.
  > 
  > Enter **JATAYU**: the first AI disaster response platform built on **Architectural Data-Trust Isolation**. We combine real-time observational intelligence with rigorous hydrodynamic research, but we cryptographically quarantine unvalidated predictions to protect civil defense integrity."

---

### 0:45 – 1:45 | Operational Coordination & Server-Enforced RBAC
* **Action 1:** Show Citizen View in Live Map (`http://localhost:8080/map`). Point to the live RainViewer radar overlay and the Indicative Flood Risk card.
* **Action 2:** Point out the **Hydrodynamic Simulation Card**: it is **LOCKED** with an explicit notice: *`ROLE ACCESS QUARANTINE: Restricted to RESEARCHER, GOVERNMENT, and ADMIN.`*
* **Speaker Script:**
  > "Right now, we are in the Public Citizen view. Citizens get trusted ground-truth telemetry: verified IMD feeds, live Doppler radar composites, and an indicative hazard screening score. 
  > 
  > Notice something crucial here: raw 2D numerical hydrodynamic contours are **quarantined at the API gateway**. If a citizen's client queries the simulation endpoint, the backend returns an immediate HTTP 403 Forbidden. There is zero risk of an unvalidated simulation triggering public panic.
  > 
  > Now let's elevate to the Command level. Logging in with Government credentials unlocks administrative interrogation. The coordinator can pinpoint census-grade district boundaries and dispatch multi-agency disaster drills—like this synthetic cyclonic deluge scenario—generating instant SITREP payloads without ever contaminating official public warning feeds."

---

### 1:45 – 3:00 | The Hydrodynamic Research Pipeline & Data-Trust Badge
* **Action 1:** Log in or switch to the **RESEARCHER** view (`qa_commander`).
* **Action 2:** In the Live Map (`http://localhost:8080/map`), toggle **Adyar Corridor Hydraulic Simulation (S2 Baseline)** to `ACTIVE`.
* **Action 3:** Click **FOCUS ADYAR CORRIDOR**. The map zooms into the 28.01 km reach from Thiruneermalai past Saidapet to the Bay of Bengal ocean mouth.
* **Action 4:** Highlight the flashing amber banner at the top of the map:  
  `⚠️ EXPERIMENTAL SIMULATION — NOT VALIDATED FOR OFFICIAL CIVIL DEFENSE`
* **Action 5:** Click on a red polygon over the Saidapet choke point. Show the MapLibre popup showing Depth Band, Stage Height, and 100% Subgrid Carving status.
* **Speaker Script:**
  > "Now, watch what happens when we authenticate as a Researcher. 
  > 
  > We toggle on the Adyar Corridor Hydraulic Simulation. In one click, we focus on the complete 28-kilometer reach. 
  > Notice the prominent amber badge that instantly locks onto the screen: *'EXPERIMENTAL SIMULATION — NOT VALIDATED FOR OFFICIAL CIVIL DEFENSE'*. This trust badge is immutable—it is signed into the API response headers and hardcoded into the visualization contract.
  > 
  > Behind this visualization is Deltares SFINCS running across 199,287 cells at 30-meter resolution, backed by 397,000 subgrid cross-sections that carve continuous channel bathymetry through every bridge culvert.
  > 
  > When I click this inundation polygon at Saidapet, the inspector reveals exact water depth bands—shallow ponding in yellow, moderate vehicular hazard in orange, and critical structural threats over 1.5 meters in red. 
  > In our sensitivity experiments, we proved that encroached riverbanks (Scenario S1) amplify peak flood stage by 2.27 meters compared to our S2 baseline, while engineered channel restoration (Scenario S3) reduces flooded urban land by 31%."

---

### 3:00 – 3:30 | Known Limitations & Scientific Rigor
* **Visual on Screen:** Slide or overview of the **Data Trust Taxonomy** from the Technical Evidence Pack.
* **Speaker Script:**
  > "Judges, the true hallmark of an engineering system is knowing the boundaries of your models. 
  > 
  > Why is this classified as `EXPERIMENTAL_UNVALIDATED`? Two reasons:
  > First, the historical UNOSAT satellite radar footprint was captured on December 3rd—48 hours after the peak December 1st deluge when waters were already receding. Validating a peak dynamic surge against a receding footprint introduces severe temporal mismatch.
  > Second, global satellite DEMs see the dry surface, not below-water river bathymetry. While our HydroMT subgrid algorithm carves mathematical channel cross-sections, it requires in-situ ADCP acoustic soundings before it can ever be used for life-critical evacuation directives. 
  > 
  > We do not sell false precision. We provide defensible, auditable intelligence."

---

### 3:30 – 4:00 | Conclusion & Q&A Rapid Defense
* **Visual on Screen:** Terminal showing the automated verification suite passing 204/204 tests with zero regressions.
* **Speaker Script:**
  > "JATAYU is verified across 204 automated unit and integration tests, running live in Docker with sub-50ms API response times. 
  > 
  > It is fast. It is scientifically defensible. And above all, it is architecturally safe. 
  > Thank you, and we welcome your questions."

---

## Rapid Q&A Defense Guide for Judges

#### Q1: "Why use subgrid modeling instead of simply running a 5-meter grid across the entire city?"
> **Answer:**  
> A 5-meter grid across the $28\text{ km} \times 9\text{ km}$ corridor would require over 10 million computational cells, driving 2D shallow-water runtime to hours or days—useless during an evolving disaster. Deltares SFINCS subgrid formulation solves momentum fluxes across subgrid cell-face hypsometry tables at 30-meter resolution in under 3 minutes, preserving hydraulic conveyance through narrow river channels without killing runtime.

#### Q2: "How do you guarantee that a first responder or citizen won't see an unvalidated simulation and panic?"
> **Answer:**  
> Through server-enforced, dual-layer cryptographic RBAC. The simulation endpoint `GET /api/research/simulations/adyar-corridor-s2` checks role claims signed in memory-only JWTs. If the token role is `CITIZEN` or `RESPONDER`, the backend immediately drops the request with HTTP 403 Forbidden. The frontend client does not even receive the vector geometry, making unauthorized rendering physically impossible.

#### Q3: "What would it take to upgrade the data trust tier from `EXPERIMENTAL_UNVALIDATED` to `VALIDATED_PILOT`?"
> **Answer:**  
> Two concrete criteria:  
> 1. In-situ Acoustic Doppler Current Profiler (ADCP) bathymetric cross-sections collected along the 28 km reach by the Water Resources Department.  
> 2. Synchronized stage-gauge water level hydrographs at Kotturpuram and Saidapet during an active monsoon event to calibrate Manning's $n$ roughness parameters.

#### Q4: "How does the platform behave if external weather providers like IMD or Open-Meteo go offline?"
> **Answer:**  
> JATAYU implements a 6-state deterministic circuit breaker with stale-while-revalidate caching (tested in `src/tests/alert.test.ts`). If upstream gateways return 503 or timeout, JATAYU falls back gracefully to cached CAP alert payloads with an explicit `STALE_DATA_WARNING` banner, preventing command blackout.
