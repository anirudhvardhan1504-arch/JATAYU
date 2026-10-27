# Contributing to JATAYU

Thank you for contributing to JATAYU (AI-Powered Disaster Intelligence & Response Platform).

This project is built for life-critical disaster situations. Our codebase enforces strict data provenance, role-based access control (RBAC), and scientific integrity invariants. All contributors must adhere to the workflows, engineering standards, and safety principles documented below.

---

## 1. Non-Negotiable Safety Invariants

Before writing or modifying any code, familiarize yourself with JATAYU's four core data integrity invariants. **Any pull request that violates these invariants will be rejected.**

1. **Shelter Availability May Remain `UNKNOWN`:**
   Relief shelters and municipal centers must permanently maintain `currentAvailability: "UNKNOWN"` unless real-time telemetry from official municipal dispatch is confirmed. Never fabricate bed counts or assume vacancy. The UI and AI assistant must always direct citizens to call emergency helplines (`112`, `1913`, `1916`) before traveling.
2. **Experimental SFINCS Results Are Quarantined:**
   High-resolution 2D hydrodynamic simulation vectors (Adyar Basin) are computational research models strictly tagged as `EXPERIMENTAL_UNVALIDATED`. They must remain behind server-enforced RBAC gates (`RESEARCHER`, `GOVERNMENT`, `ADMIN`) and must never be represented as official civilian evacuation guidance.
3. **Official Alerts Must Be Segregated from Heuristic Screening:**
   Official bulletins from government meteorological authorities (IMD, NOAA, Civil Defense) must always be tagged as `OFFICIAL_FORECAST` or official alerts. Pre-validation runoff algorithms (SCS-CN) and rainfall risk scores must be explicitly tagged as `INDICATIVE_MODEL`.
4. **Historical Replay Must Never Be Represented as Live Conditions:**
   The offline disaster scenario replay engine (Chennai Michaung Dec 2023, Hyderabad Musi Oct 2020, Mumbai Monsoon July 2023) operates exclusively with recorded fixtures. Replay mode must always render the persistent amber banner: `DEMO REPLAY — RECORDED HISTORICAL DISASTER DATA — NOT LIVE CONDITIONS`.

---

## 2. Branching & Contribution Workflow

All development is organized around short-lived feature branches targeting `master`.

### Branch Naming Conventions
- `feat/<topic>`: New features or capabilities (e.g., `feat/offline-tile-cache`, `feat/kannada-localization`)
- `fix/<topic>`: Bug fixes and defect resolutions (e.g., `fix/safroute-timeout`, `fix/cesium-dev-assets`)
- `docs/<topic>`: Documentation, runbooks, and submission reports (e.g., `docs/team-runbook`)

### Step-by-Step Workflow
1. **Sync with latest `master`:**
   ```bash
   git checkout master
   git pull origin master
   ```

2. **Create a feature branch:**
   ```bash
   git checkout -b feat/my-topic
   ```

3. **Make changes with strict scope:**
   - Maintain documentation integrity: do not remove existing docstrings or safety warnings.
   - Do not stage `.env` files, SQLite databases (`*.db`), credentials, or scratch files.

4. **Verify quality locally before opening a PR (all must pass):**
   ```bash
   # 1. Monorepo TypeScript typecheck
   npm run typecheck

   # 2. Monorepo production build & runtime asset check
   npm run build

   # 3. Monorepo Vitest test suite
   npm test
   ```

5. **Commit and push:**
   ```bash
   git commit -m "feat(module): concise descriptive message"
   git push -u origin feat/my-topic
   ```

6. **Open a Pull Request:**
   - Target branch: `master`
   - Complete the Pull Request template checklist (`.github/pull_request_template.md`).

---

## 3. Pull Request Review & CI Policy

- **Automated CI Validation:** Every pull request triggers the `.github/workflows/ci.yml` pipeline (Node 22, typecheck, build, asset verification, test suite, and Docker container build).
- **Merge Requirements:**
  - All CI steps must pass cleanly (0 type errors, 0 test failures).
  - Code review must verify that no safety invariants, credentials, or private keys have been compromised.
  - Linear history is preferred (use Squash and Merge or Rebase and Merge).

---

## 4. Security & Secret Handling

- **Never commit `.env` files or secrets:** API keys (OpenRouter), private keys, and session tokens must never be hardcoded or committed.
- **Local evaluator accounts:** The pre-configured local evaluation account (`qa_commander`) is strictly for local dev/testing on `localhost`/`127.0.0.1` and is disabled in production environments. Never add plaintext passwords to new documentation.
- If you suspect a secret has been exposed, immediately notify the project maintainers without publishing the key in issues or chat.
