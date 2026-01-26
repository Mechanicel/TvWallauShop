// backend/src/utils/storage.ts

import path from 'path';

const UPLOADS_PREFIX = 'uploads/';

function normalizePath(value: string): string {
    return value.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function parseStorageKey(value: string): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    let pathValue = trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
            const url = new URL(trimmed);
            pathValue = url.pathname;
        } catch {
            return null;
        }
    }

    const normalized = normalizePath(pathValue);

    if (normalized.startsWith(UPLOADS_PREFIX)) {
        return normalized.slice(UPLOADS_PREFIX.length);
    }

    if (normalized.startsWith('ai/') || normalized.startsWith('products/')) {
        return normalized;
    }

    return null;
}

export function normalizeStorageValue(value: string): string {
    const key = parseStorageKey(value);
    return key ?? value.trim();
}

export function storageKeyToPublicUrl(value: string): string {
    const key = parseStorageKey(value);
    if (!key) return value;
    return `/uploads/${key}`;
}

export function storageKeyFromAbsolutePath(absolutePath: string): string {
    const relative = path.relative(process.cwd(), absolutePath);
    return normalizePath(relative).replace(/^uploads\//, '');
}

export function storageKeyToAbsolutePath(storageKey: string): string {
    const key = parseStorageKey(storageKey);
    if (!key) {
        throw new Error(`Invalid storage key: ${storageKey}`);
    }
    return path.join(process.cwd(), 'uploads', key);
}

export function sanitizeFilenameBase(value: string): string {
    const cleaned = value
        .normalize('NFKD')
        .replace(/[^\w.-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();

    return cleaned || 'file';
}
