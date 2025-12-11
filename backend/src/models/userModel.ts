// backend/src/models/userModel.ts

import { knex } from '../database';

/**
 * Zentrale Typen für User-Attribute
 */
export type UserRole = 'customer' | 'admin';

export type PaymentMethod = 'invoice' | 'paypal' | 'creditcard' | 'banktransfer';

export type Gender = 'male' | 'female' | 'other';

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
}

/** User ohne sensible Felder (für API-Rückgaben etc.) */
export interface UserSanitized {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;

    role: UserRole;
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
    date_of_birth?: string | null;
    gender?: Gender | null;
}

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
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        created_at: user.created_at,

        // Rechnungsadresse
        street: user.street,
        house_number: user.house_number,
        postal_code: user.postal_code,
        city: user.city,
        state: user.state,
        country: user.country,

        // Lieferadresse
        shipping_street: user.shipping_street,
        shipping_house_number: user.shipping_house_number,
        shipping_postal_code: user.shipping_postal_code,
        shipping_city: user.shipping_city,
        shipping_state: user.shipping_state,
        shipping_country: user.shipping_country,

        // Payment / Marketing
        preferred_payment: user.preferred_payment,
        newsletter_opt_in: user.newsletter_opt_in,
        date_of_birth: user.date_of_birth,
        gender: user.gender,
    };
}

/** Types returned to the controller */
export type LoginResult = {
    accessToken: string;
    refreshToken: string;
    user: ReturnType<typeof toSanitized>;
};

export type RefreshResult = {
    accessToken: string;
};

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
    preferredPayment?: PaymentMethod | null;
    newsletterOptIn?: boolean | null;
    dateOfBirth?: string | null; // ISO string
    gender?: Gender | null;
};