// backend/src/database/seeds/01_seed_data.js

const bcrypt = require('bcrypt');

exports.seed = async function (knex) {
    // 0) Bestehende Daten löschen (in umgekehrter FK-Reihenfolge)
    await knex('refresh_tokens').del();
    await knex('order_items').del();
    await knex('orders').del();
    await knex('product_sizes').del();
    await knex('products').del();
    await knex('sizes').del();
    await knex('users').del();

    // 1) Größen anlegen
    await knex('sizes').insert([
        { label: 'S' },
        { label: 'M' },
        { label: 'L' },
        { label: 'XL' },
    ]);

    // 2) Produkte anlegen
    await knex('products').insert([
        {
            name: 'T-Shirt Vereinslogo',
            description: 'Schickes T-Shirt mit unserem Vereinslogo',
            price: 19.9,
            image_url: '',
        },
        {
            name: 'Hoodie Vereinslogo',
            description: 'Kuscheliger Hoodie mit Vereinslogo',
            price: 39.9,
            image_url: '',
        },
        {
            name: 'Cap Vereinslogo',
            description: 'Coole Cap mit Stickerei',
            price: 14.9,
            image_url: '',
        },
    ]);

    // 3) Lagerbestand für alle Kombinationen initialisieren (stock = 20)
    await knex.raw(`
    INSERT INTO product_sizes (product_id, size_id, stock)
    SELECT p.id, s.id, 20
    FROM products p
    CROSS JOIN sizes s;
  `);

    // 4) Benutzer (Admin und Kunde) anlegen – mit echtem bcrypt-Hash
    const pwHash = bcrypt.hashSync('Password123', 10);
    await knex('users').insert([
        { email: 'admin@verein.de', password_hash: pwHash, role: 'admin' },
        { email: 'kunde@verein.de', password_hash: pwHash, role: 'customer' },
    ]);

    // 5) Beispiel-Bestellung für den Kunden
    const customer = await knex('users')
        .where({ email: 'kunde@verein.de' })
        .first('id');
    const [orderId] = await knex('orders').insert({
        user_id: customer.id,
        status: 'Bestellt',
    });

    // 6) Bestellposition (2× T-Shirt, Größe M)
    const product = await knex('products')
        .where({ name: 'T-Shirt Vereinslogo' })
        .first('id', 'price');
    const size = await knex('sizes')
        .where({ label: 'M' })
        .first('id');
    await knex('order_items').insert({
        order_id: orderId,
        product_id: product.id,
        size_id: size.id,
        quantity: 2,
        price: product.price,
    });

    // 7) Beispiel-Refresh-Tokens für den Kunden (7 Tage gültig)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await knex('refresh_tokens').insert([
        {
            user_id: customer.id,
            token: 'sample-refresh-token-1',
            expires_at: expiresAt,
        },
        {
            user_id: customer.id,
            token: 'sample-refresh-token-2',
            expires_at: expiresAt,
        },
    ]);
};
