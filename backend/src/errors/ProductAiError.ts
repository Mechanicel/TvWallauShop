export type ProductAiErrorCode =
    | 'AI_INVALID_INPUT'
    | 'AI_INVALID_OUTPUT'
    | 'AI_INVALID_JOB_ID'
    | 'AI_JOB_NOT_FOUND'
    | 'AI_JOB_ALREADY_COMPLETED'
    | 'AI_REAL_SERVICE_REQUIRED';

export class ProductAiError extends Error {
    status: number;
    code: ProductAiErrorCode;
    details?: Record<string, unknown>;

    constructor(
        code: ProductAiErrorCode,
        message: string,
        status = 400,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'ProductAiError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}
