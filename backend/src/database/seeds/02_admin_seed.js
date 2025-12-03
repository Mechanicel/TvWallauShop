// backend/src/database/seeds/02_admin_seed.js

const bcrypt = require('bcrypt');

exports.seed = async function (knex) {
    // 1) Bestehende User mit den Test-Emails löschen
    await knex('users')
        .whereIn('email', ['admin', 'kunde'])
        .del();

    // 2) Passwörter hashen
    const adminPassword = await bcrypt.hash('123', 10);
    const customerPassword = await bcrypt.hash('123', 10);

    // 3) Admin einfügen
    await knex('users').insert({
        first_name: 'Admin',
        last_name: 'User',
        email: 'admin@verein.de',
        password_hash: adminPassword,
        phone: null,
        role: 'admin',

        // Verifikation
        is_verified: true,
        verification_token: null,
        verification_expires: null,

        // Rechnungsadresse
        street: 'Hauptstraße',
        house_number: '1',
        postal_code: '12345',
        city: 'Wallau',
        state: 'Hessen',
        country: 'Deutschland',

        // Lieferadresse (gleich wie Rechnungsadresse)
        shipping_street: 'Hauptstraße',
        shipping_house_number: '1',
        shipping_postal_code: '12345',
        shipping_city: 'Wallau',
        shipping_state: 'Hessen',
        shipping_country: 'Deutschland',

        // Zahlungsinfos & Marketing
        preferred_payment: 'invoice',
        newsletter_opt_in: false,
        date_of_birth: null,
        gender: null,
    });

    // 4) Beispielkunde einfügen
    await knex('users').insert({
        first_name: 'Tom',
        last_name: 'Pinter',
        email: 'kunde@verein.de',
        password_hash: customerPassword,
        phone: '015783211100',
        role: 'customer',

        // Verifikation
        is_verified: true,
        verification_token: null,
        verification_expires: null,

        // Rechnungsadresse
        street: 'Musterweg',
        house_number: '5A',
        postal_code: '65439',
        city: 'Flörsheim',
        state: 'Hessen',
        country: 'Deutschland',

        // Lieferadresse (kann differenziert sein)
        shipping_street: 'Bahnhofstraße',
        shipping_house_number: '22',
        shipping_postal_code: '60311',
        shipping_city: 'Frankfurt am Main',
        shipping_state: 'Hessen',
        shipping_country: 'Deutschland',

        // Zahlungsinfos & Marketing
        preferred_payment: 'paypal',
        newsletter_opt_in: true,
        date_of_birth: '2000-05-15',
        gender: 'male',
    });
};
