import knexFactory from 'knex';

export const knex = knexFactory({
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    },
    pool: { min: 2, max: 10 },

    // Konvertierung für booleans – deine custom logic
    postProcessResponse: (result) => {
        const convert = (row: any) => {
            if (row && Object.prototype.hasOwnProperty.call(row, 'is_verified')) {
                row.is_verified = !!row.is_verified;
            }
            return row;
        };

        if (Array.isArray(result)) return result.map(convert);
        return convert(result);
    },
});
