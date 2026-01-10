import os
import logging
from dotenv import load_dotenv

# EXTREM WICHTIG: .env laden + Offline/Caches setzen BEVOR HF/Transformers importiert werden
load_dotenv()

def _is_true(v: str) -> bool:
    return (v or "").strip().lower() in ("1", "true", "yes", "on")

# Cache-Pfade (falls gesetzt) hard-setzen
for k in ("HF_HOME", "HF_HUB_CACHE", "TRANSFORMERS_CACHE"):
    if os.getenv(k):
        os.environ[k] = os.getenv(k)

# Offline hard-setzen (verhindert HEAD/Retry zu huggingface.co)
if _is_true(os.getenv("HF_HUB_OFFLINE", "0")):
    os.environ["HF_HUB_OFFLINE"] = "1"
if _is_true(os.getenv("TRANSFORMERS_OFFLINE", "0")):
    os.environ["TRANSFORMERS_OFFLINE"] = "1"

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from fastapi import FastAPI, HTTPException, status  # noqa: E402

from .config import get_settings  # noqa: E402
from .schemas import AnalyzeProductRequest, AnalyzeProductResponse  # noqa: E402
from .services import analyze  # noqa: E402

settings = get_settings()

logger = logging.getLogger("tvwallau-ai")
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

app = FastAPI(title="TvWallauShop AI Product Service", version="0.3.0")


@app.on_event("startup")
def warmup_models():
    logger.info("startup DEBUG=%s LOG_LEVEL=%s", settings.DEBUG, settings.LOG_LEVEL)
    logger.info("startup ANALYZE_PIPELINE=%s STOP_AFTER_CAPTION=%s", settings.ANALYZE_PIPELINE, settings.STOP_AFTER_CAPTION)
    logger.info("startup HF_HUB_OFFLINE=%s TRANSFORMERS_OFFLINE=%s", settings.HF_HUB_OFFLINE, settings.TRANSFORMERS_OFFLINE)
    logger.info("startup MODEL_STORE_DIR=%s", settings.MODEL_STORE_DIR)

    if not getattr(settings, "WARMUP_MODELS", False):
        logger.info("startup WARMUP_MODELS=0 -> skip warmup (akku sparen)")
        return

    try:
        logger.info("startup warmup enabled -> loading caption model once")
        from app.services.loader.caption_model_loader import get_caption_model
        get_caption_model()
        logger.info("startup warmup caption done")
    except Exception as e:
        logger.exception("startup warmup failed: %s", e)


@app.get("/health", status_code=status.HTTP_200_OK)
async def health():
    return {"status": "ok"}


@app.post("/analyze-product", response_model=AnalyzeProductResponse, status_code=status.HTTP_200_OK)
async def analyze_product(payload: AnalyzeProductRequest):
    try:
        logger.info("analyze-product job_id=%s price=%s images=%s", payload.job_id, payload.price, len(payload.image_urls))
        return analyze(payload)
    except Exception as e:
        logger.exception("AI analyze failed")
        raise HTTPException(status_code=500, detail=str(e))
