TvWallauShop Backend
====================

Development commands
--------------------

Install dependencies from the repo root (npm workspaces) before running any commands:

- npm install (first-time setup / lockfile regeneration)
- npm ci (CI / reproducible installs)

Nx (workspace):

- Start: npx nx run backend:serve
- Stop: npx nx run backend:stop
- Status: npx nx run backend:status
- Build: npx nx run backend:build
- Clear generated artifacts: npx nx run backend:clear
- Reset dependencies (removes lockfile): npx nx run backend:deps:reset

Direct npm scripts:

- Start: npm run dev:start
- Stop: npm run dev:stop
- Status: npm run dev:status
- Build: npm run build

Behavior
--------

- The dev runner writes PID metadata to backend/target/dev.pid and backend/target/dev.meta.json.
- Logs are written to backend/target/backend.log and backend/target/backend.err.log.
- If a PID file exists and the process is still running, dev:start exits with code 1.
- Stop is idempotent and cleans up stale PID files.
- The clear target removes generated artifacts (node_modules, dist/build, caches, target) but keeps package-lock.json.
- The deps:reset target also removes package-lock.json; rerun npm install/npm ci afterward.

Troubleshooting
---------------

- Stale PID file: run npm run dev:stop or delete backend/target/dev.pid if the process is gone.
- Port already in use: check which process is using port 3000 and stop it manually.
