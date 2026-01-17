# TvWallauShop

Dieses Repository enthaelt die Services fuer den TvWallauShop (Backend, Frontend und den Python AI-Service).

## Schnellstart

### Voraussetzungen

- Node.js (empfohlen: aktuelle LTS)
- MariaDB
- Python 3 und uv (nur fuer den AI-Service)

### Hinweise zu Node-Abhaengigkeiten

- `package-lock.json` soll mit committed werden (fuer reproduzierbare Builds).
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

REFRESH_COOKIE_MAX_AGE_MS=1000 * 60 * 60 * 24 * 7

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

### Services starten (lokal)

```bash
# Alles starten
mvn -Pstart-all validate

# Status aller Services (inkl. PID)
mvn -Pstatus-all validate

# Alles stoppen (inkl. Zusammenfassung am Ende)
mvn -Pstop-all validate

# Alles bauen
mvn -Pbuild-all package

# Nur target/ Ordner bereinigen
mvn -Pclean clean
```

```bash
# Backend
cd backend
npm install
npm run dev
```

```bash
# Frontend
cd frontend
npm install
npm run dev
```

```bash
# Python AI Service
cd python_ai_service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

## Projektstruktur

- `backend/` - Node.js API
- `frontend/` - Frontend-Anwendung
- `python_ai_service/` - Python Microservice fuer KI-Produktinformationen
