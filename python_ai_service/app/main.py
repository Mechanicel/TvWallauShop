import logging
from fastapi import Response, FastAPI, HTTPException, status
from .schemas import AnalyzeProductRequest, AnalyzeProductResponse
from .services.jobs import analyze
from .config import get_settings

settings = get_settings()

logger = logging.getLogger("tvwallau-ai")
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

app = FastAPI(title="TvWallauShop AI Product Service", version="0.2.0")




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
            payload.job_id, payload.price, len(payload.image_paths)
        )
        return analyze(payload)
    except Exception as e:
        logger.exception("AI analyze failed")
        raise HTTPException(status_code=500, detail=str(e))
