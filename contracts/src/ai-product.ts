export type LanguageCode = 'en';

export type ImageRefKind = 'path' | 'url' | 'base64';

export interface ImageRef {
  kind: ImageRefKind;
  value: string;
  mime?: string;
  filename?: string;
}

export interface Money {
  amount: number;
  currency?: string;
}

export interface Tag {
  value: string;
  score?: number;
  source?: string;
}

export interface Caption {
  imageIndex: number;
  text: string;
  source?: string;
}

export interface PipelineTimings {
  imageLoadMs: number;
  taggerMs: number;
  captionerMs: number;
  llmMs: number;
  totalMs: number;
}

export interface PipelineModels {
  tagger: string;
  captioner: string;
  llm: string;
}

export type AiDevice =
  | 'CPU'
  | 'GPU'
  | 'NPU'
  | 'openvino:CPU'
  | 'openvino:GPU'
  | 'openvino:NPU';

export interface DeviceRouting {
  clip: AiDevice;
  blip: AiDevice;
  llm: AiDevice;
  strict: boolean;
}

export interface PipelineMeta {
  contractVersion: string;
  device: AiDevice;
  models: PipelineModels;
  timings: PipelineTimings;
}

export interface ClipTagScore {
  tag: string;
  score: number;
}

export interface ClipDebug {
  device: string;
  modelDir: string;
  numImages: number;
  candidatePromptsCount: number;
  topTags: ClipTagScore[];
  promptExamples?: string[];
}

export interface BlipCaptionDebug {
  imageIndex: number;
  caption: string;
}

export interface BlipDebug {
  device: string;
  modelDir: string;
  expectedHw: [number, number];
  captions: BlipCaptionDebug[];
}

export interface LlmDebug {
  rawTextTruncated?: string;
  rawTextChars: number;
  extractedJsonTruncated?: string;
  extractedJsonChars?: number;
  jsonParseError?: string;
  schemaError?: string;
  titleLengthWarning?: string;
  llmInitMs?: number;
  llmGenerateMs?: number;
  llmDeviceRequested?: string;
  llmDeviceResolved?: string;
  llmTimeoutHit?: boolean;
}

export interface AnalyzeDebug {
  clipTagsTop: ClipTagScore[];
  clipTagsImage1?: ClipTagScore[];
  clipTagsImage2?: ClipTagScore[];
  clipTagsIntersection?: string[];
  tagMergeStrategy?: string;
  tagMergeFallback?: string;
  blipCaption?: string;
  blipCaptionImage1?: string;
  blipCaptionImage2?: string;
  captionsSentToLlm?: string[];
  llm: LlmDebug;
}

export interface AnalyzeProductRequest {
  jobId?: number | null;
  price: Money;
  images: ImageRef[];
  lang?: LanguageCode;
  maxTags?: number;
  maxCaptions?: number;
  debug?: boolean;
  debugIncludePrompt?: boolean;
}

export interface AnalyzeProductResponse {
  jobId?: number | null;
  title: string;
  description: string;
  tags: Tag[];
  captions: Caption[];
  meta: PipelineMeta;
  debug?: AnalyzeDebug;
}
