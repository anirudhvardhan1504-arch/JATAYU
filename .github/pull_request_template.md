## Description & Motivation
<!-- Concise explanation of what this PR introduces, fixes, or documents, and why it is needed. -->

## Changes Included
- 

## Verification Checklist

### Local Validation
- [ ] `npm run typecheck` passes with 0 errors across frontend and backend workspaces.
- [ ] `npm run build` succeeds (backend dist, asset copy, and frontend Vite bundle).
- [ ] `npm test` passes with 0 failures.
- [ ] Verified manually in the browser (if frontend changes are included).

### Safety Invariants Compliance
- [ ] **Shelter Availability:** No assumption of facility bed count or vacancy; `currentAvailability: "UNKNOWN"` is strictly preserved.
- [ ] **SFINCS Quarantine:** Hydrodynamic simulation outputs are gated behind role-based access control and labeled `EXPERIMENTAL_UNVALIDATED`.
- [ ] **Provenance Distinction:** Official government weather bulletins are clearly distinguished from indicative heuristic risk scores.
- [ ] **Historical Replay:** Any recorded replay mode remains clearly labeled with persistent visual indicators and is never presented as live conditions.

### Security & Privacy
- [ ] No real API keys, secrets, `.env` files, or private tokens are staged or committed.
- [ ] No SQLite database files (`*.db`), personal data, or scratch files are committed.
- [ ] Evaluator credentials are not exposed in plaintext or added to production configurations.

### Visual Evidence (Screenshots / Recordings)
<!-- Attach screenshots of the affected UI states, mobile viewports, or terminal test runs if applicable. -->
