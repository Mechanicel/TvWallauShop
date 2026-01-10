from typing import List, Optional
from pydantic import BaseModel, Field


class AnalyzeProductRequest(BaseModel):
    job_id: Optional[int] = None
    price: float = Field(..., ge=0)
    image_urls: List[str] = Field(default_factory=list)


class AnalyzeProductResponse(BaseModel):
    job_id: Optional[int] = None
    display_name: str
    description: str
    tags: List[str] = Field(default_factory=list)
