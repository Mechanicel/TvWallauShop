// backend/src/database.ts

import knexFactory from 'knex';
import { config } from './config/env';


export const knex = knexFactory({
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
        directory: './migrations'
    },
    seeds: {
        directory: './seeds'
    },
    postProcessResponse: (result) => {
    const convert = (row: any) => {
        if (row && Object.prototype.hasOwnProperty.call(row, 'is_verified')) {
            row.is_verified = !!row.is_verified;
        }
        return row;
    };

    if (Array.isArray(result)) {
        return result.map(convert);
    }
    return convert(result);
}});
