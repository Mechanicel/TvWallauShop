// backend/src/services/userService.ts
// Erweiterung um Shop-relevante Felder – minimal-invasiv

import { knex } from '../database';
import type { Knex } from 'knex';
import type { Gender, PaymentMethod, User as ApiUser, UserRole } from '@tvwallaushop/contracts';
import { User } from '../models/userModel';
import bcrypt from 'bcrypt';
import {formatDate} from '../utils/helpers';

export type UserView = ApiUser;

function mapUserRow(row: any): UserView {
    return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        isVerified: !!row.is_verified,
        createdAt: row.created_at ? row.created_at.toISOString() : '',

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

        preferredPayment: row.preferred_payment ?? 'invoice',
        newsletterOptIn: !!row.newsletter_opt_in,
        dateOfBirth: formatDate(row.date_of_birth),
        gender: row.gender,

        loyaltyPoints: row.loyalty_points ?? 0,
        lastLogin: row.last_login ? row.last_login.toISOString() : null,
        accountStatus: row.account_status ?? 'active',
    };
}

type PreferencesUpdateRow = {
    id: number;
    email: string;
    newsletter_opt_in: boolean;
    preferred_payment: PaymentMethod;
};

const getDb = (db?: Knex | Knex.Transaction) => db ?? knex;

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

    async getAllUsers(db?: Knex | Knex.Transaction): Promise<UserView[]> {
        const rows = await getDb(db)<User>('users').select('*');
        return rows.map(mapUserRow);
    },

    async getUserById(id: number, db?: Knex | Knex.Transaction): Promise<UserView> {
        const row = await getDb(db)<User>('users').where({ id }).first();
        if (!row) {
            throw Object.assign(new Error('User not found'), { status: 404 });
        }
        return mapUserRow(row);
    },

    async getUsersByIds(ids: number[], db?: Knex | Knex.Transaction): Promise<UserView[]> {
        if (ids.length === 0) return [];
        const rows = await getDb(db)<User>('users').whereIn('id', ids).select('*');
        return rows.map(mapUserRow);
    },

    async deleteUserTokens(userId: number): Promise<void> {
        await knex('refresh_tokens').where({user_id: userId}).delete();
    },

    async updateUser(id: number, updates: Partial<UserView>): Promise<UserView> {
        const fieldMap: Partial<Record<keyof UserView, keyof User>> = {
            firstName: 'first_name',
            lastName: 'last_name',
            phone: 'phone',
            street: 'street',
            houseNumber: 'house_number',
            postalCode: 'postal_code',
            city: 'city',
            state: 'state',
            country: 'country',
            role: 'role',
            shippingStreet: 'shipping_street',
            shippingHouseNumber: 'shipping_house_number',
            shippingPostalCode: 'shipping_postal_code',
            shippingCity: 'shipping_city',
            shippingState: 'shipping_state',
            shippingCountry: 'shipping_country',
            preferredPayment: 'preferred_payment',
            newsletterOptIn: 'newsletter_opt_in',
            dateOfBirth: 'date_of_birth',
            gender: 'gender',
            loyaltyPoints: 'loyalty_points',
            accountStatus: 'account_status',
        };

        const data: Partial<User> = {};

        for (const [key, dbKey] of Object.entries(fieldMap)) {
            const value = (updates as any)[key];
            if (value !== undefined) {
                (data as any)[dbKey as string] = value;
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
