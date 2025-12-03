import bcrypt from 'bcrypt';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import ms, { StringValue } from 'ms';
import crypto from 'crypto';
import { knex } from '../database';
import { User, createUser, getUserByEmail, toSanitized, setVerificationForUser } from '../models/userModel';
import { sendVerificationEmail } from '../utils/mailer';

/** Token secrets/expirations */
const ACCESS_TOKEN_SECRET: Secret = process.env.JWT_SECRET!;
const REFRESH_TOKEN_SECRET: Secret = process.env.JWT_REFRESH_SECRET!;
if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
    throw new Error('JWT_SECRET und JWT_REFRESH_SECRET müssen definiert sein');
}
const ACCESS_TOKEN_EXPIRY: StringValue =
    (process.env.ACCESS_TOKEN_EXPIRES_IN as StringValue) || ('15m' as StringValue);
const REFRESH_TOKEN_EXPIRY: StringValue =
    (process.env.REFRESH_TOKEN_EXPIRES_IN as StringValue) || ('7d' as StringValue);

/** Types returned to the controller */
export type LoginResult = {
    accessToken: string;
    refreshToken: string;
    user: ReturnType<typeof toSanitized>;
};
export type RefreshResult = { accessToken: string };

/** Payload we'll accept for signups (controller validates required fields) */
export type SignupInput = {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string | null;

    // Billing address
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
    country: string;
    state?: string | null;

    // Shipping address
    shippingStreet?: string | null;
    shippingHouseNumber?: string | null;
    shippingPostalCode?: string | null;
    shippingCity?: string | null;
    shippingState?: string | null;
    shippingCountry?: string | null;

    // Payment / Marketing
    preferredPayment?: 'invoice' | 'paypal' | 'creditcard' | 'banktransfer' | null;
    newsletterOptIn?: boolean | null;
    dateOfBirth?: string | null; // ISO string
    gender?: 'male' | 'female' | 'other' | null;
};

function signJwt(payload: object, secret: Secret, expiresIn: StringValue) {
    const opts: SignOptions = { expiresIn };
    return jwt.sign(payload, secret, opts);
}

export const authService = {
    /** Create DB user, set verification token, send email */
    async signup(data: SignupInput): Promise<void> {
        const existing = await getUserByEmail(data.email);
        if (existing) {
            const err: any = new Error('E-Mail bereits registriert');
            err.status = 409;
            throw err;
        }

        const password_hash = await bcrypt.hash(data.password, 10);
        const nn = (v: any) => (v === undefined || v === '' ? null : v);
        console.log(data);
        const user: Partial<User> = {
            first_name: data.firstName,
            last_name: data.lastName,
            email: data.email,
            password_hash,
            phone: nn(data.phone),
            // Billing
            street: data.street,
            house_number: data.houseNumber,
            postal_code: data.postalCode,
            city: data.city,
            state: nn(data.state),
            country: data.country,
            // Shipping
            shipping_street: nn(data.shippingStreet),
            shipping_house_number: nn(data.shippingHouseNumber),
            shipping_postal_code: nn(data.shippingPostalCode),
            shipping_city: nn(data.shippingCity),
            shipping_state: nn(data.shippingState),
            shipping_country: nn(data.shippingCountry),
            // Payment / Marketing
            preferred_payment: (data.preferredPayment ?? 'invoice') as any,
            newsletter_opt_in: Boolean(data.newsletterOptIn ?? false),
            date_of_birth: nn(data.dateOfBirth),
            gender: nn(data.gender) as any,
        };

        const created = await createUser(user);
        // Generate email verification token
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + ms('24h'));
        console.log("USER: " + created);
        await setVerificationForUser(created.id, token, expires);

        const origin = process.env.APP_ORIGIN || 'http://localhost:3001';
        const verifyUrl = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`;
        await sendVerificationEmail({ to: created.email, verifyUrl, firstName: created.first_name });
    },

    /** Validate credentials & issue tokens */
    async login(email: string, password: string): Promise<LoginResult> {
        const user = await getUserByEmail(email);
        if (!user) {
            const err: any = new Error('Ungültige Anmeldedaten');
            err.status = 401;
            throw err;
        }
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            const err: any = new Error('Ungültige Anmeldedaten');
            err.status = 401;
            throw err;
        }
        if (!user.is_verified) {
            const err: any = new Error('Bitte bestätige zuerst deine E-Mail.');
            err.status = 403;
            throw err;
        }

        const accessToken = signJwt({ sub: user.id }, ACCESS_TOKEN_SECRET, ACCESS_TOKEN_EXPIRY);
        const refreshToken = signJwt({ sub: user.id }, REFRESH_TOKEN_SECRET, REFRESH_TOKEN_EXPIRY);
        const refreshExpires = new Date(Date.now() + ms(REFRESH_TOKEN_EXPIRY)!);

        await knex('refresh_tokens').insert({
            user_id: user.id,
            token: refreshToken,
            created_at: new Date(),
            expires_at: refreshExpires, // <── wichtig für dein Schema
        });

        return { accessToken, refreshToken, user: toSanitized(user) };
    },

    /** Exchange refresh token for new access token */
    async refresh(oldToken: string): Promise<RefreshResult> {
        try {
            const decoded = jwt.verify(oldToken, REFRESH_TOKEN_SECRET) as any;
            const found = await knex('refresh_tokens').where({ token: oldToken }).first();
            if (!found) {
                const err: any = new Error('Refresh-Token unbekannt');
                err.status = 401;
                throw err;
            }
            const accessToken = signJwt({ sub: decoded.sub }, ACCESS_TOKEN_SECRET, ACCESS_TOKEN_EXPIRY);
            return { accessToken };
        } catch {
            const err: any = new Error('Refresh-Token ungültig oder abgelaufen');
            err.status = 401;
            throw err;
        }
    },

    /** Invalidate refresh token */
    async logout(oldToken: string): Promise<void> {
        if (!oldToken) return;
        await knex('refresh_tokens').where({ token: oldToken }).delete();
    },

    /** Verify email via token */
    async verifyEmail(token: string) {
        if (!token) {
            const err: any = new Error('Token fehlt');
            err.status = 400;
            throw err;
        }
        const user: User | undefined = await knex<User>('users')
            .where({ verification_token: token })
            .andWhere('verification_expires', '>', new Date())
            .first();

        if (!user) {
            const err: any = new Error('Token ungültig oder abgelaufen');
            err.status = 400;
            throw err;
        }

        await knex<User>('users')
            .update({ is_verified: true, verification_token: null, verification_expires: null })
            .where({ id: user.id });

        const updated = { ...user, is_verified: 1, verification_token: null, verification_expires: null };
        return { user: toSanitized(updated as any) };
    },

    /** Resend verification mail */
    async resendVerification(userId: number, email: string, firstName: string) {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + ms('24h'));
        await setVerificationForUser(userId, token, expires);

        const origin = process.env.APP_ORIGIN || 'http://localhost:3001';
        const verifyUrl = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`;
        await sendVerificationEmail({ to: email, verifyUrl, firstName: firstName });
    },
};
