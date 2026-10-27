# JATAYU (AI-Powered Disaster Intelligence & Response Platform)

> **Tactical early warning, meteorological telemetry, indicative flood risk assessment, multilingual situational intelligence, and civil defense response orchestration.**

---

## 1. Overview & System Mission

JATAYU is an operational disaster intelligence platform built to synthesize real-time meteorological observations, international numerical forecasts (ECMWF IFS / GFS), indicative hydrology models, multilingual public communication, and AI-assisted emergency decision support.

### Operational Data Integrity Principles:
1. **Official Warnings**: Government agency bulletins (IMD, NOAA, Civil Defense) are strictly tagged as `OFFICIAL_FORECAST` or official alerts.
2. **Observed Telemetry**: Ground station and satellite/radar measurements are tagged as `OBSERVED`.
3. **Indicative Risk Estimates**: Rainfall-driven flood risk scoring is explicitly marked as `INDICATIVE_MODEL` (pre-validation heuristic).
4. **Drill / Simulation Exercises**: Synthetic emergency test runs are clearly flagged as `DEMO_DATA`.
5. **Research Hydrodynamic Simulations**: High-resolution 2D SFINCS flood models are strictly quarantined under `EXPERIMENTAL_UNVALIDATED` and server-enforced RBAC gates.
6. **Grounded AI Emergency Assistant**: Retrieval-grounded response layer adhering to a strict 5-part contract (*What We Know, Source and Time, What is Uncertain, What to Do Next, Where to Get Help*) with verified emergency helplines (112, 1070, 1077, 1913/1916, 108).
7. **Shelter Integrity Invariant**: All relief centers permanently maintain `currentAvailability: "UNKNOWN"`, with an explicit mandate directing citizens to call municipal dispatch before moving.
8. **Controlled Offline Demo Replay Mode**: Versioned recorded disaster fixtures (Chennai Michaung Dec 2023, Hyderabad Musi Oct 2020, Mumbai Monsoon July 2023) operating offline with a persistent UI warning banner.
9. **Multilingual Inclusivity**: Real-time localized operations across English (`en`), Tamil (`ta`), and Hindi (`hi`) with zero-latency deterministic emergency fallback.
10. **India-Wide SafeRoute & Hazard Navigation**: Multi-corridor route computation via OSRM across arbitrary Indian locations with IPv4 priority, transparent hazard intersection against active IMD alerts, rainfall intensity, and flood bottlenecks, 29 verified nationwide state EOCs and trauma hospitals, 3 picking modes (search, map click-to-pick with draggable markers, and GPS opt-in), and Google Maps navigation handoff.
11. **Earth & Climate Research Observatory**: Interactive Cesium 3D planetary globe with ESRI Satellite/Dark Canvas, CartoDB, and OSM basemaps, NASA GIBS MODIS Terra daily satellite cloud WMTS, real-time RainViewer Doppler radar, quarantined Adyar 28km hydrodynamic inundation model under Tier-3 RBAC, and Spatial Coordinate Inspector querying Copernicus ERA5 historical storm reanalysis with Markdown Research Brief export.

---

## 2. Monorepo Architecture

```
Jatayu/
├── .gitignore                   # Ignores environment secrets (.env), builds, and node_modules
├── .env.example                 # Root environment placeholder template
├── package.json                 # Monorepo orchestrator (npm workspaces + concurrently)
├── README.md                    # System documentation and operational runbook
│
├── backend/                     # Node.js + Express + TypeScript Server
│   ├── .env.example             # Backend environment template (secrets never committed)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── src/
│       ├── index.ts             # Service entry point (Port 5000)
│       ├── app.ts               # Express middleware & route composition
│       ├── config.ts            # Typed environment loader
│       ├── types/               # Strict domain contracts
│       │   ├── weather.types.ts # Telemetry and NWP models
│       │   ├── risk.types.ts    # Indicative flood risk metrics & disclaimers
│       │   ├── alert.types.ts   # Multi-tier alert schema
│       │   ├── ai.types.ts      # OpenRouter chat and status schemas
│       │   └── route.types.ts   # SafeRoute corridors, hazards & facility schemas
│       ├── services/
│       │   ├── weather.service.ts    # Open-Meteo REST consumer with fallback
│       │   ├── openrouter.service.ts # Server-side OpenRouter AI gateway
│       │   └── route.service.ts      # OSRM routing, hazard matcher & risk scorer
│       ├── routes/
│       │   ├── health.route.ts  # GET /api/health
│       │   ├── weather.route.ts # GET /api/weather/current & /forecast
│       │   ├── ai.route.ts      # GET /api/ai/status & POST /api/ai/chat
│       │   └── route.route.ts   # POST /api/route/plan, GET /api/route/facilities
│       └── tests/               # Backend API and integration tests (170 tests)
│
└── frontend/                    # React 18 + Vite + Tailwind CSS + MapLibre GL JS
    ├── index.html               # Tactical HTML host with MapLibre & Inter typography
    ├── package.json
    ├── vite.config.ts           # Vite bundler with /api reverse proxy
    ├── tailwind.config.js       # JATAYU Design System tokens
    ├── postcss.config.js
    └── src/
        ├── index.css            # Operational palette & typography
        ├── App.tsx              # Root operational coordinator
        ├── types/               # Frontend domain definitions
        ├── services/            # Typed backend API clients (weather, ai, route)
        ├── components/
        │   ├── common/          # Badge (with provenance), MetricCard, StatusIndicator
        │   ├── layout/          # AppShell, Sidebar, Topbar, OperationalStatusBar
        │   ├── map/             # TacticalMap (MapLibre GL JS container with HUD)
        │   └── route/           # SafeRouteMap, RouteComparisonCard, FacilityCard
        ├── pages/
        │   ├── OverviewPage.tsx      # Sector telemetry, 24h rain chart, map preview
        │   ├── LiveMapPage.tsx       # Full tactical geospatial viewport
        │   ├── SafeRoutePage.tsx     # Hazard-aware routing, facilities & Google Maps
        │   ├── RiskAssessmentPage.tsx# Indicative flood risk decomposition & disclaimers
        │   ├── AlertsPage.tsx        # Multi-agency alert triage & checklists
        │   ├── AIAssistantPage.tsx   # OpenRouter conversational commander
        │   └── PreparednessPage.tsx  # Civil defense SOP checklists & emergency directory
        └── test/                # Vitest & Testing Library UI tests (81 tests)
```

