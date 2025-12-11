// backend/src/middlewares/authMiddleware.ts
// Middleware für Authentifizierung und Rollenprüfung

import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt, { JwtPayload, TokenExpiredError } from 'jsonwebtoken';
import { userService } from '../services/userService';
import { UserRole } from '../models/userModel';

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET!;
if (!ACCESS_TOKEN_SECRET) {
    throw new Error('JWT_SECRET muss gesetzt sein');
}

/**
 * Prüft das Access-Token, lädt den User und hängt ihn als req.user an.
 */
export const authMiddleware: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // 1) Token aus Header (bevorzugt) oder Cookie holen
        let token: string | undefined;

        const authHeader = req.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else if (req.cookies?.accessToken) {
            token = String(req.cookies.accessToken);
        }

        if (!token) {
            return res.status(401).json({ error: 'Kein Token bereitgestellt' });
        }

        // 2) Token prüfen
        const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);

        if (typeof decoded !== 'object' || decoded === null || !('sub' in decoded)) {
            console.warn('[authMiddleware] Kein userId (sub) im Token-Payload');
            return res.status(401).json({ error: 'Ungültiges Token-Payload' });
        }

        const { sub } = decoded as JwtPayload;
        const userId = Number(sub);

        if (!userId || Number.isNaN(userId)) {
            console.warn('[authMiddleware] userId im Token-Payload ist ungültig:', sub);
            return res.status(401).json({ error: 'Ungültiges Token-Payload' });
        }

        // 3) User laden
        const user = await userService.getUserById(userId);

        if (!user) {
            console.warn('[authMiddleware] Kein User für ID gefunden:', userId);
            return res.status(401).json({ error: 'Ungültiger Token-User' });
        }

        // 4) an Request hängen (typisiert via express.d.ts)
        req.user = {
            id: user.id,
            role: user.role as UserRole,
        };

        next();
    } catch (err: any) {
        // 🔇 Token abgelaufen → kein riesiger Stacktrace im Log
        if (err instanceof TokenExpiredError || err?.name === 'TokenExpiredError') {
            // optional leicht loggen:
            // console.info('[authMiddleware] Access-Token abgelaufen');
            return res.status(401).json({ error: 'Token abgelaufen' });
        }

        // Nur „echte“ Fehler loggen
        console.error('[authMiddleware] Fehler beim Token-Check:', err?.message);
        return res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
    }
};

/**
 * Rollen-Check: nur erlaubt, wenn User die geforderte Rolle hat
 * Beispiel: router.post('/admin', requireRole('admin'), ...)
 */
export const requireRole = (role: UserRole) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;

        if (!user || user.role !== role) {
            return res
                .status(403)
                .json({ error: 'Forbidden: insufficient rights' });
        }

        next();
    };
};
