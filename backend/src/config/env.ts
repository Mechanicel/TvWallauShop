// backend/src/config/env.ts

import dotenv from 'dotenv';
import path from 'path';

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Helper to read required env vars
function getEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key] ?? defaultValue;
    if (value === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

// Parse integer with error on NaN
function parseIntEnv(key: string, defaultValue?: number): number {
    const str = getEnvVar(key, defaultValue?.toString());
    const num = parseInt(str!, 10);
    if (isNaN(num)) {
        throw new Error(`Environment variable ${key} is not a valid number: ${str}`);
    }
    return num;
}

export interface EnvConfig {
    nodeEnv: 'development' | 'production' | 'test';
    port: number;

    db: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    };

    jwt: {
        secret: string;
        refreshSecret: string;
        accessTokenExpiresIn: string;
        refreshTokenExpiresIn: string;
    };

    smtp: {
        host: string;
        port: number;
        user: string;
        pass: string;
    };
}

export const config: EnvConfig = {
    nodeEnv: getEnvVar('NODE_ENV') as 'development' | 'production' | 'test',
    port: parseIntEnv('PORT'),

    db: {
        host: getEnvVar('DB_HOST'),
        port: parseIntEnv('DB_PORT'),
        user: getEnvVar('DB_USER'),
        password: getEnvVar('DB_PASS'),
        database: getEnvVar('DB_NAME'),
    },

    jwt: {
        secret: getEnvVar('JWT_SECRET'),
        refreshSecret: getEnvVar('JWT_REFRESH_SECRET'),
        accessTokenExpiresIn: getEnvVar('ACCESS_TOKEN_EXPIRES_IN'),
        refreshTokenExpiresIn: getEnvVar('REFRESH_TOKEN_EXPIRES_IN'),
    },

    smtp: {
        host: getEnvVar('SMTP_HOST'),
        port: parseIntEnv('SMTP_PORT'),
        user: getEnvVar('SMTP_USER'),
        pass: getEnvVar('SMTP_PASS'),
    },
};
