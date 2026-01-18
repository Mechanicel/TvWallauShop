from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

LanguageCode = Literal["en"]
ImageRefKind = Literal["path", "url", "base64"]
AiDevice = Literal["openvino:GPU", "openvino:NPU"]


class ImageRef(BaseModel):
    kind: ImageRefKind
    value: str
    mime: Optional[str] = None
    filename: Optional[str] = None


class Money(BaseModel):
    amount: float = Field(..., gt=0)
    currency: Optional[str] = None


class Tag(BaseModel):
    value: str
    score: Optional[float] = None
    source: Optional[str] = None


class Caption(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    image_index: int = Field(..., alias="imageIndex")
    text: str
    source: Optional[str] = None


class PipelineTimings(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    image_load_ms: float = Field(..., alias="imageLoadMs")
    tagger_ms: float = Field(..., alias="taggerMs")
    captioner_ms: float = Field(..., alias="captionerMs")
    llm_ms: float = Field(..., alias="llmMs")
    total_ms: float = Field(..., alias="totalMs")


class PipelineModels(BaseModel):
    tagger: str
    captioner: str
    llm: str


class PipelineMeta(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    contract_version: str = Field(..., alias="contractVersion")
    device: AiDevice
    models: PipelineModels
    timings: PipelineTimings


class AnalyzeProductRequest(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    job_id: Optional[int] = Field(default=None, alias="jobId")
    price: Money
    images: List[ImageRef] = Field(..., min_items=1)
    lang: Optional[LanguageCode] = None
    max_tags: Optional[int] = Field(default=None, alias="maxTags")
    max_captions: Optional[int] = Field(default=None, alias="maxCaptions")
    debug: Optional[bool] = None


class AnalyzeProductResponse(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    job_id: Optional[int] = Field(default=None, alias="jobId")
    title: str
    description: str
    tags: List[Tag]
    captions: List[Caption]
    meta: PipelineMeta
