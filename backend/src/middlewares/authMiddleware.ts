// backend/src/middleware/authMiddleware.ts
// Middleware für Authentifizierung und Rollenprüfung

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUserById } from '../models/userModel';
import {userService} from "../services/userService";

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET!;

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // 1) Token aus Cookie oder Header holen
        let token: string | undefined;
        if (req.cookies?.accessToken) {
            token = req.cookies.accessToken;
        } else if (req.headers['authorization']) {
            const authHeader = req.headers['authorization'];
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (!token) {
            return res.status(401).json({ error: 'Kein Token bereitgestellt' });
        }

        // 2) Token prüfen
        const decoded: any = jwt.verify(token, ACCESS_TOKEN_SECRET);


        const userId = decoded.sub; // wichtig: bei signJwt war es { sub: user.id }

        if (!userId) {
            console.warn('[authMiddleware] Kein userId im Token');
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
        console.error('[authMiddleware] Fehler:', err.message, err.stack);
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
