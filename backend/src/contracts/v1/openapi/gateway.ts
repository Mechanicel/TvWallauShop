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
        '/docs/ui': { get: { tags: ['Gateway'], summary: 'Gateway Swagger UI' } },
        '/docs/ui/auth': { get: { tags: ['Gateway'], summary: 'Auth/User Swagger UI' } },
        '/docs/ui/catalog': { get: { tags: ['Gateway'], summary: 'Catalog Swagger UI' } },
        '/docs/ui/orders': { get: { tags: ['Gateway'], summary: 'Orders Swagger UI' } },
        '/docs/ui/ai': { get: { tags: ['Gateway'], summary: 'AI/Media Swagger UI' } },
    },
} as const;
