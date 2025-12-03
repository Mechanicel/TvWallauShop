// backend/src/utils/logger.ts

import { createLogger, format, transports } from 'winston';
const { combine, timestamp, printf, colorize, errors } = format;

// Custom log format: "[TIMESTAMP] [LEVEL]: message or stack"
const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),  // include stack trace
        logFormat
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/app.log', handleExceptions: true })
    ],
    exitOnError: false
});

export default logger;
