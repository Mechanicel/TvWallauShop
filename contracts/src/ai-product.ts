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

export type AiDevice = 'openvino:GPU' | 'openvino:NPU';

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
  device: string;
  modelDir: string;
  prompt?: string;
  rawOutput: string;
  extractedJson?: string;
  parseError?: string;
  schemaError?: string;
}

export interface AiDebugInfo {
  clip: ClipDebug;
  blip: BlipDebug;
  llm: LlmDebug;
  timingsMs?: Record<string, number>;
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
  debug?: AiDebugInfo;
}
