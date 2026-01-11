TvWallauShop AI Product Service
===============================

This is a separate Python microservice that receives price and image data
from the Node.js backend and returns name suggestions, description text, and
product tags.

Development commands
--------------------

Maven (module-scoped):

- Start: mvn -pl python_ai_service -Pdev-start validate
- Stop: mvn -pl python_ai_service -Pdev-stop validate
- Status: mvn -pl python_ai_service -Pdev-status validate
- Build: mvn -pl python_ai_service -Pdev-build package

Direct Python commands:

- Start: python scripts/service.py start
- Stop: python scripts/service.py stop
- Status: python scripts/service.py status
- Build: python scripts/service.py build

Behavior
--------

- The dev runner writes PID metadata to python_ai_service/target/dev.pid and
  python_ai_service/target/dev.meta.json.
- If a PID file exists and the process is still running, start exits with code 1.
- Stop is idempotent and cleans up stale PID files.

Requirements
------------

- Install uv and ensure it is on PATH, or install it in python_ai_service/.venv,
  or set UV_EXE to the uv executable.
- The service starts uvicorn with reload on http://localhost:8000.
- Health endpoint: GET /health returns 200 with {"status": "ok"}.

Troubleshooting
---------------

- Stale PID file: run python scripts/service.py stop or delete
  python_ai_service/target/dev.pid if the process is gone.
- Port already in use: check which process is using port 8000 and stop it manually.
