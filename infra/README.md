# Infra / Docker Compose

Dieses Verzeichnis enthaelt den Docker-Compose-Stack fuer den TvWallauShop.

## Setup

```bash
cp infra/.env.example infra/.env
cp infra/backend.env.example infra/backend.env
```

Befuelle anschließend die Werte in `infra/.env` und `infra/backend.env`.
Beim Aufruf von `npm run infra:up` oder `npm run stack:init` werden die
leeren `.env`-Dateien automatisch aus den Example-Dateien erzeugt,
falls sie noch nicht existieren.

## Start/Stop

```bash
npm run docker:build
npm run stack:up
npm run stack:down
```

Weitere hilfreiche Kommandos:

```bash
npm run infra:logs
```

Einmaliges DB-Init (Migration + Seeds):

```bash
npm run stack:init
```

## Ports

Die Ports werden in `infra/.env` gesetzt:

- `BACKEND_PORT` → Backend (Container-Port 3000)
- `PYTHON_PORT` → Python AI Service (Container-Port 8000)
- `FRONTEND_PORT` → Frontend (Container-Port 80)

## MariaDB Environment Keys

In `infra/.env` werden folgende Keys erwartet:

- `MARIADB_DATABASE`
- `MARIADB_USER`
- `MARIADB_PASSWORD`
- `MARIADB_ROOT_PASSWORD`

## Init vs. Normal Start

- **Init (einmalig):** `npm run stack:init` startet das `db-init` Profil und
  fuehrt Migration + Seeds aus.
- **Normal:** `npm run stack:up` startet den Stack, das Backend fuehrt nur
  Migrationen beim Start aus (keine Seeds).

## Services & Volumes

- `mariadb` nutzt ein benanntes Volume `mariadb_data`.
- `backend` erwartet `DB_HOST=mariadb` und `AI_PY_SERVICE_URL=http://python-ai-service:8000`.
- `db-init` laeuft nur mit `--profile init` und fuehrt Migration + Seeds aus.

## Troubleshooting

```bash
docker compose ps
docker compose logs -f --tail=200
```
