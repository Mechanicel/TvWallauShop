// backend/src/index.ts

import 'dotenv/config'; // Lädt .env

import http from 'http';
import app from './app';
import logger from './utils/logger';
import { knex } from './database';
import { initWebsocket } from './middlewares/websocket';

const PORT = Number(process.env.PORT ?? 3000);
const NODE_ENV = process.env.NODE_ENV ?? 'development';

async function startServer() {
    try {
        // Teste Datenbank-Connection
        await knex.raw('SELECT 1 + 1 AS result');
        logger.info('✅ Database connection established');

        // HTTP-Server aus Express-App erstellen
        const server = http.createServer(app);

        // WebSocket (Socket.IO) an denselben Server hängen
        initWebsocket(server);

        server.listen(PORT, () => {
            logger.info(
                `🚀 Server listening on http://localhost:${PORT} [${NODE_ENV}]`,
            );
        });

        // Graceful Shutdown
        const shutdown = (signal: NodeJS.Signals) => {
            logger.info(`📥 Received ${signal}, shutting down…`);

            server.close(() => {
                logger.info('🛑 HTTP server closed');

                knex
                    .destroy()
                    .then(() => {
                        logger.info('🛑 Database connection closed');
                        process.exit(0);
                    })
                    .catch((err) => {
                        logger.error('❌ Error during DB shutdown', err);
                        process.exit(1);
                    });
            });
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    } catch (err) {
        logger.error('❌ Failed to start application', err);
        process.exit(1);
    }
}

startServer();
