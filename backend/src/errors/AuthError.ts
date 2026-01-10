export class AuthError extends Error {
    status: number;
    code: string;
    details?: unknown;
    expose = true;

    constructor(code: string, message: string, status = 400, details?: unknown) {
        super(message);
        this.name = 'AuthError';
        this.code = code;
        this.status = status;
        this.details = details;
    }
}
