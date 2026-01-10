import { API_CONTRACT_VERSION } from '../../index';

export const aiOpenApi = {
    openapi: '3.0.3',
    info: {
        title: 'AI/Media Service',
        version: API_CONTRACT_VERSION,
        description: 'AI-driven product job processing and media uploads.',
    },
    servers: [{ url: '/api' }, { url: `/api/${API_CONTRACT_VERSION}` }],
    tags: [{ name: 'AI Jobs' }],
    paths: {
        '/ai/product-job': { post: { tags: ['AI Jobs'], summary: 'Create AI product job (admin)' } },
        '/ai/product-job/{id}/retry': { post: { tags: ['AI Jobs'], summary: 'Retry failed job (admin)' } },
        '/ai/product-jobs/open': { get: { tags: ['AI Jobs'], summary: 'List open AI jobs (admin)' } },
        '/ai/product-job/{id}': { delete: { tags: ['AI Jobs'], summary: 'Delete AI job (admin)' } },
    },
} as const;
