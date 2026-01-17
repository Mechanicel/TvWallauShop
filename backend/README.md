TvWallauShop Backend
====================

Development commands
--------------------

Nx (workspace):

- Start: npx nx run backend:serve
- Stop: npx nx run backend:stop
- Status: npx nx run backend:status
- Build: npx nx run backend:build

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

Troubleshooting
---------------

- Stale PID file: run npm run dev:stop or delete backend/target/dev.pid if the process is gone.
- Port already in use: check which process is using port 3000 and stop it manually.
