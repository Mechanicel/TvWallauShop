// backend/src/middlewares/authMiddleware.ts
// Middleware für Authentifizierung und Rollenprüfung

import { Request, Response, NextFunction } from 'express';
import jwt, { TokenExpiredError } from 'jsonwebtoken';
import { userService } from '../services/userService';

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET!;

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // 1) Token aus Header (bevorzugt) oder Cookie holen
        let token: string | undefined;

        const authHeader = req.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else if ((req as any).cookies?.accessToken) {
            token = (req as any).cookies.accessToken;
        }

        if (!token) {
            return res.status(401).json({ error: 'Kein Token bereitgestellt' });
        }

        // 2) Token prüfen
        const decoded: any = jwt.verify(token, ACCESS_TOKEN_SECRET);
        const userId = decoded.sub; // wichtig: bei signJwt war es { sub: user.id }

        if (!userId) {
            // Das ist ein echter Fehlerfall, den wir loggen wollen
            console.warn('[authMiddleware] Kein userId im Token-Payload');
            return res.status(401).json({ error: 'Ungültiges Token-Payload' });
        }

        // 3) User laden
        const user = await userService.getUserById(Number(userId));

        if (!user) {
            console.warn('[authMiddleware] Kein User für ID gefunden:', userId);
            return res.status(401).json({ error: 'Ungültiger Token-User' });
        }

        // 4) an Request hängen
        (req as any).user = user;

        next();
    } catch (err: any) {
        // 🔇 Token abgelaufen → kein riesiger Stacktrace im Log
        if (err instanceof TokenExpiredError || err?.name === 'TokenExpiredError') {
            // optional könntest du hier ganz leicht loggen, z.B.:
            // console.info('[authMiddleware] Access-Token abgelaufen');
            return res.status(401).json({ error: 'Token abgelaufen' });
        }

        // Nur „echte“ Fehler loggen
        console.error('[authMiddleware] Fehler beim Token-Check:', err?.message, err?.stack);
        return res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
    }
};

/**
 * Rollen-Check: nur erlaubt, wenn User die geforderte Rolle hat
 * Beispiel: app.post('/admin', requireRole('admin'), ...)
 */
export const requireRole = (role: 'admin' | 'customer') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user || user.role !== role) {
            return res.status(403).json({ error: 'Forbidden: insufficient rights' });
        }
        next();
    };
};
