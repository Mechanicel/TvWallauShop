import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('product_ai_jobs', (table) => {
        table
            .enu('status', ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'FINALIZED'])
            .notNullable()
            .defaultTo('PENDING')
            .alter();
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('product_ai_jobs', (table) => {
        table
            .enu('status', ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'])
            .notNullable()
            .defaultTo('PENDING')
            .alter();
    });
}
