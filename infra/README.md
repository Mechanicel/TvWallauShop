# Infra / Docker Compose

Dieses Verzeichnis enthaelt den Docker-Compose-Stack fuer den TvWallauShop.

## Setup

```bash
cp infra/.env.example infra/.env
cp infra/backend.env.example infra/backend.env
```

Befuelle anschließend die Werte in `infra/.env` und `infra/backend.env`.

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

## Ports

Die Ports werden in `infra/.env` gesetzt:

- `BACKEND_PORT` → Backend (Container-Port 3000)
- `PYTHON_PORT` → Python AI Service (Container-Port 8000)
- `FRONTEND_PORT` → Frontend (Container-Port 80)

## Services & Volumes

- `mariadb` nutzt ein benanntes Volume `mariadb_data`.
- `backend` erwartet `DB_HOST=mariadb` und `AI_PY_SERVICE_URL=http://python-ai-service:8000`.

## Troubleshooting

```bash
docker compose ps
docker compose logs -f --tail=200
```
