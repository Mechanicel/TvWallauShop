// backend/src/services/userService.ts
// Erweiterung um Shop-relevante Felder – minimal-invasiv

import {knex} from '../database';
import {
    User,
    UserRole,
    PaymentMethod,
    Gender,
} from '../models/userModel';
import bcrypt from 'bcrypt';
import {formatDate} from '../utils/helpers';

export interface UserView {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: UserRole;
    isVerified: boolean;
    createdAt: Date;

    // Rechnungsadresse
    street: string | null;
    houseNumber: string | null;
    postalCode: string | null;
    city: string | null;
    state: string | null;
    country: string | null;

    // Lieferadresse
    shippingStreet: string | null;
    shippingHouseNumber: string | null;
    shippingPostalCode: string | null;
    shippingCity: string | null;
    shippingState: string | null;
    shippingCountry: string | null;

    // Zahlungsinfo
    preferredPayment: PaymentMethod;

    // Marketing / Sonstiges
    newsletterOptIn: boolean;
    dateOfBirth: string | null;
    gender: Gender | null;

    // Shop-spezifisch
    loyaltyPoints: number;
    lastLogin: Date | null;
    accountStatus: 'active' | 'suspended' | 'deleted';
}

function mapUserRow(row: any): UserView {
    return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        isVerified: !!row.is_verified,
        createdAt: row.created_at,

        street: row.street,
        houseNumber: row.house_number,
        postalCode: row.postal_code,
        city: row.city,
        state: row.state,
        country: row.country,

        shippingStreet: row.shipping_street,
        shippingHouseNumber: row.shipping_house_number,
        shippingPostalCode: row.shipping_postal_code,
        shippingCity: row.shipping_city,
        shippingState: row.shipping_state,
        shippingCountry: row.shipping_country,

        preferredPayment: row.preferred_payment,
        newsletterOptIn: !!row.newsletter_opt_in,
        dateOfBirth: formatDate(row.date_of_birth),
        gender: row.gender,

        loyaltyPoints: row.loyalty_points,
        lastLogin: row.last_login,
        accountStatus: row.account_status,
    };
}

type PreferencesUpdateRow = {
    id: number;
    email: string;
    newsletter_opt_in: boolean;
    preferred_payment: PaymentMethod;
};

export const userService = {
    async changePassword(
        userId: number,
        oldPassword: string,
        newPassword: string
    ): Promise<boolean> {
        const user = await knex<User>('users').where({id: userId}).first();
        if (!user) return false;

        const match = await bcrypt.compare(oldPassword, user.password_hash);
        if (!match) return false;

        const newHash = await bcrypt.hash(newPassword, 10);
        await knex<User>('users')
            .where({id: userId})
            .update({password_hash: newHash});
        return true;
    },

    async updatePreferences(
        userId: number,
        data: { newsletterOptIn?: boolean; preferredPayment?: PaymentMethod }
    ): Promise<PreferencesUpdateRow> {
        const updated = await knex<User>('users')
            .where({id: userId})
            .update(
                {
                    newsletter_opt_in: data.newsletterOptIn,
                    preferred_payment: data.preferredPayment,
                },
                ['id', 'email', 'newsletter_opt_in', 'preferred_payment']
            );

        // Knex-Update mit returning(...) liefert hier ein Array
        return updated[0] as PreferencesUpdateRow;
    },

    async deleteUser(userId: number): Promise<void> {
        await knex<User>('users').where({id: userId}).delete();
    },

    async getAllUsers(): Promise<UserView[]> {
        const rows = await knex<User>('users').select('*');
        return rows.map(mapUserRow);
    },

    async getUserById(id: number): Promise<UserView> {
        const row = await knex<User>('users').where({id}).first();
        if (!row) {
            throw Object.assign(new Error('User not found'), {status: 404});
        }
        return mapUserRow(row);
    },

    async deleteUserTokens(userId: number): Promise<void> {
        await knex('refresh_tokens').where({user_id: userId}).delete();
    },

    async updateUser(id: number, updates: Partial<User>): Promise<UserView> {
        const allowedFields: (keyof User)[] = [
            'first_name',
            'last_name',
            'phone',
            'street',
            'house_number',
            'postal_code',
            'city',
            'state',
            'country',
            'role',
            'shipping_street',
            'shipping_house_number',
            'shipping_postal_code',
            'shipping_city',
            'shipping_state',
            'shipping_country',
            'preferred_payment',
            'newsletter_opt_in',
            'date_of_birth',
            'gender',
        ];

        const data: Partial<User> = {};

        for (const key of allowedFields) {
            const k = key as keyof User;
            const value = updates[k];

            if (value !== undefined) {
                // TS-sicheres Mapping: value ist User[k]
                (data as any)[k] = value;
            }
        }

        if (Object.keys(data).length === 0) {
            throw new Error('Keine gültigen Felder zum Aktualisieren');
        }

        await knex<User>('users').where({id}).update(data);

        const updated = await this.getUserById(id);
        if (!updated) {
            throw new Error('User not found after update');
        }

        return updated;
    },
};
