TvWallauShop Frontend
=====================

Development commands
--------------------

Install dependencies from the repo root (npm workspaces) before running any commands:

- npm install (first-time setup / lockfile regeneration)
- npm ci (CI / reproducible installs)

Nx (workspace):

- Start: npx nx run frontend:serve
- Stop: npx nx run frontend:stop
- Status: npx nx run frontend:status
- Build: npx nx run frontend:build

Direct npm scripts:

- Start: npm run dev:start
- Stop: npm run dev:stop
- Status: npm run dev:status
- Build: npm run build

Behavior
--------

- The dev runner writes PID metadata to frontend/target/dev.pid and frontend/target/dev.meta.json.
- Logs are written to frontend/target/frontend.log and frontend/target/frontend.err.log.
- If a PID file exists and the process is still running, dev:start exits with code 1.
- Stop is idempotent and cleans up stale PID files.

Wait-on requirement
-------------------

The dev:start script runs dev:wait, which waits for both services before starting Vite:

- http://localhost:3000/health (backend)
- http://localhost:8000/health (python_ai_service)

Ensure the wait-on package is installed (devDependency) before running dev:start.

Troubleshooting
---------------

- Stale PID file: run npm run dev:stop or delete frontend/target/dev.pid if the process is gone.
- Port already in use: check which process is using the Vite port and stop it manually.
