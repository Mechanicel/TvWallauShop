// backend/src/utils/helpers.ts

import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wrap an async route handler and forward errors to next()
 */
export const catchAsync =
    (fn: RequestHandler): RequestHandler =>
        (req: Request, res: Response, next: NextFunction) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };

/**
 * Send a standardized error response
 */

export const sendError = (
    res: Response,
    statusCode: number,
    message: string
): void => {
    res.status(statusCode).json({ error: message });
};

/**
 * Simple email format validation
 */
export const isValidEmail = (email: string): boolean => {
    const re =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

export function formatDate(d: any): string | null {
    if (!d) return null;

    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return null;

        // YYYY-MM-DD extrahieren
        return date.toISOString().split('T')[0];
    } catch {
        return null;
    }
}
