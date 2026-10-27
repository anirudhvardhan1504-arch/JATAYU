# JATAYU — Phase 3H Scientific Integrity, Hydrodynamic Quarantine & Research Scope

**Platform:** JATAYU — AI-Powered Disaster Intelligence and Response Platform  
**Hackathon:** CipherCop 2026 — AI Disaster Response Track  
**Date:** October 27, 2026  
**Scope:** SFINCS Model Classification, Spatial Overlap Validation Methodology, Hydraulic Boundaries, Hyderabad Musi Basin Scope

---

## 1. Classification & Status: Adyar SFINCS Model

The 2D overland hydrodynamic inundation simulation for the Adyar River Basin in Chennai is classified within JATAYU as:
> **`EXPERIMENTAL_UNVALIDATED` — RESEARCH USE ONLY**

### Scientific & Life-Safety Rationale
Hydrodynamic simulation models (such as SFINCS — Super-Fast Inundation of CoastS) solve 2D shallow water equations to predict depth and flow velocities. However, real-time flood extent is governed by highly sensitive dynamic boundary conditions:
1. **Dynamic Reservoir Gate Discharges:** Inflow and emergency outflows from Chembarambakkam Reservoir into the Adyar River cannot be modeled solely from rainfall without direct sensor telemetry from the Public Works Department (PWD).
2. **Astronomical Tidal Lock & Storm Surge:** High tides restrict gravity discharge at the Adyar river mouth (Besant Nagar / Foreshore Estate), backing up floodwaters into upstream urban sectors (Saidapet, Kotturpuram, Jafferkhanpet).
3. **Micro-Topographic Drainage Obstructions:** Bridges, solid compound walls, and illegal encroachments create localized damming effects that generic Digital Elevation Models (DEMs) cannot resolve.

**Operational Rule:** Because unvalidated simulation perimeters may misrepresent true flood contours, JATAYU strictly quarantines SFINCS outputs behind authenticated researcher role gating (`researcher:view_inundation`). SFINCS contours are NEVER presented to civilian users as official evacuation orders.

---

## 2. Quantitative Validation & Backtesting Methodology

To graduate SFINCS simulation models from `EXPERIMENTAL_UNVALIDATED` to `VALIDATED_OPERATIONAL`, JATAYU defines a standardized spatial backtesting methodology comparing model predictions against satellite-derived ground truth.

### A. Spatial Overlap Metrics
The simulation raster extent ($M$) is evaluated against the satellite-derived flood mask ($O$) using binary confusion matrices:

$$\text{Critical Success Index (CSI / Threat Score)} = \frac{|M \cap O|}{|M \cup O|} = \frac{TP}{TP + FP + FN}$$

$$\text{Probability of Detection (POD / Hit Rate)} = \frac{TP}{TP + FN}$$

$$\text{False Alarm Ratio (FAR)} = \frac{FP}{TP + FP}$$

$$\text{Intersection over Union (IoU)} = \frac{\text{Area of Overlap}}{\text{Area of Union}}$$

### B. Empirical Ground-Truth Benchmark Sources
1. **Sentinel-1 SAR Ground Truth:** Copernicus Emergency Management Service (EMS) synthetic aperture radar flood footprints from December 2015 and December 2023. SAR penetrates cloud cover during active cyclones, providing precise water surface reflections.
2. **High-Resolution Optical Satellite Imagery:** PlanetScope (3m) and Sentinel-2 optical scenes captured immediately post-cyclone landfall.
3. **GCC Municipal Ground Submergence Logs:** 45 verified flood vulnerability inundation checkpoints recorded by Greater Chennai Corporation engineers across Zones 9, 10, and 13.

---

## 3. Hyderabad Musi River Catchment Data Boundaries

### A. Event Hydrology & Scope
The Hyderabad recorded replay scenario benchmarks the extreme cloudburst of October 13–14, 2020:
- **Recorded 24-Hour Accumulation:** 192 mm (peaking at 38 mm/h in central urban basins).
- **Primary Riverine Axis:** Musi River corridor from Osman Sagar and Himayat Sagar reservoirs through Old City, Chaderghat, Moosarambagh, and Nagole.
- **Topographic Bottleneck:** The granitic Deccan plateau creates steep runoff gradients into the narrow Musi channel. When reservoir gates were opened, low-level causeways (Moosarambagh) and bridge piers became completely submerged.

### B. Scientific Boundaries & Limitations
- **Boundary of Empirical Fit:** Historical precipitation and inundation points are verified within the Greater Hyderabad Municipal Corporation (GHMC) limits ($17.30^\circ\text{N} - 17.48^\circ\text{N}$, $78.35^\circ\text{E} - 78.58^\circ\text{E}$).
- **Hydrological Demarcation:** Outside this municipal envelope, flood risk scores represent regional Open-Meteo GFS/ECMWF numerical precipitation screening, not hydraulic channel routing.
- **Shelter Records:** All relief centers in the Hyderabad scenario represent pre-verified GHMC municipal relief facilities with strict `currentAvailability: "UNKNOWN"` designations.
