import { API_CONTRACT_VERSION } from '../../index';

export const orderOpenApi = {
    openapi: '3.0.3',
    info: {
        title: 'Order Service',
        version: API_CONTRACT_VERSION,
        description: 'Order lifecycle management and stock checks.',
    },
    servers: [{ url: '/api' }, { url: `/api/${API_CONTRACT_VERSION}` }],
    tags: [{ name: 'Orders' }],
    paths: {
        '/orders': {
            get: { tags: ['Orders'], summary: 'List orders' },
            post: { tags: ['Orders'], summary: 'Create order' },
        },
        '/orders/me': { get: { tags: ['Orders'], summary: 'List current user orders' } },
        '/orders/me/{id}/cancel': { post: { tags: ['Orders'], summary: 'Cancel current user order' } },
        '/orders/{id}': {
            get: { tags: ['Orders'], summary: 'Get order by id' },
            delete: { tags: ['Orders'], summary: 'Delete order (admin)' },
        },
        '/orders/{id}/status': { put: { tags: ['Orders'], summary: 'Update order status (admin)' } },
    },
} as const;
