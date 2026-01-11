// backend/src/index.ts

import 'dotenv/config'; // Loads .env

import http from 'http';
import app from './app';
import logger from './utils/logger';
import { knex } from './database';
import { initWebsocket } from './middlewares/websocket';

const PORT = Number(process.env.PORT ?? 3000);
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const DB_CONNECT_RETRIES = Number(process.env.DB_CONNECT_RETRIES ?? 20);
const DB_RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS ?? 1000);

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startServer() {
    try {
        let connected = false;
        for (let attempt = 1; attempt <= DB_CONNECT_RETRIES; attempt += 1) {
            try {
                await knex.raw('SELECT 1 + 1 AS result');
                connected = true;
                break;
            } catch (error) {
                logger.warn(
                    `Database connection failed (attempt ${attempt}/${DB_CONNECT_RETRIES}).`,
                );
                if (attempt < DB_CONNECT_RETRIES) {
                    await delay(DB_RETRY_DELAY_MS);
                }
            }
        }

        if (!connected) {
            logger.error('Database connection failed after retries. Exiting.');
            process.exit(1);
        }

        logger.info('Database connection established');

        // HTTP server from Express app
        const server = http.createServer(app);

        // WebSocket (Socket.IO) on same server
        initWebsocket(server);

        server.listen(PORT, () => {
            logger.info(
                `Server listening on http://localhost:${PORT} [${NODE_ENV}]`,
            );
        });

        // Graceful Shutdown
        const shutdown = (signal: NodeJS.Signals) => {
            logger.info(`Received ${signal}, shutting down.`);

            server.close(() => {
                logger.info('HTTP server closed');

                knex
                    .destroy()
                    .then(() => {
                        logger.info('Database connection closed');
                        process.exit(0);
                    })
                    .catch((err) => {
                        logger.error('Error during DB shutdown', err);
                        process.exit(1);
                    });
            });
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    } catch (err) {
        logger.error('Failed to start application', err);
        process.exit(1);
    }
}

startServer();
