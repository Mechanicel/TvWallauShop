export const API_CONTRACT_VERSION = 'v1';
export const API_BASE_PATH = '/api';
export const VERSIONED_API_BASE_PATH = `${API_BASE_PATH}/${API_CONTRACT_VERSION}`;

const DEFAULT_API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:3000';

export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ?? `${DEFAULT_API_ORIGIN}${VERSIONED_API_BASE_PATH}`;
