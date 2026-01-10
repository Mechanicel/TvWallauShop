import { API_CONTRACT_VERSION } from '../../index';

export const catalogOpenApi = {
    openapi: '3.0.3',
    info: {
        title: 'Catalog Service',
        version: API_CONTRACT_VERSION,
        description: 'Product catalog, images, and tags.',
    },
    servers: [{ url: '/api' }, { url: `/api/${API_CONTRACT_VERSION}` }],
    tags: [{ name: 'Products' }],
    paths: {
        '/products': {
            get: { tags: ['Products'], summary: 'List products' },
            post: { tags: ['Products'], summary: 'Create product (admin)' },
        },
        '/products/{id}': {
            get: { tags: ['Products'], summary: 'Get product by id' },
            put: { tags: ['Products'], summary: 'Update product (admin)' },
            delete: { tags: ['Products'], summary: 'Delete product (admin)' },
        },
        '/products/{id}/images': {
            post: { tags: ['Products'], summary: 'Upload product images (admin)' },
        },
        '/products/{id}/images/{imageId}': {
            delete: { tags: ['Products'], summary: 'Delete product image (admin)' },
        },
    },
} as const;
