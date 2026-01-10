import swaggerJSDoc from 'swagger-jsdoc';

const withBuildPaths = (apis: string[]) => {
    const buildPaths = apis.map((api) => api.replace(/^src\//, 'dist/').replace(/\.ts$/, '.js'));
    return [...new Set([...apis, ...buildPaths])];
};

const baseDefinition = {
    openapi: '3.0.3',
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
    },
};

const createSwaggerSpec = (
    info: { title: string; description: string; version: string },
    apis: string[]
) =>
    swaggerJSDoc({
        definition: {
            ...baseDefinition,
            info,
            servers: [
                { url: '/api', description: 'Default API base' },
                { url: '/api/v1', description: 'Versioned API base' },
            ],
        },
        apis: withBuildPaths(apis),
    });

export const gatewayOpenApi = createSwaggerSpec(
    {
        title: 'TV Wallau Shop Gateway API',
        description: 'Gateway documentation and service discovery endpoints.',
        version: '1.0.0',
    },
    ['src/gateway/app.ts']
);

export const authOpenApi = createSwaggerSpec(
    {
        title: 'Auth/User API',
        description: 'Authentication and user management endpoints.',
        version: '1.0.0',
    },
    ['src/routes/authRoutes.ts', 'src/routes/userRoutes.ts']
);

export const catalogOpenApi = createSwaggerSpec(
    {
        title: 'Catalog API',
        description: 'Product and catalog management endpoints.',
        version: '1.0.0',
    },
    ['src/routes/productRoutes.ts']
);

export const orderOpenApi = createSwaggerSpec(
    {
        title: 'Orders API',
        description: 'Order creation and management endpoints.',
        version: '1.0.0',
    },
    ['src/routes/orderRoutes.ts']
);

export const aiOpenApi = createSwaggerSpec(
    {
        title: 'AI/Media API',
        description: 'AI media processing and job management endpoints.',
        version: '1.0.0',
    },
    ['src/routes/aiRoutes.ts']
);
