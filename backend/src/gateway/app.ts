import express from 'express';
import swaggerUi from 'swagger-ui-express';

import { API_BASE_PATH, VERSIONED_API_BASE_PATH } from '../contracts';
import {
    aiOpenApi,
    allServicesOpenApi,
    authOpenApi,
    catalogOpenApi,
    gatewayOpenApi,
    orderOpenApi,
} from '../docs/swagger';
import { aiServiceApp, aiUploadsRouter } from '../services/ai/app';
import { authServiceApp } from '../services/auth/app';
import { catalogServiceApp } from '../services/catalog/app';
import { orderServiceApp } from '../services/order/app';

const gatewayApp = express.Router();

const serviceRouters = [authServiceApp, catalogServiceApp, orderServiceApp, aiServiceApp];

for (const basePath of [API_BASE_PATH, VERSIONED_API_BASE_PATH]) {
    for (const serviceRouter of serviceRouters) {
        gatewayApp.use(basePath, serviceRouter);
    }
}

gatewayApp.use('/uploads', aiUploadsRouter);

const docsRouter = express.Router();
const respondWithDocs = (
    req: express.Request,
    res: express.Response,
    spec: object,
    specPath: string,
    uiPath: string,
) => {
    if (req.accepts('html')) {
        const encodedSpecPath = encodeURIComponent(specPath);
        res.redirect(`${uiPath}?url=${encodedSpecPath}`);
        return;
    }

    res.json(spec);
};

/**
 * @openapi
 * /docs:
 *   get:
 *     tags: [Gateway]
 *     summary: Combined OpenAPI spec.
 *     description: Returns the OpenAPI specification containing all service endpoints.
 *     responses:
 *       200:
 *         description: Combined OpenAPI document.
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
docsRouter.get('/docs', (req, res) => {
    respondWithDocs(req, res, allServicesOpenApi, '/docs', '/docs/ui');
});
/**
 * @openapi
 * /docs/all:
 *   get:
 *     tags: [Gateway]
 *     summary: Combined OpenAPI spec.
 *     description: Returns the OpenAPI specification containing all service endpoints.
 *     responses:
 *       200:
 *         description: Combined OpenAPI document.
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
docsRouter.get('/docs/all', (req, res) => {
    respondWithDocs(req, res, allServicesOpenApi, '/docs/all', '/docs/ui');
});
/**
 * @openapi
 * /docs/auth:
 *   get:
 *     tags: [Gateway]
 *     summary: Auth/User service OpenAPI.
 *     description: Returns the OpenAPI specification for the auth service.
 *     responses:
 *       200:
 *         description: Auth service OpenAPI document.
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
docsRouter.get('/docs/auth', (req, res) => {
    respondWithDocs(req, res, authOpenApi, '/docs/auth', '/docs/ui');
});
/**
 * @openapi
 * /docs/catalog:
 *   get:
 *     tags: [Gateway]
 *     summary: Catalog service OpenAPI.
 *     description: Returns the OpenAPI specification for the catalog service.
 *     responses:
 *       200:
 *         description: Catalog service OpenAPI document.
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
docsRouter.get('/docs/catalog', (req, res) => {
    respondWithDocs(req, res, catalogOpenApi, '/docs/catalog', '/docs/ui');
});
/**
 * @openapi
 * /docs/orders:
 *   get:
 *     tags: [Gateway]
 *     summary: Orders service OpenAPI.
 *     description: Returns the OpenAPI specification for the orders service.
 *     responses:
 *       200:
 *         description: Orders service OpenAPI document.
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
docsRouter.get('/docs/orders', (req, res) => {
    respondWithDocs(req, res, orderOpenApi, '/docs/orders', '/docs/ui');
});
/**
 * @openapi
 * /docs/ai:
 *   get:
 *     tags: [Gateway]
 *     summary: AI/Media service OpenAPI.
 *     description: Returns the OpenAPI specification for the AI/media service.
 *     responses:
 *       200:
 *         description: AI service OpenAPI document.
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
docsRouter.get('/docs/ai', (req, res) => {
    respondWithDocs(req, res, aiOpenApi, '/docs/ai', '/docs/ui');
});
/**
 * @openapi
 * /docs/gateway:
 *   get:
 *     tags: [Gateway]
 *     summary: Gateway OpenAPI spec.
 *     description: Returns the OpenAPI specification for the gateway service.
 *     responses:
 *       200:
 *         description: Gateway OpenAPI document.
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
docsRouter.get('/docs/gateway', (req, res) => {
    respondWithDocs(req, res, gatewayOpenApi, '/docs/gateway', '/docs/ui/gateway');
});

docsRouter.use(
    '/docs/ui/auth',
    swaggerUi.serveFiles(authOpenApi),
    swaggerUi.setup(authOpenApi, {
        customSiteTitle: 'Auth/User API Docs',
        explorer: true,
    })
);
docsRouter.use(
    '/docs/ui/catalog',
    swaggerUi.serveFiles(catalogOpenApi),
    swaggerUi.setup(catalogOpenApi, {
        customSiteTitle: 'Catalog API Docs',
        explorer: true,
    })
);
docsRouter.use(
    '/docs/ui/orders',
    swaggerUi.serveFiles(orderOpenApi),
    swaggerUi.setup(orderOpenApi, {
        customSiteTitle: 'Orders API Docs',
        explorer: true,
    })
);
docsRouter.use(
    '/docs/ui/ai',
    swaggerUi.serveFiles(aiOpenApi),
    swaggerUi.setup(aiOpenApi, {
        customSiteTitle: 'AI/Media API Docs',
        explorer: true,
    })
);
docsRouter.use(
    '/docs/ui/gateway',
    swaggerUi.serveFiles(gatewayOpenApi),
    swaggerUi.setup(gatewayOpenApi, {
        customSiteTitle: 'Gateway API Docs',
        explorer: true,
    })
);
docsRouter.use(
    '/docs/ui',
    swaggerUi.serveFiles(allServicesOpenApi),
    swaggerUi.setup(allServicesOpenApi, {
        customSiteTitle: 'TV Wallau Shop API Docs (All Services)',
        explorer: true,
    })
);

gatewayApp.use(docsRouter);
gatewayApp.use(API_BASE_PATH, docsRouter);
gatewayApp.use(VERSIONED_API_BASE_PATH, docsRouter);

export default gatewayApp;
