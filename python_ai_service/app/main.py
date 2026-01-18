import logging
from fastapi import Response, FastAPI, status
from fastapi.responses import JSONResponse

from .contracts_models import AnalyzeProductRequest, AnalyzeProductResponse
from .services.jobs import analyze
from .services.errors import AiServiceError
from .config import get_settings
from .model_manager import ensure_models

settings = get_settings()

logger = logging.getLogger("tvwallau-ai")
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

app = FastAPI(title="TvWallauShop AI Product Service", version="0.2.0")


@app.get("/health", status_code=200)
async def health_get():
    return {"status": "ok"}


@app.on_event("startup")
async def startup_check_models() -> None:
    if settings.MODEL_FETCH_MODE != "never":
        logger.info(
            "Ensuring model assets MODE=%s OFFLINE=%s",
            settings.MODEL_FETCH_MODE,
            settings.OFFLINE,
        )
        ensure_models(mode=settings.MODEL_FETCH_MODE, offline=settings.OFFLINE, settings=settings)


@app.head("/health", status_code=200)
async def health_head():
    return Response(status_code=200)


@app.post(
    "/analyze-product",
    response_model=AnalyzeProductResponse,
    status_code=status.HTTP_200_OK,
)
async def analyze_product(payload: AnalyzeProductRequest):
    try:
        logger.info(
            "analyze-product job_id=%s price=%s images=%s",
            payload.job_id,
            payload.price.amount,
            len(payload.images),
        )
        return analyze(payload)
    except AiServiceError as exc:
        logger.warning("AI analyze failed: %s", exc.message)
        return JSONResponse(status_code=exc.http_status, content=exc.to_contract_dict())
    except Exception as exc:
        logger.exception("Unexpected AI analyze failure")
        return JSONResponse(
            status_code=500,
            content={
                "code": "INFERENCE_FAILED",
                "message": "Unexpected inference error.",
                "details": {"error": str(exc)},
                "jobId": payload.job_id,
            },
        )
