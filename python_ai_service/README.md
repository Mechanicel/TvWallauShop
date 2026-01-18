TvWallauShop AI Product Service
===============================

This is a separate Python microservice that receives price and image data
from the Node.js backend and returns name suggestions, description text, and
product tags.

Development commands
--------------------

Nx (workspace):

- Start: npx nx run python-ai-service:serve
- Stop: npx nx run python-ai-service:stop
- Status: npx nx run python-ai-service:status
- Build: npx nx run python-ai-service:build
- Test: npx nx run python-ai-service:test
- Clear generated artifacts: npx nx run python-ai-service:clear
- Reset dependencies (removes lockfile): npx nx run python-ai-service:deps:reset

Direct Python commands:

- Start: python scripts/service.py start
- Stop: python scripts/service.py stop
- Status: python scripts/service.py status
- Build: python scripts/service.py build
- Test: python scripts/service.py test

Behavior
--------

- The dev runner writes PID metadata to python_ai_service/target/dev.pid and
  python_ai_service/target/dev.meta.json.
- If a PID file exists and the process is still running, start exits with code 1.
- Stop is idempotent and cleans up stale PID files.
- The clear target removes generated artifacts (venv, caches, dist/build, target) but keeps uv.lock/poetry.lock.
- The deps:reset target also removes uv.lock/poetry.lock; rerun uv sync/poetry install afterward.

Requirements
------------

- Install uv and ensure it is on PATH, or install it in python_ai_service/.venv,
  or set UV_EXE to the uv executable.
- Install dependencies: uv sync (or run `npx nx run python-ai-service:install`).
- The service starts uvicorn with reload on http://localhost:8000.
- Health endpoint: GET /health returns 200 with {"status": "ok"}.
- OpenVINO GPU/NPU is required; there is no CPU fallback.

Model setup
-----------

The AI pipeline expects pre-converted OpenVINO models in the filesystem:

```
models/
  clip/
    image_encoder.xml
    image_encoder.bin
    text_encoder.xml
    text_encoder.bin
    tokenizer.json
  caption/
    model.xml
    model.bin
    tokenizer.json
  llm/
    openvino_model.xml
    openvino_model.bin
    tokenizer.json
    config.json
```

Environment variables:

- `AI_DEVICE` (default: `openvino:GPU`, allowed: `openvino:GPU` or `openvino:NPU`)
- `OV_CLIP_DIR` (default: `models/clip`)
- `OV_CAPTION_DIR` (default: `models/caption`)
- `OV_LLM_DIR` (default: `models/llm`)
- `MAX_TAGS` (default: `10`)
- `MAX_CAPTIONS_PER_IMAGE` (default: `1`)
- `LLM_MAX_NEW_TOKENS` (default: `220`)
- `LLM_TEMPERATURE` (default: `0.4`)

Troubleshooting
---------------

- Stale PID file: run python scripts/service.py stop or delete
  python_ai_service/target/dev.pid if the process is gone.
- Port already in use: check which process is using port 8000 and stop it manually.
- "No module named pytest": run uv sync (or `npx nx run python-ai-service:install`) and re-run tests.
