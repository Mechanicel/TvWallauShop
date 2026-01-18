# TvWallauShop

Dieses Repository enthaelt die Services fuer den TvWallauShop (Backend, Frontend und den Python AI-Service).

## Schnellstart

### Voraussetzungen

- Node.js (empfohlen: aktuelle LTS)
- MariaDB
- Python 3 und uv (nur fuer den AI-Service)

### Hinweise zu Node-Abhaengigkeiten

- `package-lock.json` soll mit committed werden (fuer reproduzierbare Builds).
- Dieses Repo nutzt npm Workspaces. Abhaengigkeiten werden zentral im Repo-Root installiert.
- In CI wird `npm ci` genutzt, um Installationen aus dem Lockfile zu machen.

### Backend konfigurieren

Lege die Datei `backend/.env` an und uebernimm die folgenden Variablen:

```dotenv
# ------------------------------------------------------------------
# Environment Variables Example for Backend (backend/.env)
# ------------------------------------------------------------------
DEBUG_ERRORS=false
SECURITY_ERRORS=false
EMAIL_SEND=false
AI_PRODUCT_AI_USE_REAL_SERVICE=true

# Node environment: development, production, or test
NODE_ENV=development

# HTTP server port
PORT=3000

# ------------------------------------------------------------------
# Database Configuration (MariaDB)
# ------------------------------------------------------------------
# Hostname or IP of your MariaDB server
DB_HOST=localhost
# Port on which MariaDB is listening
DB_PORT=3306
# Username for connecting to MariaDB
DB_USER=
# Password for your DB user
DB_PASS=
# Name of the database to use
DB_NAME=tvwallau

# ------------------------------------------------------------------
# JWT Configuration
# ------------------------------------------------------------------
# Secret key for signing access tokens
JWT_SECRET=
# Secret key for signing refresh tokens
JWT_REFRESH_SECRET=
# Expiration time for access tokens (e.g. 15m, 1h)
ACCESS_TOKEN_EXPIRES_IN=1m
# Expiration time for refresh tokens (e.g. 7d, 30d)
REFRESH_TOKEN_EXPIRES_IN=7d

REFRESH_COOKIE_MAX_AGE_MS=604800000

# ------------------------------------------------------------------
# SMTP Configuration (Strato)
# ------------------------------------------------------------------
# SMTP host (e.g. smtp.strato.de)
SMTP_HOST=smtp.strato.de
# SMTP port (usually 587 for TLS)
SMTP_PORT=587
# SMTP username (often your full email address)
SMTP_USER=
# SMTP password
SMTP_PASS=


APP_URL=http://localhost:3000

AI_PY_SERVICE_URL=http://localhost:8000
AI_PY_TIMEOUT_MS=150000
```

### Monorepo Workflow (Nx)

```bash
# Abhaengigkeiten installieren (Root, Workspaces)
npm run install:all

# Reproduzierbare Installationen (z.B. CI)
npm run ci

# Generierte Artefakte entfernen (inkl. root node_modules, dist/build, caches, venvs)
npm run clear

# Optional: Abhaengigkeiten inkl. Root-Lockfile zuruecksetzen (danach neu installieren)
npm run deps:reset

# Build aller Projekte
npm run build

# Tests ausfuehren
npm run test

# Linting ausfuehren
npm run lint

# Dev-Services starten (parallel)
npm run dev

# Dev-Services stoppen (parallel)
npm run stop
```

```bash
# Einzelne Services gezielt starten
npx nx run backend:serve
npx nx run frontend:serve
npx nx run python-ai-service:serve
```

```bash
# Python AI Service Dependencies
npx nx run python-ai-service:install
```

Hinweise
--------

- Jeder Service verwaltet Start/Stop selbst ueber seine dev:start/dev:stop Scripts (PID/Meta-Dateien liegen in `target/`).
- Das contracts-Paket ist eine Library und hat keine Dev-Start/Stop Targets.
- `npm run clear` entfernt nur generierte Artefakte (inkl. root node_modules, dist/build, caches, venvs), laesst aber Lockfiles unangetastet.
- `npm run deps:reset` entfernt zusaetzlich das Root-Lockfile (package-lock.json). Danach muessen Dependencies neu installiert werden.
- Uebrig bleibende node.exe Prozesse von IntelliJ (prettier/js-language-service) sind normal und nicht Teil des Stack.

## Docker Stack (infra/)

Erstes Setup (einmalig, mit Seeds):

```bash
# 1) infra/.env und infra/backend.env ausfuellen (werden bei infra:up/stack:init automatisch erzeugt)
# 2) Images bauen + DB initialisieren (migrate + seed)
npm run stack:init
```

Normaler Start (nur Migration beim Backend-Start):

```bash
npm run stack:up
npm run stack:down
```

Logs:

```bash
npm run infra:logs
```

Hinweise:

- Lokal ohne Docker nutzt das Backend typischerweise `DB_HOST=localhost` und `AI_PY_SERVICE_URL=http://localhost:8000`.
- Im Docker-Stack wird `DB_HOST=mariadb` und `AI_PY_SERVICE_URL=http://python-ai-service:8000` gesetzt.

## Projektstruktur

- `backend/` - Node.js API (Nx: backend)
- `frontend/` - Frontend-Anwendung (Nx: frontend)
- `contracts/` - Shared TypeScript contracts (Nx: contracts)
- `python_ai_service/` - Python Microservice fuer KI-Produktinformationen (Nx: python-ai-service)
