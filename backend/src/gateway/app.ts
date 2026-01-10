import express from 'express';

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
docsRouter.get('/docs', (_req, res) => {
    res.json(gatewayOpenApi);
});
docsRouter.get('/docs/auth', (_req, res) => {
    res.json(authOpenApi);
});
docsRouter.get('/docs/catalog', (_req, res) => {
    res.json(catalogOpenApi);
});
docsRouter.get('/docs/orders', (_req, res) => {
    res.json(orderOpenApi);
});
docsRouter.get('/docs/ai', (_req, res) => {
    res.json(aiOpenApi);
});

gatewayApp.use(docsRouter);
gatewayApp.use(API_BASE_PATH, docsRouter);
gatewayApp.use(VERSIONED_API_BASE_PATH, docsRouter);

export default gatewayApp;
