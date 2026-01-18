import logging
from fastapi import Response, FastAPI, Request, status
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


@app.exception_handler(AiServiceError)
async def ai_service_error_handler(request: Request, exc: AiServiceError):
    logger.warning("AI service error at %s: %s", request.url.path, exc.message)
    return JSONResponse(status_code=exc.http_status, content=exc.to_contract_dict())


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception at %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "code": "INTERNAL_ERROR",
            "message": "Unexpected server error.",
            "details": {"error": str(exc), "path": request.url.path},
        },
    )


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
        try:
            ensure_models(
                mode=settings.MODEL_FETCH_MODE,
                offline=settings.OFFLINE,
                settings=settings,
            )
        except AiServiceError as exc:
            details = exc.details or {}
            logger.error(
                "Model startup check failed: code=%s message=%s stdout_tail=%s stderr_tail=%s",
                exc.code,
                exc.message,
                details.get("stdout_tail"),
                details.get("stderr_tail"),
            )
            raise RuntimeError("Model startup check failed.") from exc
        except Exception as exc:
            logger.error("Model startup check failed unexpectedly: %s", exc)
            raise RuntimeError("Model startup check failed unexpectedly.") from exc


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
