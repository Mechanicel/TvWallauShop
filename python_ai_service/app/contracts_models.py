from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

LanguageCode = Literal["en"]
ImageRefKind = Literal["path", "url", "base64"]
AiDevice = Literal[
    "CPU",
    "GPU",
    "NPU",
    "openvino:CPU",
    "openvino:GPU",
    "openvino:NPU",
]


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


class DeviceRouting(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    clip: AiDevice
    blip: AiDevice
    llm: AiDevice
    strict: bool = True


class ClipTagScore(BaseModel):
    tag: str
    score: float


class TagStat(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    tag: str
    count: int
    mean_score: float = Field(
        ...,
        validation_alias=AliasChoices("meanScore", "mean_score"),
        serialization_alias="meanScore",
    )
    max_score: float = Field(
        ...,
        validation_alias=AliasChoices("maxScore", "max_score"),
        serialization_alias="maxScore",
    )
    frequency: float


class LlmDebug(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    raw_text_truncated: Optional[str] = Field(default=None, alias="rawTextTruncated")
    raw_text_chars: int = Field(0, alias="rawTextChars")
    parsed_title: Optional[str] = Field(default=None, alias="parsedTitle")
    parsed_description: Optional[str] = Field(default=None, alias="parsedDescription")
    extracted_json_truncated: Optional[str] = Field(
        default=None, alias="extractedJsonTruncated"
    )
    extracted_json: Optional[str] = Field(default=None, alias="extractedJson")
    extracted_json_chars: Optional[int] = Field(
        default=None, alias="extractedJsonChars"
    )
    json_parse_error: Optional[str] = Field(default=None, alias="jsonParseError")
    schema_error: Optional[str] = Field(default=None, alias="schemaError")
    title_length_warning: Optional[str] = Field(
        default=None, alias="titleLengthWarning"
    )
    llm_init_ms: Optional[float] = Field(default=None, alias="llmInitMs")
    llm_generate_ms: Optional[float] = Field(default=None, alias="llmGenerateMs")
    llm_device_requested: Optional[str] = Field(
        default=None, alias="llmDeviceRequested"
    )
    llm_device_resolved: Optional[str] = Field(
        default=None, alias="llmDeviceResolved"
    )
    llm_timeout_hit: Optional[bool] = Field(default=None, alias="llmTimeoutHit")
    stop_strings_used: Optional[List[str]] = Field(
        default=None, alias="stopStringsUsed"
    )
    stop_triggered: Optional[bool] = Field(default=None, alias="stopTriggered")


class AnalyzeDebug(BaseModel):
    model_config = ConfigDict(validate_by_name=True)

    clip_tags_top: List[ClipTagScore] = Field(
        default_factory=list, alias="clipTagsTop"
    )
    clip_tags_per_image: Optional[List[List[ClipTagScore]]] = Field(
        default=None, alias="clipTagsPerImage"
    )
    clip_tags_image_1: List[ClipTagScore] = Field(
        default_factory=list, alias="clipTagsImage1"
    )
    clip_tags_image_2: List[ClipTagScore] = Field(
        default_factory=list, alias="clipTagsImage2"
    )
    clip_tags_intersection: List[str] = Field(
        default_factory=list, alias="clipTagsIntersection"
    )
    tag_merge_strategy: Optional[str] = Field(
        default=None, alias="tagMergeStrategy"
    )
    tag_merge_fallback: Optional[str] = Field(
        default=None, alias="tagMergeFallback"
    )
    tags_strict: List[str] = Field(default_factory=list, alias="tagsStrict")
    tags_soft: List[str] = Field(default_factory=list, alias="tagsSoft")
    tag_stats: List[TagStat] = Field(default_factory=list, alias="tagStats")
    tags_per_image: Optional[List[List[ClipTagScore]]] = Field(
        default=None, alias="tagsPerImage"
    )
    brand_candidate: Optional[str] = Field(
        default=None, alias="brandCandidate"
    )
    brand_confidence: Optional[float] = Field(
        default=None, alias="brandConfidence"
    )
    blip_caption: Optional[str] = Field(default=None, alias="blipCaption")
    blip_captions_per_image: Optional[List[str]] = Field(
        default=None, alias="blipCaptionsPerImage"
    )
    blip_caption_image_1: Optional[str] = Field(
        default=None, alias="blipCaptionImage1"
    )
    blip_caption_image_2: Optional[str] = Field(
        default=None, alias="blipCaptionImage2"
    )
    captions_sent_to_llm: List[str] = Field(
        default_factory=list, alias="captionsSentToLlm"
    )
    caption_consensus: List[str] = Field(
        default_factory=list, alias="captionConsensus"
    )
    captions_per_image: Optional[List[str]] = Field(
        default=None, alias="captionsPerImage"
    )
    product_facts: Optional[dict[str, object]] = Field(
        default=None, alias="productFacts"
    )
    llm: LlmDebug


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
    debug: Optional[AnalyzeDebug] = None
