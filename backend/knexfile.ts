// -----------------------------------------------------
//  KNEX CONFIG – READY FOR COPY & PASTE
// -----------------------------------------------------

// Lädt automatisch deine .env (beste Variante für knex)
import 'dotenv/config';
import type { Knex } from 'knex';

// 🔍 DEBUG: Zeigt beim Start genau an, auf welche DB zugegriffen wird
console.log("===========================================");
console.log("🔧 KNEX DEBUG – DB CONNECTION");
console.log("→ Host:", process.env.DB_HOST);
console.log("→ Port:", process.env.DB_PORT);
console.log("→ User:", process.env.DB_USER);
console.log("→ Database (Schema):", process.env.DB_NAME);
console.log("===========================================");

// -----------------------------------------------------
//  KNEX CONFIG EXPORT
// -----------------------------------------------------

const config: { [key: string]: Knex.Config } = {
    development: {
        client: 'mysql2',
        connection: {
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT || 3306),
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME, // ← exakt das Schema aus der .env
        },
        pool: {
            min: 0,
            max: 10,
        },
        migrations: {
            directory: './migrations',
            extension: 'ts',
            tableName: 'knex_migrations',
        },
        seeds: {
            directory: './seeds',
            extension: 'ts',
        },
    },

    // optional: prod config
    production: {
        client: 'mysql2',
        connection: {
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT || 3306),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        },
        migrations: {
            directory: './migrations',
            extension: 'ts',
            tableName: 'knex_migrations',
        },
        seeds: {
            directory: './seeds',
            extension: 'ts',
        },
    },
};

module.exports = config;
