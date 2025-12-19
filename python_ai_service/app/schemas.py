from typing import List, Optional
from pydantic import BaseModel, Field


class AnalyzeProductRequest(BaseModel):
    job_id: Optional[int] = Field(default=None)
    price: float = Field(..., gt=0)
    image_paths: List[str] = Field(default_factory=list)


class AnalyzeProductResponse(BaseModel):
    job_id: Optional[int] = Field(default=None)
    display_name: str
    description: str
    tags: List[str] = Field(default_factory=list)
