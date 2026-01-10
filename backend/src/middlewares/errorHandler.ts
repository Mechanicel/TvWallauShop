// backend/src/middleware/errorHandler.ts

import { Request, Response, NextFunction } from 'express';
import { AuthError } from '../errors/AuthError';
import { InsufficientStockError } from '../errors/InsufficientStockError';

export function errorHandler(
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    // Immer loggen
    console.error('[ErrorHandler]', err);

    // 🔹 Spezieller Fall: Auth-Fehler
    if (err instanceof AuthError) {
        const status = err.status ?? 400;
        const isProd = process.env.NODE_ENV === 'production';

        const responseBody: any = {
            code: err.code,
            message: err.message,
        };

        if (!isProd && err.details) {
            responseBody.details = err.details;
        }

        return res.status(status).json(responseBody);
    }

    // 🔹 Spezieller Fall: nicht genug Bestand
    if (err instanceof InsufficientStockError || err?.code === 'INSUFFICIENT_STOCK') {
        const status = err.status ?? 400;
        const isProd = process.env.NODE_ENV === 'production';

        const responseBody: any = {
            code: 'INSUFFICIENT_STOCK',
            message:
                'Ein Artikel ist nicht mehr in der gewünschten Menge verfügbar. Bitte prüfe deinen Warenkorb und passe die Mengen an.',
        };

        // Nur in DEV genauere Details mitsenden
        if (!isProd && err.details) {
            responseBody.details = err.details;
        }

        return res.status(status).json(responseBody);
    }

    // 🔹 Allgemeine Fehlerbehandlung
    const status =
        typeof err.status === 'number' && err.status >= 400 && err.status < 600
            ? err.status
            : 500;

    const isProd = process.env.NODE_ENV === 'production';

    const body: any = {
        message:
            status === 500
                ? 'Es ist ein unerwarteter Fehler aufgetreten. Bitte versuche es später erneut.'
                : err.message || 'Fehler bei der Anfrage.',
    };

    if (!isProd) {
        body.code = err.code;
        body.stack = err.stack;
        if (err.details) {
            body.details = err.details;
        }
    }

    return res.status(status).json(body);
}
