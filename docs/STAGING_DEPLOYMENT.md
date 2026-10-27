# JATAYU Platform — Staging Deployment Guide

This document describes the reproducible container deployment topology for the **JATAYU Disaster Intelligence Platform** in controlled staging environments.

---

## 1. Architecture Overview

The staging topology uses a unified, secure two-tier service architecture:

```
[Browser / Client]
       │
       ▼ (Port 8080)
┌────────────────────────────────────────────────────────┐
│                   jatayu-web (Nginx)                   │
│                                                        │
│  • Serves static Vite React frontend (/)               │
│  • Serves Cesium 3D on-demand assets (/cesium/)        │
│  • Enforces HTTP security headers & gzip compression   │
│  • Reverse-proxies /api/* to Express backend           │
└──────────────────────────┬─────────────────────────────┘
                           │ (Internal Docker Network)
                           ▼ (Port 5000)
┌────────────────────────────────────────────────────────┐
│                 jatayu-backend (Node 24)               │
│                                                        │
│  • Express HTTP REST APIs                              │
│  • Authentication, RBAC, and Token Services            │
│  • SQLite User & Session Store (DatabaseSync, WAL)     │
│  • Native Node.js Health Telemetry                     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ jatayu_db_data  │ (Named Persistent Volume)
                  │ (/data)         │
                  └─────────────────┘
```

### Key Architectural Properties
- **Single Public Port:** The backend port 5000 is never exposed to the host network; all traffic traverses Nginx on host port 8080.
- **Same-Origin Access:** Frontend assets and `/api/*` endpoints share the same host and port, preventing cross-origin browser issues.
- **Persistent SQLite Storage:** The user database and session revocation tables are mounted to a named Docker volume (`jatayu_db_data`), isolated from disposable container layers.
- **Non-Root Execution:** The backend container runs as unprivileged user `node` (UID 1000).

---

## 2. Prerequisites

- **Docker:** Engine version 24+ or Docker Desktop (Linux containers).
- **Docker Compose:** Compose v2 or v5+ (`docker compose`).
- **Ports:** Port 8080 available on the host machine (configurable via `PORT_HTTP`).

---

## 3. Configuration & Environment Setup

Copy `.env.staging.example` to `.env` in the repository root:

```bash
cp .env.staging.example .env
```

Ensure the following variables are defined in `.env`:

| Variable | Description | Requirement | Example |
| :--- | :--- | :---: | :--- |
| `PORT_HTTP` | Host port mapped to Nginx | Optional (Default: 8080) | `8080` |
| `NODE_ENV` | Application environment mode | Mandatory | `production` |
| `JWT_SECRET` | Cryptographic secret for signing tokens | Mandatory (min 32 chars) | `32+ character random string` |
| `CORS_ORIGIN` | Allowed browser origins for CORS | Mandatory in production | `http://localhost:8080` |
| `JWT_TTL_SECONDS` | Access token lifespan in seconds | Optional (Default: 900) | `900` |
| `PROVISIONING_KEY` | Admin account initial provisioning key | Optional | `32+ character random string` |

> **IMPORTANT:** Never commit the `.env` file to version control. It is explicitly ignored by `.gitignore` and `.dockerignore`.

---

## 4. Building and Starting the Stack

### Step 1: Validate Compose Configuration
```bash
docker compose config
```

### Step 2: Build the Container Images
Build both the backend runner and Nginx static frontend images:
```bash
docker compose build
```

### Step 3: Start the Stack in Detached Mode
```bash
docker compose up -d
```

### Step 4: Verify Container Health
Wait 10–15 seconds for startup probes to complete, then inspect service status:
```bash
docker compose ps
```
Both `jatayu-backend` and `jatayu-web` should display `Up (healthy)`.

---

## 5. Verifying Deployment & Routing

1. **Health Telemetry Endpoint:**
   ```bash
   curl -i http://localhost:8080/api/health
   ```
   *Expected Response:* `HTTP/200 OK` with JSON payload containing:
   ```json
   {
     "status": "ok",
     "platform": "JATAYU Disaster Intelligence Platform",
     "services": {
       "database": { "provider": "SQLite (node:sqlite)", "status": "ready" },
       "weather": { "provider": "Open-Meteo", "status": "ready" }
     }
   }
   ```

2. **Frontend Static HTML Delivery:**
   ```bash
   curl -i http://localhost:8080/
   ```
   *Expected Response:* `HTTP/200 OK` delivering the compiled `index.html` without static Cesium script references.

3. **On-Demand Cesium Asset Routing:**
   ```bash
   curl -I http://localhost:8080/cesium/Cesium.js
   ```
   *Expected Response:* `HTTP/200 OK` with `Content-Type: application/javascript` and immutable cache header.

4. **Privileged API Authorization Boundary:**
   ```bash
   curl -i http://localhost:8080/api/command/sectors
   ```
   *Expected Response:* `HTTP/401 Unauthorized` with structured JSON error `{ "code": "AUTH_REQUIRED" }`.

---

## 6. Verifying Database Persistence Across Restarts

To verify that user accounts, role versions, and revoked sessions survive container recreation:

1. Register or provision an account (or inspect database write).
2. Stop and remove the containers **without deleting the volume**:
   ```bash
   docker compose down
   ```
   > **CAUTION:** Never pass the `-v` flag (`docker compose down -v`), as this deletes persistent volumes.
3. Re-launch the containers:
   ```bash
   docker compose up -d
   ```
4. Verify the database re-attaches cleanly:
   ```bash
   curl http://localhost:8080/api/health
   ```
   The database status will report `"ready"`, and previously registered users remain authenticated.

---

## 7. Operational Management & Logs

### Inspecting Container Logs
Inspect service output safely without displaying secrets:
```bash
# View backend logs (sanitized server output)
docker compose logs -f backend

# View Nginx access & proxy logs
docker compose logs -f web
```

### Clean Shutdown
To cleanly stop the containers and drain in-flight requests:
```bash
docker compose stop
```

---

## 8. Backup and Restore Procedures

### Database Backup
Because SQLite is operating in WAL mode, take a consistent snapshot while the backend is running using SQLite's backup API:
```bash
docker compose exec backend node -e "
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('/data/jatayu_auth.db');
  db.exec('VACUUM INTO \"/data/jatayu_auth_backup.db\"');
  db.close();
  console.log('Consistent backup created at /data/jatayu_auth_backup.db');
"
```
Then copy the backup to the host:
```bash
docker cp jatayu-backend:/data/jatayu_auth_backup.db ./jatayu_backup_$(date +%Y%m%d).db
```

### Database Restore
To restore from a backup file:
```bash
docker compose stop backend
docker cp ./my_backup.db jatayu-backend:/data/jatayu_auth.db
docker compose start backend
```
