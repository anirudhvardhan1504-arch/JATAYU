# JATAYU — Three-Minute Hackathon Demo Runbook (Judge Presentation Script)

**Hackathon:** CipherCop 2026 — AI Disaster Response Track  
**Platform:** JATAYU — AI-Powered Disaster Intelligence and Response Platform  
**Target Duration:** Exactly 3 Minutes (180 Seconds)  
**URL:** `http://localhost:8080` | **Backend:** `http://localhost:5000`

---

## Pre-Demo Checklist (60 Seconds Before Pitch)
- [ ] Frontend running on `http://localhost:8080` (or `http://127.0.0.1:8080`).
- [ ] Backend running on `http://localhost:5000` (`curl http://localhost:5000/api/health` returns `200 OK`).
- [ ] Browser window sized to standard 1080p (or projector resolution).
- [ ] Demo researcher credentials ready: `researcher@jatayu.gov.in` / `ResearcherDemo2026!`.

---

## Minute 0:00 – 0:45: The Citizen Emergency Experience

**Action:** Open `http://localhost:8080` on the Home Page (`/`).

**Spoken Narrative:**
> *"Disasters strike fast, but in the first critical minutes, citizens are overwhelmed by conflicting reports, speculative rumors, and inaccessible technical data. JATAYU transforms this chaotic moment into clear, trustworthy intelligence.*
> *Right on the home page, any citizen can search their locality without sharing GPS coordinates. When I search 'Chennai Central', JATAYU instantly pulls real-time weather observations from Open-Meteo and official bulletins from the India Meteorological Department.*
> *Notice our core principle: Provenance Separation. Official IMD alerts are highlighted with government agency stamps, while our internal flood risk screening is clearly labeled as an indicative 0-to-100 model.*
> *Let's ask our Grounded AI Assistant: 'What is happening near me and where can I get help?' The assistant adheres to a strict 5-part contract: What We Know, Source and Time, What is Uncertain, What to Do Next, and Where to Get Help. Notice how every relief center lists verified addresses and phone numbers, but bed availability is strictly marked UNKNOWN, explicitly directing the citizen to call GCC helpline 1913 or 112 before moving."*

---

## Minute 0:45 – 1:45: SafeRoute & Evacuation Navigation

**Action:** Click the **SafeRoute** tab in the navigation bar. Select origin 'Chennai Central' and destination 'Chennai International Airport' (or 'Guindy'). Click **Calculate Safe Route**.

**Spoken Narrative:**
> *"When evacuation becomes necessary, standard navigation engines route cars into flooded river underpasses. JATAYU SafeRoute is hazard-aware.*
> *Our engine evaluates routes across multiple travel modes—driving, walking, and cycling. It cross-references route geometry against verified municipal flood vulnerability checkpoints.*
> *Here, Route Option 1 crosses the Adyar River corridor near Saidapet. JATAYU flags this with an elevated hazard warning, explaining why the sector is risky: high antecedent rainfall and low-lying topography.*
> *With one click, the citizen can click 'Open in Google Maps' to hand off the calculated waypoint coordinates directly to their phone's turn-by-turn navigation."*

---

## Minute 1:45 – 2:30: Climate Observatory & Scientific Quarantine

**Action:** Click the **Research** tab. Click **ERA5 Historical Deluge Analysis** (Dec 2015). Then click **Sign In** and enter `researcher@jatayu.gov.in` / `ResearcherDemo2026!`. Open the **SFINCS Inundation Simulation**.

**Spoken Narrative:**
> *"Beyond immediate citizen relief, JATAYU serves climatologists and city planners through our Earth and Climate Research Observatory.*
> *Here we have historical ERA5 reanalysis data allowing researchers to replay the 2015 Chennai Deluge alongside live RainViewer radar. We clearly distinguish between past retrospective records and live nowcast radar.*
> *Now, I will log in using our verified Researcher credentials. Notice how new role-gated capabilities unlock: the Adyar SFINCS 2D hydrodynamic overland flow model.*
> *Notice the prominent banner: SFINCS is strictly classified as `EXPERIMENTAL_UNVALIDATED`. Because hydrodynamic models require empirical gauge calibration, our system quarantines this simulation exclusively to researchers—it is NEVER used to issue automated civilian evacuation mandates."*

---

## Minute 2:30 – 3:00: Offline Resilience & Demo Replay Mode

**Action:** Click **Launch Recorded Demo Replay** in the top banner. Select **Hyderabad Musi Cloudburst (Oct 2020)**.

**Spoken Narrative:**
> *"Finally, during real disaster relief, cellular towers collapse and external APIs fail. JATAYU is built with defensive circuit breaking and an offline Demo Replay Architecture.*
> *Notice our persistent top banner: DEMO REPLAY — RECORDED DATA, NOT LIVE. Even if the internet disconnects right now, JATAYU provides complete, versioned historical telemetry across Chennai, Hyderabad, and Mumbai.*
> *In the Hyderabad Musi scenario, 192mm of cloudburst rainfall, GHMC shelters, and risk metrics load entirely from deterministic offline fixtures in under 5 milliseconds.*
> *JATAYU is reproducible, resilient, mathematically grounded, and production-ready for CipherCop 2026. Thank you."*

---

## Judge Q&A Rapid-Response Cheat Sheet

1. **"What happens if Open-Meteo or IMD is down?"**
   - *Answer:* "JATAYU has in-memory coordinate-keyed caching with degraded fallback. If Open-Meteo is unreachable, stale cached data is returned with `isStale: true` and an explicit disclaimer. If completely uncontactable, our offline municipal gazetteers and demo replay mode ensure zero crashes."
2. **"Can your AI hallucinate that a shelter has 20 free beds?"**
   - *Answer:* "No. In JATAYU, shelter availability is hardcoded to `UNKNOWN` in both live and replay modes. Our Grounded AI service uses a strict retrieval layer that mandates calling official dispatch (112 / 1913) before transit."
3. **"Why isn't SFINCS shown to citizens?"**
   - *Answer:* "Hydrodynamic models require calibrated river gauge inflows and tidal storm surge inputs. Showing unvalidated simulation perimeters to civilians risks panic or directing people into unmodeled backwaters. We preserve strict scientific integrity by role-gating SFINCS to authenticated researchers."
