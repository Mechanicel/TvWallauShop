export const API_CONTRACT_VERSION = 'v1';
export const API_BASE_PATH = '/api';
export const VERSIONED_API_BASE_PATH = `${API_BASE_PATH}/${API_CONTRACT_VERSION}`;

export const SERVICE_IDS = {
    auth: 'auth-user',
    catalog: 'catalog',
    order: 'order',
    aiMedia: 'ai-media',
} as const;
