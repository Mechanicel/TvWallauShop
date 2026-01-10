import express from 'express';
import swaggerUi from 'swagger-ui-express';

import { API_BASE_PATH, VERSIONED_API_BASE_PATH } from '../contracts';
import { aiOpenApi, authOpenApi, catalogOpenApi, gatewayOpenApi, orderOpenApi } from '../contracts/v1/openapi';
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
    uiPath: string,
) => {
    if (req.accepts('html')) {
        res.redirect(uiPath);
        return;
    }

    res.json(spec);
};

docsRouter.get('/docs', (req, res) => {
    respondWithDocs(req, res, gatewayOpenApi, '/docs/ui');
});
docsRouter.get('/docs/auth', (req, res) => {
    respondWithDocs(req, res, authOpenApi, '/docs/ui/auth');
});
docsRouter.get('/docs/catalog', (req, res) => {
    respondWithDocs(req, res, catalogOpenApi, '/docs/ui/catalog');
});
docsRouter.get('/docs/orders', (req, res) => {
    respondWithDocs(req, res, orderOpenApi, '/docs/ui/orders');
});
docsRouter.get('/docs/ai', (req, res) => {
    respondWithDocs(req, res, aiOpenApi, '/docs/ui/ai');
});

docsRouter.use(
    '/docs/ui',
    swaggerUi.serveFiles(gatewayOpenApi),
    swaggerUi.setup(gatewayOpenApi, {
        customSiteTitle: 'TV Wallau Shop API Docs',
        explorer: true,
    })
);
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

gatewayApp.use(docsRouter);
gatewayApp.use(API_BASE_PATH, docsRouter);
gatewayApp.use(VERSIONED_API_BASE_PATH, docsRouter);

export default gatewayApp;
