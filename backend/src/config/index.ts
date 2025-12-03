// backend/src/index.ts

import 'dotenv/config';                // stellt sicher, dass .env eingelesen wird
import { config } from './env'; // stark typisierte Konfigurationswerte
import app from '../app';               // Express-App
import logger from '../utils/logger';   // zentraler Logger
import { knex } from '../database';     // Knex-DB-Verbindung

const PORT = config.port;

async function start() {
    try {
        // Prüfe DB-Verbindung
        await knex.raw('SELECT 1+1 AS result');
        logger.info('✅  Database connection established');

        // Starte HTTP-Server
        app.listen(PORT, () => {
            logger.info(`🚀  Server listening at http://localhost:${PORT} [mode=${config.nodeEnv}]`);
        });

        // Graceful shutdown
        process.on('SIGINT',   () => shutdown());
        process.on('SIGTERM',  () => shutdown());
    } catch (error: any) {
        logger.error('❌  Failed to start server:', error);
        process.exit(1);
    }
}

function shutdown() {
    logger.info('🛑  Shutting down server…');
    knex.destroy().finally(() => {
        logger.info('🛑  Database connection closed');
        process.exit(0);
    });
}

start();
