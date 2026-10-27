# JATAYU — Phase 3I: Three-Minute Hackathon Demo Script

**Document Reference:** `docs/submission/phase_3i_three_minute_demo_script.md`  
**Track:** CipherCop 2026 — AI Disaster Response Track  
**Presentation Target Time:** Exactly 3 Minutes (180 Seconds)  
**Live URL:** `http://localhost:8080`  
**Demo Account (Researcher):** `researcher@jatayu.gov.in` / `ResearcherDemo2026!`

---

## Story Overview
A citizen checks local flood hazards during an impending cyclonic deluge, receives an un-hallucinated, grounded explanation from the AI assistant, evaluates a safe evacuation route that avoids submerged underpasses, finds nearby emergency shelters with honest uncertainty warnings, and sees how JATAYU functions even when mobile networks collapse.

---

## Detailed Minute-by-Minute Runbook

### Act 1: Public Landing & Grounded Situational Awareness (0:00 – 0:45)
- **Visual:** Open browser to `http://localhost:8080/`. The homepage displays clean, operational telemetry.
- **Action:**
  1. Click the locality search bar and type `Chennai Central`.
  2. Select `Chennai Central, Tamil Nadu` from the suggestion dropdown.
- **Spoken Narrative (Presenter):**
  > "Good morning, judges. When a severe cyclone strikes, citizens don't need panic or hallucinated advice — they need immediate, grounded, life-saving truth. This is **JATAYU**, an AI-powered disaster intelligence platform built for India.
  >
  > Notice what happened when we selected Chennai Central: within milliseconds, observed weather telemetry loaded directly from numerical weather prediction feeds. Most importantly, look at how we present risk: **Official IMD Warning Bulletins** are kept strictly separate from our internal indicative flood screening. We never disguise a model estimate as an official government order."

---

### Act 2: Grounded AI Assistant & Honest Uncertainty (0:45 – 1:30)
- **Visual:** Open the AI Assistant panel (floating drawer or `/chat`).
- **Action:**
  1. Click the quick prompt: *"What is happening near me and where should I go?"*
  2. Point your cursor to the 5 distinct sections of the response.
  3. (Optional 5s) Toggle language to **Tamil (தமிழ்)** or **Hindi (हिन्दी)** to show native script.
- **Spoken Narrative (Presenter):**
  > "Every LLM can write text, but in a disaster, an ungrounded hallucination can cost lives. JATAYU enforces a strict **5-part Life-Safety Contract**:
  >
  > 1. **What We Know:** Only verified meteorological observations from our retrieved context.
  > 2. **Source and Time:** Disclosing exact providers — Open-Meteo and IMD Nowcast.
  > 3. **What is Uncertain:** Crucially, JATAYU explicitly admits what it cannot know — street-level drain blockages and real-time shelter bed vacancies.
  > 4. **What to Do Next:** Actionable guidance — moving to higher ground, cutting power mains.
  > 5. **Where to Get Help:** Citing official helplines — National Emergency `112`, State Control `1070`, and Greater Chennai Corporation `1913`.
  >
  > Notice also that JATAYU speaks the citizen's mother tongue — generating fluent Tamil and Hindi in native script with localized helplines."

---

### Act 3: Hazard-Aware SafeRoute & Shelter Discovery (1:30 – 2:15)
- **Visual:** Click on the **SafeRoute** tab in the navigation bar (`/saferoute`).
- **Action:**
  1. Origin is `Chennai Central (13.0827, 80.2707)`. Enter Destination: `Guindy Industrial Estate (13.0067, 80.2026)`.
  2. Click **Calculate Safe Route**.
  3. Inspect the route options and the **Nearby Emergency Facilities** panel.
  4. Point to the **`UNKNOWN AVAILABILITY`** badge on Ripon Building relief camp.
  5. Click **Navigate in Google Maps**.
- **Spoken Narrative (Presenter):**
  > "Standard navigation apps optimize for the fastest road, often leading families straight into flooded subways. JATAYU's **SafeRoute Engine** evaluates roads against known flood vulnerability points.
  >
  > Here, it identifies hazard intersections along the primary corridor and offers an alternative route that avoids low-lying underpasses.
  >
  > Below, we discover verified emergency facilities. Notice this badge: **UNKNOWN AVAILABILITY**. Many systems fabricate vacancy numbers. In JATAYU, shelter vacancy is permanently flagged as UNKNOWN until verified by dispatch, directing citizens to call GCC dispatch on `1913` before traveling.
  >
  > And when ready to drive, one click hands off sanitized GPS coordinates to Google Maps for turn-by-turn navigation."

---

### Act 4: Offline Replay Resilience — Telecom Blackout (2:15 – 2:45)
- **Visual:** Point to the top banner and click **Launch Recorded Demo Replay**.
- **Action:**
  1. Select `Chennai Deluge (Cyclone Michaung Dec 2023)` from the scenario dropdown.
  2. Show the high-visibility warning banner.
- **Spoken Narrative (Presenter):**
  > "During extreme disasters, cell towers collapse and external APIs fail. What happens to JATAYU?
  >
  > We built **Offline Historical Scenario Replay**. With external network access severed, the platform loads pre-recorded disaster scenarios instantly from bundled fixtures.
  >
  > Notice this prominent amber warning banner across the screen: `DEMO REPLAY — RECORDED HISTORICAL DISASTER DATA — NOT LIVE CONDITIONS`. Evaluators and field teams get a 100% resilient offline drill environment without ever mistaking recorded data for a live event."

---

### Act 5: Earth Observatory & Researcher RBAC (2:45 – 3:00)
- **Visual:** Click on the **Research** tab.
- **Action:**
  1. Show 3D Cesium globe with historical ERA5 deluge layer.
  2. Click **Sign In** -> Enter `researcher@jatayu.gov.in` / `ResearcherDemo2026!`.
  3. Show the Adyar SFINCS hydrodynamic simulation layer with its experimental watermark.
- **Spoken Narrative (Presenter):**
  > "Finally, for climate scientists, our **Earth Observatory** combines 3D terrain with ECMWF ERA5 reanalysis and RainViewer radar.
  >
  > Experimental scientific models like our Adyar SFINCS hydrodynamic simulation are strictly role-gated. Unauthenticated civilians cannot access them, and researchers see an explicit watermark: `EXPERIMENTAL_UNVALIDATED — NOT CIVIL DEFENSE ORDER`.
  >
  > JATAYU delivers grounded intelligence, honest uncertainty, and resilient actionability when every second counts. Thank you."

---

## Presenter Contingency Cheat-Sheet

| What Could Go Wrong | Presenter Recovery Action |
| :--- | :--- |
| **Open-Meteo or IMD API is slow / unreachable** | "Notice that JATAYU gracefully falls back to our cached observation with a clear Stale Telemetry notice, preventing user confusion." |
| **OSRM routing provider times out** | "Our fallback geocoding resolves municipal landmarks offline and provides emergency facility telephone directories immediately." |
| **Cesium 3D Globe WebGL error on presentation laptop** | "Our built-in error boundary catches 3D rendering failures and keeps the 2D Tactical Map completely interactive." |
| **Questions on AI Hallucination** | "Our Grounded AI service uses a deterministic retrieval pipeline with a strict 5-part contract — tested across 310 automated unit and integration tests." |
