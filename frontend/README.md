TvWallauShop Frontend
=====================

Development commands
--------------------

Maven (module-scoped):

- Start: mvn -pl frontend -Pdev-start validate
- Stop: mvn -pl frontend -Pdev-stop validate
- Status: mvn -pl frontend -Pdev-status validate
- Build: mvn -pl frontend -Pdev-build package

Direct npm scripts:

- Start: npm run dev:start
- Stop: npm run dev:stop
- Status: npm run dev:status
- Build: npm run build

Behavior
--------

- The dev runner writes PID metadata to frontend/target/dev.pid and frontend/target/dev.meta.json.
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
