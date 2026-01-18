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
- Keep `openvino`, `openvino-genai`, and `openvino-tokenizers` pinned to the same
  release line. The `openvino-genai` wheel is built against specific OpenVINO
  and tokenizer versions; updating one package alone can break tokenizer loading.
- Windows requires the OpenVINO Tokenizers extension DLL (`openvino_tokenizers.dll`);
  the service loads it at startup to avoid `unsupported opset: extension` errors.

Model setup
-----------

The AI pipeline expects OpenVINO models stored locally. You can either drop pre-converted
IR artifacts in place or allow a one-time download/convert via `MODEL_FETCH_MODE=download`
with `OFFLINE=0`. When `OFFLINE=1`, the service will never access the network and missing
assets will return `MODEL_NOT_AVAILABLE`.

Model sources (local-only inference):

- Tagger: `openai/clip-vit-base-patch32` (OpenVINO IR)
- Captioner: `Salesforce/blip-image-captioning-base` (OpenVINO IR)
- LLM: `Qwen/Qwen2.5-3B-Instruct` (OpenVINO IR INT4 via `optimum-cli export openvino`)

Expected local filesystem layout:

```
models/
  clip/
    image_encoder.xml
    image_encoder.bin
    text_encoder.xml
    text_encoder.bin
    openvino_tokenizer.xml
    openvino_tokenizer.bin
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

One-time conversion commands (requires `MODEL_FETCH_MODE=download` and `OFFLINE=0`):

```
optimum-cli export openvino --model "openai/clip-vit-base-patch32" --task feature-extraction --output "models/clip"
optimum-cli export openvino --model "Salesforce/blip-image-captioning-base" --task image-to-text --output "models/caption"
optimum-cli export openvino --model "Qwen/Qwen2.5-3B-Instruct" --task text-generation-with-past --trust-remote-code --weight-format int4 --group-size 128 --ratio 1.0 --sym "models/llm"
```

Environment variables:

- `AI_DEVICE` (default: `openvino:GPU`, only supported value)
- `MODEL_DIR` (default: `models`)
- `MODEL_CACHE_DIR` (default: `models`)
- `OFFLINE` (default: `0`, when `1` the service never accesses the network)
- `MODEL_FETCH_MODE` (default: `never`, allowed: `never`, `download`, `force`)
- `OV_CLIP_DIR` (default: `models/clip`, derived from `MODEL_DIR`)
- `OV_CAPTION_DIR` (default: `models/caption`, derived from `MODEL_DIR`)
- `OV_LLM_DIR` (default: `models/llm`, derived from `MODEL_DIR`)
- `MAX_TAGS` (default: `10`)
- `MAX_CAPTIONS_PER_IMAGE` (default: `1`)
- `LLM_MAX_NEW_TOKENS` (default: `220`)
- `LLM_TEMPERATURE` (default: `0.4`)

API request payload
-------------------

Example JSON payload:

```json
{
  "jobId": 123,
  "price": {
    "amount": 49.99,
    "currency": "USD"
  },
  "images": [
    {
      "kind": "base64",
      "value": "..."
    }
  ],
  "maxTags": 10,
  "maxCaptions": 1
}
```

Note: the API no longer accepts the legacy `image_paths` field. Requests that include
`image_paths` instead of `images` will return HTTP 422 (validation error).

Troubleshooting
---------------

- Stale PID file: run python scripts/service.py stop or delete
  python_ai_service/target/dev.pid if the process is gone.
- Port already in use: check which process is using port 8000 and stop it manually.
- "No module named pytest": run uv sync (or `npx nx run python-ai-service:install`) and re-run tests.