---

## 3. Design System & Visual Standards

JATAYU uses a human-designed, operational aesthetic built for continuous shift use:
- **Palette**: Warm White (`#FBFBF9`), Deep Navy (`#0A1128`, `#0F172A`), Restrained Slate (`#334155`, `#64748B`).
- **Alert Colors**: Crimson (`#DC2626`), Warning Amber (`#D97706`), Operational Emerald (`#16A34A`), Tactical Cyan (`#0284C7`).
- **Typography**: Inter for hierarchy, JetBrains Mono for coordinates, barometrics, and timestamps.
- **Strict Guardrails**: No glassmorphism blur, no neon glows, no excessive gradients.

---

## 4. Setup & Running Instructions

### Prerequisites
- Node.js `v20.0.0` or higher (`v24.x` verified)
- npm `v10.x` or higher (`v11.x` verified)

### Step 1: Install Dependencies
Run from repository root:
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `backend/.env`:
```bash
# Linux / macOS / Git Bash:
cp .env.example backend/.env

# Windows PowerShell:
Copy-Item .env.example backend/.env
```
*(Optional)* Add your OpenRouter API key inside `backend/.env`:
```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet:beta
```
> **Note**: An OpenRouter key is **NOT required** for scaffolding. If omitted, the platform gracefully informs the commander and runs with structured operational briefings.

### Step 3: Run Development Server
Start both backend and frontend concurrently from the repository root:
```bash
npm run dev
```
- **Frontend Console**: [http://localhost:3000](http://localhost:3000) (default Vite port) or [http://localhost:8080](http://localhost:8080)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Health Endpoint**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

### Step 4: Run Tests & Type Checks
```bash
# Type check both workspaces (TypeScript)
npm run typecheck

# Run test suites (Frontend + Backend)
npm test

# Production build (Frontend Vite bundle + Backend asset packaging)
npm run build
```

### Step 5: Demo Replay Mode (Offline Evaluation)
JATAYU includes a built-in **Controlled Demo Replay Mode** with versioned historical fixtures:
- Access via URL parameter: `http://localhost:3000/?demo=replay` (or `http://localhost:8080/?demo=replay`)
- Or click **Launch Recorded Demo Replay** in the top banner of the application.
- Choose between:
  - **Chennai Deluge:** Cyclone Michaung (Dec 2023)
  - **Hyderabad Musi Inundation:** Historic Cloudburst (Oct 2020)
  - **Mumbai Monsoon Surge:** Konkan Tidal Lock (July 2023)

### Step 6: Three-Minute Jury Presentation Runbook
For live competitive evaluation and hackathon juries, follow the minute-by-minute presentation script:
- [Three-Minute Demo Runbook](file:///C:/Users/Anirudh/OneDrive/Desktop/Jatayu/docs/submission/phase_3h_three_minute_demo_runbook.md)

### Step 7: Local Demo Evaluator Access (RBAC Verification)
To verify the role-gated research tier (Adyar SFINCS hydrodynamic model & 3D Earth Globe) in local development:
- Click **COMMAND SIGN IN** in the top navigation bar.
- On `localhost` or `127.0.0.1`, a pre-configured evaluation card is rendered in the login modal: click **⚡ Quick Fill Demo Researcher** to automatically populate credentials.
- Click **VERIFY IDENTITY** to authenticate and issue an in-memory JWT with the `RESEARCHER` role.
- *Security Guard:* This evaluation helper is rendered strictly on `localhost` / `127.0.0.1` and is disabled in production deployments.

### Step 8: Docker Container Stack (Production / Staging)
Launch the containerized staging environment:
```bash
docker compose up -d --build
```
- **Staging Web Console (Nginx Reverse Proxy)**: [http://localhost:8080](http://localhost:8080)
- **Backend API (Internal Port 5000 / Proxied via /api)**: [http://localhost:8080/api/health](http://localhost:8080/api/health)
- **Container Health Check**:
  ```bash
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  ```

### Step 9: Contributing & Team Collaboration
For branch naming conventions (`feat/`, `fix/`, `docs/`), PR review procedures, and safety compliance, consult the [Contributing Guide](file:///C:/Users/Anirudh/OneDrive/Desktop/Jatayu/CONTRIBUTING.md).

---

## 5. Security & Privacy Assurance
- OpenRouter API keys are **never bundled in frontend artifacts**.
- Requests to AI models are routed exclusively through the backend proxy (`/api/ai/chat`).
- Defensive HTTP security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`) are set on all responses.
- Application-level rate limiting (`Retry-After`) protects public endpoints against denial-of-service.
- Research 2D hydrodynamic simulation vectors (`/api/research/simulations/*`) require explicit `RESEARCHER`, `GOVERNMENT`, or `ADMIN` RBAC credentials and are quarantined as `EXPERIMENTAL_UNVALIDATED`.
- Shelter availability strictly enforces `UNKNOWN` status to prevent civilian hazard.
