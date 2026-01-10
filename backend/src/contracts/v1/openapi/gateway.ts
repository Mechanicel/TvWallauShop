import { API_CONTRACT_VERSION } from '../../index';

export const gatewayOpenApi = {
    openapi: '3.0.3',
    info: {
        title: 'API Gateway',
        version: API_CONTRACT_VERSION,
        description: 'Single entry point routing to bounded context services.',
    },
    servers: [{ url: '/api' }, { url: `/api/${API_CONTRACT_VERSION}` }],
    tags: [{ name: 'Gateway' }],
    paths: {
        '/docs': { get: { tags: ['Gateway'], summary: 'Gateway API documentation index' } },
        '/docs/auth': { get: { tags: ['Gateway'], summary: 'Auth/User service OpenAPI' } },
        '/docs/catalog': { get: { tags: ['Gateway'], summary: 'Catalog service OpenAPI' } },
        '/docs/orders': { get: { tags: ['Gateway'], summary: 'Order service OpenAPI' } },
        '/docs/ai': { get: { tags: ['Gateway'], summary: 'AI/Media service OpenAPI' } },
    },
} as const;
