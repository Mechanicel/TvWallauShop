import { Knex } from 'knex';
import * as bcrypt from 'bcrypt';


export async function seed(knex: Knex): Promise<void> {
    // 1. Bestehende Daten in richtiger Reihenfolge löschen (FKs!)
    await knex('product_ai_jobs').del();
    await knex('product_tags').del();
    await knex('tags').del();
    await knex('product_images').del();
    await knex('order_items').del();
    await knex('orders').del();
    await knex('refresh_tokens').del();
    await knex('product_sizes').del();
    await knex('sizes').del();
    await knex('products').del();
    await knex('users').del();

    // 2. Passwörter hashen
    const plainPassword = 'Password123';
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // 3. Users anlegen (mit gehashtem Passwort)
    await knex('users').insert([
        {
            first_name: 'Admin',
            last_name: 'Verein',
            email: 'admin@verein.de',
            password_hash: passwordHash,
            role: 'admin',
            is_verified: true,
            newsletter_opt_in: false,
        },
        {
            first_name: 'Max',
            last_name: 'Mustermann',
            email: 'kunde@verein.de',
            password_hash: passwordHash,
            role: 'customer',
            is_verified: true,
            newsletter_opt_in: true,
            street: 'Musterstraße',
            house_number: '1',
            postal_code: '12345',
            city: 'Wallau',
            country: 'Deutschland',
        },
    ]);

    const admin = await knex('users')
        .where({ email: 'admin@verein.de' })
        .first();
    const customer = await knex('users')
        .where({ email: 'kunde@verein.de' })
        .first();

    if (!admin || !customer) {
        throw new Error('Seed: Admin oder Kunde konnte nicht geladen werden.');
    }
}
