// backend/src/models/userModel.ts

import { knex } from '../database';
import type { AuthResponse, Gender, PaymentMethod, RefreshResponse, SignupPayload, User as ApiUser, UserRole } from '@tvwallaushop/contracts';

/**
 * Zentrale Typen für User-Attribute
 */
/** User-DB-Record (snake_case, wie in DB) */
export interface User {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    password_hash: string;
    phone?: string | null;

    role: UserRole;
    is_verified: boolean;

    verification_token?: string | null;
    verification_expires?: Date | null;
    created_at: Date;

    // Rechnungsadresse
    street: string;
    house_number: string;
    postal_code: string;
    city: string;
    state?: string | null;
    country: string;

    // Lieferadresse
    shipping_street?: string | null;
    shipping_house_number?: string | null;
    shipping_postal_code?: string | null;
    shipping_city?: string | null;
    shipping_state?: string | null;
    shipping_country?: string | null;

    // Payment / Marketing
    preferred_payment: PaymentMethod;
    newsletter_opt_in: boolean;
    date_of_birth?: string | null;      // ISO-String
    gender?: Gender | null;

    // Shop-spezifisch
    loyalty_points?: number | null;
    last_login?: Date | null;
    account_status?: 'active' | 'suspended' | 'deleted' | null;
}

export type UserSanitized = ApiUser;

/** Insert neuen User */
export async function createUser(user: Partial<User>): Promise<User> {
    const [id] = await knex<User>('users').insert(user);

    const created = await knex<User>('users')
        .where({ id })
        .first();

    return created!;
}

/** Lookup by Email */
export async function getUserByEmail(email: string): Promise<User | undefined> {
    return knex<User>('users')
        .where({ email })
        .first();
}

/** Lookup by ID */
export async function getUserById(id: number): Promise<User | undefined> {
    return knex<User>('users')
        .where({ id })
        .first();
}

/** Verification setzen */
export async function setVerificationForUser(
    userId: number,
    token: string,
    expires: Date
): Promise<void> {
    await knex<User>('users')
        .update({ verification_token: token, verification_expires: expires })
        .where({ id: userId });
}

/** sensible Felder entfernen */
export function toSanitized(user: User): UserSanitized {
    return {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone ?? null,
        role: user.role,
        isVerified: user.is_verified,
        createdAt: user.created_at.toISOString(),

        // Rechnungsadresse
        street: user.street ?? null,
        houseNumber: user.house_number ?? null,
        postalCode: user.postal_code ?? null,
        city: user.city ?? null,
        state: user.state ?? null,
        country: user.country ?? null,

        // Lieferadresse
        shippingStreet: user.shipping_street ?? null,
        shippingHouseNumber: user.shipping_house_number ?? null,
        shippingPostalCode: user.shipping_postal_code ?? null,
        shippingCity: user.shipping_city ?? null,
        shippingState: user.shipping_state ?? null,
        shippingCountry: user.shipping_country ?? null,

        // Payment / Marketing
        preferredPayment: user.preferred_payment ?? 'invoice',
        newsletterOptIn: user.newsletter_opt_in,
        dateOfBirth: user.date_of_birth ?? null,
        gender: user.gender ?? null,

        // Shop-spezifisch
        loyaltyPoints: user.loyalty_points ?? 0,
        lastLogin: user.last_login ? user.last_login.toISOString() : null,
        accountStatus: user.account_status ?? 'active',
    };
}

/** Types returned to the controller */
export type LoginResult = AuthResponse;

export type RefreshResult = RefreshResponse;

/** Payload we'll accept for signups (controller validates required fields) */
export type SignupInput = SignupPayload;
