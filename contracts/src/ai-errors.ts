export type AiErrorCode =
  | 'DEVICE_NOT_AVAILABLE'
  | 'MODEL_NOT_AVAILABLE'
  | 'INVALID_INPUT'
  | 'INVALID_IMAGE'
  | 'INFERENCE_FAILED'
  | 'LLM_OUTPUT_INVALID';

export interface AiErrorResponse {
  code: AiErrorCode;
  message: string;
  details?: unknown;
  jobId?: number | null;
}
