// backend/src/errors/ServiceError.ts

export class ServiceError extends Error {
    status: number;
    code?: string;
    details?: Record<string, unknown>;

    constructor(
        message: string,
        status = 500,
        code?: string,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'ServiceError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
