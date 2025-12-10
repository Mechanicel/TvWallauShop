import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    // USERS
    await knex.schema.createTable('users', (table) => {
        table.increments('id').primary();
        table.string('first_name', 100).notNullable();
        table.string('last_name', 100).notNullable();
        table.string('email', 255).notNullable();
        table.string('password_hash', 255).notNullable();
        table.string('phone', 20).nullable();
        table.enu('role', ['customer', 'admin']).notNullable().defaultTo('customer');

        table.boolean('is_verified').notNullable().defaultTo(false);
        table.string('verification_token', 255).nullable();
        table.dateTime('verification_expires').nullable();

        table.string('street', 255).nullable();
        table.string('house_number', 20).nullable();
        table.string('postal_code', 20).nullable();
        table.string('city', 100).nullable();
        table.string('state', 100).nullable();
        table.string('country', 100).nullable();

        table.string('shipping_street', 255).nullable();
        table.string('shipping_house_number', 20).nullable();
        table.string('shipping_postal_code', 20).nullable();
        table.string('shipping_city', 100).nullable();
        table.string('shipping_state', 100).nullable();
        table.string('shipping_country', 100).nullable();

        table
            .enu('preferred_payment', ['invoice', 'paypal', 'creditcard', 'banktransfer'])
            .defaultTo('invoice');

        table.boolean('newsletter_opt_in').notNullable().defaultTo(false);
        table.date('date_of_birth').nullable();
        table.enu('gender', ['male', 'female', 'other']).nullable();

        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

        table.unique(['email'], 'uq_users_email');
    });

    // PRODUCTS
    await knex.schema.createTable('products', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.text('description').nullable();
        table.decimal('price', 10, 2).notNullable();
        table.string('image_url', 512).nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });

    // SIZES
    await knex.schema.createTable('sizes', (table) => {
        table.increments('id').primary();
        table.string('label', 50).notNullable().unique();
    });

    // PRODUCT_SIZES
    await knex.schema.createTable('product_sizes', (table) => {
        table
            .integer('product_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('products')
            .onDelete('CASCADE');

        table
            .integer('size_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('sizes')
            .onDelete('CASCADE');

        table.integer('stock').notNullable().defaultTo(0);

        table.primary(['product_id', 'size_id']);
    });

    // ORDERS
    await knex.schema.createTable('orders', (table) => {
        table.increments('id').primary();
        table
            .integer('user_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('users');
        table
            .enu('status', ['Bestellt', 'Bezahlt', 'Storniert'])
            .notNullable()
            .defaultTo('Bestellt');
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });

    // ORDER_ITEMS
    await knex.schema.createTable('order_items', (table) => {
        table
            .integer('order_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('orders')
            .onDelete('CASCADE');

        table
            .integer('product_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('products')
            .onDelete('RESTRICT');

        table
            .integer('size_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('sizes')
            .onDelete('RESTRICT');

        table.integer('quantity').notNullable();
        table.decimal('price', 10, 2).notNullable();

        table.primary(['order_id', 'product_id', 'size_id']);
    });

    // REFRESH_TOKENS
    await knex.schema.createTable('refresh_tokens', (table) => {
        table.increments('id').primary();
        table
            .integer('user_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('users')
            .onDelete('CASCADE');
        table.string('token', 512).notNullable();
        table.dateTime('expires_at').notNullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });

    // PRODUCT_IMAGES
    await knex.schema.createTable('product_images', (table) => {
        table.increments('id').primary();
        table
            .integer('product_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('products')
            .onDelete('CASCADE');
        table.string('url', 512).notNullable();
        table.integer('sort_order').notNullable().defaultTo(0);
        table.boolean('is_primary').notNullable().defaultTo(false);
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });

    // TAGS
    await knex.schema.createTable('tags', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable().unique();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });

    // PRODUCT_TAGS
    await knex.schema.createTable('product_tags', (table) => {
        table
            .integer('product_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('products')
            .onDelete('CASCADE');
        table
            .integer('tag_id')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('tags')
            .onDelete('CASCADE');

        table.primary(['product_id', 'tag_id']);
    });

    // PRODUCT_AI_JOBS
    await knex.schema.createTable('product_ai_jobs', (table) => {
        table.increments('id').primary();

        table
            .integer('product_id')
            .unsigned()
            .nullable()
            .references('id')
            .inTable('products')
            .onDelete('SET NULL');

        // JSON als Text speichern
        table.text('image_paths').notNullable();
        table.decimal('price', 10, 2).notNullable();

        table
            .enu('status', ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'])
            .notNullable()
            .defaultTo('PENDING');

        table.string('result_display_name', 255).nullable();
        table.text('result_description').nullable();
        table.text('result_tags').nullable();
        table.text('error_message').nullable();

        // Nur EIN Timestamp mit Default auf CURRENT_TIMESTAMP
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').nullable(); // kein Default → MariaDB happy
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('product_ai_jobs');
    await knex.schema.dropTableIfExists('product_tags');
    await knex.schema.dropTableIfExists('tags');
    await knex.schema.dropTableIfExists('product_images');
    await knex.schema.dropTableIfExists('refresh_tokens');
    await knex.schema.dropTableIfExists('order_items');
    await knex.schema.dropTableIfExists('orders');
    await knex.schema.dropTableIfExists('product_sizes');
    await knex.schema.dropTableIfExists('sizes');
    await knex.schema.dropTableIfExists('products');
    await knex.schema.dropTableIfExists('users');
}
