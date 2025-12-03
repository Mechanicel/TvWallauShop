// backend/src/index.ts

import 'dotenv/config';                // Lädt .env
import { config } from './config/env';
import app from './app';
import logger from './utils/logger';
import { knex } from './database';

const PORT = config.port;

async function start() {
    try {
        // Teste Datenbank-Connection
        await knex.raw('SELECT 1+1 AS result');
        logger.info('✅ Database connection established');

        // Starte Server
        app.listen(PORT, () => {
            logger.info(`🚀 Server listening on http://localhost:${PORT} [${config.nodeEnv}]`);
        });

        // Graceful shutdown
        process.on('SIGINT',  shutdown);
        process.on('SIGTERM', shutdown);
    } catch (err: any) {
        logger.error('❌ Failed to start', err);
        process.exit(1);
    }
}

function shutdown() {
    logger.info('🛑 Shutting down…');
    knex.destroy().then(() => {
        logger.info('🛑 Database connection closed');
        process.exit(0);
    });
}

start();
