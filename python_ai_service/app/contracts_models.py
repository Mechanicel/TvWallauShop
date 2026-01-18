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


class ClipTagScore(BaseModel):
    tag: str
    score: float


class ClipDebug(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    device: str
    model_dir: str = Field(..., alias="modelDir")
    num_images: int = Field(..., alias="numImages")
    candidate_prompts_count: int = Field(..., alias="candidatePromptsCount")
    top_tags: List[ClipTagScore] = Field(..., alias="topTags")
    prompt_examples: Optional[List[str]] = Field(default=None, alias="promptExamples")


class BlipCaptionDebug(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    image_index: int = Field(..., alias="imageIndex")
    caption: str


class BlipDebug(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    device: str
    model_dir: str = Field(..., alias="modelDir")
    expected_hw: List[int] = Field(..., alias="expectedHw")
    captions: List[BlipCaptionDebug]


class LlmDebug(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    device: str
    model_dir: str = Field(..., alias="modelDir")
    prompt: Optional[str] = None
    raw_output: str = Field(..., alias="rawOutput")
    extracted_json: Optional[str] = Field(default=None, alias="extractedJson")
    parse_error: Optional[str] = Field(default=None, alias="parseError")
    schema_error: Optional[str] = Field(default=None, alias="schemaError")


class AiDebugInfo(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    clip: ClipDebug
    blip: BlipDebug
    llm: LlmDebug
    timings_ms: Optional[dict[str, int]] = Field(default=None, alias="timingsMs")


class AnalyzeProductRequest(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    job_id: Optional[int] = Field(default=None, alias="jobId")
    price: Money
    images: List[ImageRef] = Field(..., min_items=1)
    lang: Optional[LanguageCode] = None
    max_tags: Optional[int] = Field(default=None, alias="maxTags")
    max_captions: Optional[int] = Field(default=None, alias="maxCaptions")
    debug: bool = False
    debug_include_prompt: bool = Field(default=False, alias="debugIncludePrompt")


class AnalyzeProductResponse(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    job_id: Optional[int] = Field(default=None, alias="jobId")
    title: str
    description: str
    tags: List[Tag]
    captions: List[Caption]
    meta: PipelineMeta
    debug: Optional[AiDebugInfo] = None
