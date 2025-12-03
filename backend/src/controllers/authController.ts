// backend/src/controllers/authController.ts

import { Request, Response } from 'express';
import { authService, LoginResult, RefreshResult, SignupInput } from '../services/authService';
import { catchAsync } from '../utils/helpers';
import { knex } from '../database';
import { formatDate } from '../utils/helpers';
/** Helper for required-field checks */
function missing(fields: Record<string, any>, keys: string[]) {
    const errs: string[] = [];
    for (const k of keys) {
        const v = (fields as any)[k];
        if (v === undefined || v === null || v === '') errs.push(k);
    }
    return errs;
}

/** POST /api/auth/signup */
export const signup = catchAsync(async (req: Request, res: Response) => {
    const {
        firstName,
        lastName,
        email,
        password,
        phone,
        // Billing address (required)
        street,
        houseNumber,
        postalCode,
        city,
        country,
        state,
        // Shipping (optional)
        shippingStreet,
        shippingHouseNumber,
        shippingPostalCode,
        shippingCity,
        shippingState,
        shippingCountry,
        // Payment / marketing / misc
        preferredPayment,
        newsletterOptIn,
        dateOfBirth,
        gender,
    } = req.body || {};

    const requiredErrors = missing(
        { firstName, lastName, email, password, street, houseNumber, postalCode, city, country },
        ['firstName', 'lastName', 'email', 'password', 'street', 'houseNumber', 'postalCode', 'city', 'country']
    );
    if (requiredErrors.length) {
        return res
            .status(400)
            .json({
                error: `Folgende Pflichtfelder fehlen oder sind leer: ${requiredErrors.join(', ')}`
            });
    }

    const payload: SignupInput = {
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        email: String(email).toLowerCase().trim(),
        password: String(password),
        phone: phone ?? null,
        street: String(street).trim(),
        houseNumber: String(houseNumber).trim(),
        postalCode: String(postalCode).trim(),
        city: String(city).trim(),
        country: String(country).trim(),
        state: state ?? null,
        shippingStreet: shippingStreet ?? null,
        shippingHouseNumber: shippingHouseNumber ?? null,
        shippingPostalCode: shippingPostalCode ?? null,
        shippingCity: shippingCity ?? null,
        shippingState: shippingState ?? null,
        shippingCountry: shippingCountry ?? null,
        preferredPayment: preferredPayment ?? null,
        newsletterOptIn: newsletterOptIn ?? false,
        dateOfBirth: dateOfBirth ? formatDate(dateOfBirth) : null,
        gender: gender ?? null,
    };

    await authService.signup(payload);
    return res
        .status(201)
        .json({ message: 'Signup erfolgreich. Bitte prüfe deine E-Mail zur Verifikation.' });
});

/** POST /api/auth/login */
export const login = catchAsync(async (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'email und password erforderlich' });
    }

    const result: LoginResult = await authService.login(String(email), String(password));

    // Refresh-Token zusätzlich als httpOnly-Cookie setzen (für sicheren Refresh-Flow)
    const refreshToken = (result as any).refreshToken;
    if (refreshToken) {
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            sameSite: 'lax',
            secure: isRequestSecure(req),
            path: '/', // einheitliche Basis
        });
    }

    // Das JSON-Ergebnis (inkl. refreshToken) bleibt unverändert für Abwärtskompatibilität
    return res.status(200).json(result);
});

function extractRefreshToken(req: Request): string | undefined {
    // 1) normal über cookie-parser
    const c = (req as any).cookies?.refreshToken;
    if (c && typeof c === 'string' && c.length > 0) return c;

    // 2) Fallback: Rohheader parsen und den letzten nicht-leeren nehmen
    const raw = req.headers?.cookie;
    if (!raw) return undefined;
    const parts = raw
        .split(';')
        .map(s => s.trim())
        .filter(s => s.startsWith('refreshToken='));
    if (parts.length === 0) return undefined;

    for (let i = parts.length - 1; i >= 0; i--) {
        const v = decodeURIComponent(parts[i].slice('refreshToken='.length));
        if (v) return v;
    }
    return undefined;
}

function isRequestSecure(req: Request): boolean {
    // Direkter HTTPS-Server: req.secure ist true
    if (req.secure) return true;

    // Hinter einem Proxy (z.B. später mit Docker / Nginx) kann x-forwarded-proto gesetzt sein
    const xfProto = req.headers['x-forwarded-proto'];
    if (typeof xfProto === 'string') {
        return xfProto === 'https';
    }
    if (Array.isArray(xfProto)) {
        return xfProto.includes('https');
    }

    // Fallback: auf Basis des Protokolls
    return req.protocol === 'https';
}

function clearAuthCookiesEverywhere(res: Response, req: Request) {
    const base = { sameSite: 'lax' as const, secure: isRequestSecure(req), httpOnly: true as const };
    const paths = ['/', '/auth', '/api', '/logout']; // belt & suspenders
    for (const p of paths) {
        res.clearCookie('refreshToken', { path: p, ...base });
        res.clearCookie('accessToken', { path: p, ...base });
    }
}

export const refresh = catchAsync(async (req: Request, res: Response) => {
    const token = extractRefreshToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Kein Refresh-Token gefunden' });
    }

    const result: RefreshResult = await authService.refresh(String(token));
    const newRefreshToken = (result as any).refreshToken ?? token; // Rotation optional

    res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isRequestSecure(req),
        path: '/',             // WICHTIG: immer '/'
    });

    return res.status(200).json({
        accessToken: result.accessToken,
    });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
    try {
        const refreshToken = extractRefreshToken(req); // robust lesen
        if (refreshToken) {
            await knex('refresh_tokens').where({ token: refreshToken }).delete();
        }

        // alle potentiellen Duplikate aufräumen
        clearAuthCookiesEverywhere(res, req);

        return res.status(200).json({ message: 'Logout erfolgreich' });
    } catch (err: any) {
        return res.status(500).json({ error: 'Logout fehlgeschlagen' });
    }
});

/** GET /api/auth/verify?token=...&redirect=... */
export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
    const { token, redirect } = req.query as { token?: string; redirect?: string };
    if (!token) {
        return res.status(400).json({ error: 'Token fehlt' });
    }

    await authService.verifyEmail(String(token));

    if (redirect) {
        return res.redirect(302, redirect);
    }
    return res
        .status(200)
        .json({ message: 'E-Mail erfolgreich bestätigt. Du kannst dich jetzt einloggen.' });
});

/** POST /api/auth/resend */
export const resendVerification = catchAsync(async (req: Request, res: Response) => {
    const { userId, email, firstName } = req.body;
    if (!userId || !email) {
        return res.status(400).json({ error: 'userId und email erforderlich' });
    }

    await authService.resendVerification(Number(userId), String(email), String(firstName));
    return res
        .status(200)
        .json({ message: 'Verifikations-E-Mail wurde erneut gesendet (falls zulässig).' });
});
