# JATAYU — Phase 3H Security, Resilience & External-Service Audit Report

**Platform:** JATAYU — AI-Powered Disaster Intelligence and Response Platform  
**Hackathon:** CipherCop 2026 — AI Disaster Response Track  
**Date of Audit:** October 27, 2026  
**Scope:** Application Security, Coordinate Boundaries, Rate Limiting, RBAC, External Resilience, Dependency Vulnerability Analysis

---

## 1. Executive Summary

This report delivers the verification and hardening outcomes for Phase 3H-B of JATAYU. All external provider dependencies (Open-Meteo, IMD RSS, OSRM, Overpass, Nominatim, OpenRouter) were evaluated for failure containment, timeout enforcement, rate limiting, and defensive fallback behavior.

Key achievements:
1. **Defensive Security Headers:** Standardized `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, and `Referrer-Policy: strict-origin-when-cross-origin` on all API responses.
2. **Strict Coordinate & Query Boundary Validation:** Verified and enforced geographic latitude `[-90, 90]`, longitude `[-180, 180]`, search query length (`<= 250` chars), and search radius (`1` to `100,000` meters) across `/api/weather`, `/api/risk`, `/api/route/facilities`, and `/api/route/plan` with HTTP 400 rejection and explicit error codes (`INVALID_COORDINATES`, `INVALID_RADIUS`, `QUERY_TOO_LONG`).
3. **Application Rate Limiting:** Implemented sliding-window in-memory rate limiting with client IP tracking, returning HTTP 429 and standard `Retry-After` headers for general API access (180 req/min), authentication login attempts (30 req/min), and heavy compute endpoints (60 req/min).
4. **Resilient Weather Caching & Degraded Fallback:** Added in-memory coordinate-keyed caching (10-minute TTL) with degraded fallback in `WeatherService`. When Open-Meteo times out or fails upstream, stale cached observations are returned with `isStale: true` and clear attribution notation rather than cascading 500 crashes.
5. **Vulnerability Mitigation:** Successfully resolved high and moderate vulnerabilities (`body-parser`, `postcss-selector-parser`) via `npm audit fix`. Evaluated remaining development advisories with formal risk assessments.

---

## 2. Dependency Vulnerability Analysis (`npm audit`)

### A. Resolved Vulnerabilities
| Package | Previous Version | Severity | Advisory | Resolution |
| :--- | :--- | :--- | :--- | :--- |
| `body-parser` | `<1.20.9` | **High** | GHSA-27r3-jxmh-p828 (DoS via trailing bytes after compressed request body) | **Resolved:** Updated to patched release via `npm audit fix`. |
| `postcss-selector-parser` | `<6.1.5` | **Moderate** | GHSA-rj75-hqrm-r3gf (Quadratic CPU exhaustion on complex flat selector strings) | **Resolved:** Updated to patched release via `npm audit fix`. |

### B. Evaluated & Accepted Remaining Risks (Development / Sandboxed)
1. **`maplibre-gl` (<=6.4.0) — GHSA-jrc7-96c5-q579 (DOM.sanitize live NodeList bypass):**
   - *Risk Assessment:* The advisory targets DOM-based XSS when untrusted user HTML strings are rendered into default MapLibre GL popups using `maplibregl.Popup({ html })`.
   - *JATAYU Architecture:* JATAYU uses React virtual DOM components and SVG icons for all map annotations, incident markers, and overlays. No raw unescaped user-generated HTML strings are passed into MapLibre popup elements. Upgrading to major 6.16.x is a breaking change for custom shader layers; the vulnerability is mitigated at the UI layer by strict React JSX escaping.
2. **`tinypool` (<=2.1.1) / `@vitest/mocker` (<=4.1.11) — GHSA-5gmw-xhrv-c9v3:**
   - *Risk Assessment:* Prototype pollution gadget in test worker execution options within Vitest development dependencies.
   - *JATAYU Architecture:* Vitest is strictly a devDependency used for local and CI automated testing. It is never included in the production Docker image or runtime container (`NODE_ENV=production`).

---

## 3. External Service Timeout & Circuit-Breaking Matrix

| External Service | Endpoint / Function | Enforced Timeout | Failure Behavior | Degraded State Indication |
| :--- | :--- | :--- | :--- | :--- |
| **Open-Meteo NWP** | `/forecast` (Current observation) | 10,000 ms (`AbortSignal`) | Fall back to in-memory cached telemetry | `isStale: true`, provenance note `[STALE CACHED]` |
| **Open-Meteo Forecast** | `/forecast` (72h accumulation & soil) | 12,000 ms (`AbortSignal`) | Fall back to cached forecast | `isStale: true` on current observation |
| **IMD Nowcast RSS** | IMD Regional XML Bulletin | 8,000 ms (`AbortController`) | Fall back to valid cache (<10m) or expired cache | `feedStatus: 'UPSTREAM_FALLBACK'`, `isStaleCache: true` |
| **OSRM Routing** | `/route/v1/{profile}` | 8,000 ms (`AbortController` + Node `http.get`) | Throw `RoutingServiceError` (408/502) | Transparent UI notice: route calculation unavailable |
| **OpenStreetMap Nominatim** | `/search` & `/reverse` | 5,500 ms (search), 3,500 ms (reverse) | Fall back to offline municipal district gazetteer | Gazetteered landmarks resolved offline; zero crash |
| **Overpass API** | `[out:json]` facility query | 4,500 ms (`AbortController`) | Fall back to pre-verified municipal facility database | Source provenance: `PRE_VERIFIED_OFFICIAL_REGISTRY` |
| **OpenRouter AI Gateway** | `/chat/completions` | 20,000 ms (`AbortSignal`) | Fall back to deterministic rule-based grounded SITREP | `configured: false`, deterministic structured response |

---

## 4. Input Validation & Defenses

1. **Geographic Coordinates:**
   - Evaluated by `parseCoordinates` in `weather.route.ts`, `validateCoordinates` in `weather.service.ts`, `routeRouter.get('/facilities')`, and `planSafeRoute` in `route.service.ts`.
   - Latitudes strictly between `-90.0` and `+90.0`.
   - Longitudes strictly between `-180.0` and `+180.0`.
   - Out-of-bounds parameters consistently return `HTTP 400 Bad Request` with code `INVALID_COORDINATES`.
2. **Search Queries & Distances:**
   - Geocoding queries capped at 250 characters (`QUERY_TOO_LONG`).
   - Facility search radius capped at 100 km (`INVALID_RADIUS`).
   - Route origin and destination cannot be identical (<10m separation triggers `IDENTICAL_POINTS`).
3. **Payload Sanitization & Resource Limiting:**
   - Express JSON body parser strictly capped at `100kb`.
   - AI chat history strictly capped at 25 messages, with max 4,000 characters per message (`MESSAGE_LIMIT_EXCEEDED`, `CONTENT_TOO_LARGE`).
   - Authentication brute-force lockout: 5 consecutive failed attempts trigger a 15-minute lockout (`HTTP 429`).

---

## 5. Security Test Suite Results

Test suite: `backend/src/tests/security.test.ts`
- **Tests Executed:** 8 passing tests
- **Duration:** 88 ms
- **Coverage Areas:**
  - Standard HTTP defensive security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`).
  - Out-of-bounds coordinate rejections on facilities endpoint.
  - Negative and excessive radius rejections.
  - Query string length caps on geocoding.
  - Coordinate range enforcement on route planning.
  - Rate limiting threshold enforcement with `Retry-After` header.
  - Weather service degraded stale cache recovery.
