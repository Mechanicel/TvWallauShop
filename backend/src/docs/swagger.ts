import swaggerJSDoc from 'swagger-jsdoc';

import { API_CONTRACT_VERSION } from '../contracts';

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
        schemas: {
            ErrorResponse: {
                type: 'object',
                description: 'Standardized error response payload.',
                properties: {
                    code: {
                        type: 'string',
                        description: 'Optional machine-readable error code.',
                    },
                    message: {
                        type: 'string',
                        description: 'Human-readable error description.',
                    },
                    details: {
                        type: 'object',
                        description: 'Optional error details (only in non-production).',
                        additionalProperties: true,
                    },
                    stack: {
                        type: 'string',
                        description: 'Optional stack trace (only in non-production).',
                    },
                },
                required: ['message'],
            },
        },
        responses: {
            ErrorResponse: {
                description: 'Error response.',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/ErrorResponse',
                        },
                    },
                },
            },
        },
    },
};

const createSwaggerSpec = (
    info: { title: string; description: string; version?: string },
    apis: string[]
) =>
    swaggerJSDoc({
        definition: {
            ...baseDefinition,
            info: {
                ...info,
                version: info.version ?? API_CONTRACT_VERSION,
            },
            servers: [
                { url: '/api', description: 'Default API base' },
                { url: '/api/v1', description: 'Versioned API base' },
            ],
        },
        apis: withBuildPaths(apis),
    });

const sortSwaggerSpec = (spec: Record<string, any>) => {
    if (!spec?.paths) {
        return spec;
    }

    const sortedPaths = Object.keys(spec.paths)
        .sort()
        .reduce<Record<string, any>>((accumulator, pathKey) => {
            accumulator[pathKey] = spec.paths[pathKey];
            return accumulator;
        }, {});

    const sortedTags = Array.isArray(spec.tags)
        ? [...spec.tags].sort((left, right) => left.name.localeCompare(right.name))
        : spec.tags;

    return {
        ...spec,
        paths: sortedPaths,
        tags: sortedTags,
    };
};

export const gatewayOpenApi = createSwaggerSpec(
    {
        title: 'TV Wallau Shop Gateway API',
        description: 'Gateway documentation and service discovery endpoints.',
    },
    ['src/gateway/app.ts']
);

export const authOpenApi = createSwaggerSpec(
    {
        title: 'Auth/User API',
        description: 'Authentication and user management endpoints.',
    },
    ['src/routes/authRoutes.ts', 'src/routes/userRoutes.ts']
);

export const catalogOpenApi = createSwaggerSpec(
    {
        title: 'Catalog API',
        description: 'Product and catalog management endpoints.',
    },
    ['src/routes/productRoutes.ts']
);

export const orderOpenApi = createSwaggerSpec(
    {
        title: 'Orders API',
        description: 'Order creation and management endpoints.',
    },
    ['src/routes/orderRoutes.ts']
);

export const aiOpenApi = createSwaggerSpec(
    {
        title: 'AI/Media API',
        description: 'AI media processing and job management endpoints.',
    },
    ['src/routes/aiRoutes.ts']
);

export const allServicesOpenApi = sortSwaggerSpec(
    createSwaggerSpec(
        {
            title: 'TV Wallau Shop API',
            description: 'All service endpoints sorted in a single OpenAPI document.',
        },
        [
            'src/gateway/app.ts',
            'src/routes/authRoutes.ts',
            'src/routes/userRoutes.ts',
            'src/routes/productRoutes.ts',
            'src/routes/orderRoutes.ts',
            'src/routes/aiRoutes.ts',
        ]
    )
);
