// backend/knexfile.ts

import type { Knex } from 'knex';
import { config } from './src/config/env';

const base: Knex.Config = {
    client: 'mysql2',
    connection: {
        host:     config.db.host,
        port:     config.db.port,
        user:     config.db.user,
        password: config.db.password,
        database: config.db.database
    },
    pool: { min: 2, max: 10 },
    migrations: {
        directory: './migrations',
        extension: 'ts'
    },
    seeds: {
        directory: './seeds',
        extension: 'ts'
    }
};

const knexConfig: { [key: string]: Knex.Config } = {
    development: base,
    production:  { ...base, pool: { min: 2, max: 20 } }
};

export default knexConfig;
