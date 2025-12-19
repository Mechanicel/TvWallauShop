// backend/src/app.ts
// Zentrale Express-App, alle Routen sauber eingebunden

import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';

import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import productRoutes from './routes/productRoutes';
import orderRoutes from './routes/orderRoutes';
import aiRoutes from './routes/aiRoutes';
import { errorHandler } from './middlewares/errorHandler';

const ENABLE_ROUTE_LOGS = process.env.ENABLE_ROUTE_LOGS === 'true';
const DEBUG_ROUTES = process.env.DEBUG_ROUTES === 'true';

const app = express();

// --------------------
// 🛠 Middlewares
// --------------------
app.use(express.json());
app.use(cookieParser());

if (ENABLE_ROUTE_LOGS) {
    app.use(morgan('dev'));
}


app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
});

// --------------------
// 🔑 Auth Routes (public)
// --------------------
app.use('/api/auth', authRoutes);

// --------------------
// 👥 User Routes (protected)
// --------------------
app.use('/api/users', userRoutes);

// --------------------
// 🛒 Product Routes (public + admin-protected)
// --------------------
app.use('/api/products', productRoutes);

// >>> Statische Auslieferung der Uploads
const uploadsPath = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));

// --------------------
// 📦 Order Routes (protected)
// --------------------
app.use('/api/orders', orderRoutes);

// --------------------
// 🤖 AI Routes
// --------------------
app.use('/api/ai', aiRoutes);

// --------------------
// ⚙️ Debug Routes
// --------------------
if (DEBUG_ROUTES) {
    app.get('/api/debug/ping', (req, res) => {
        res.json({ status: 'ok', env: process.env.NODE_ENV });
    });

    app.get('/api/debug/routes', (req, res) => {
        const routes: string[] = [];
        // @ts-ignore – Express intern
        app._router.stack.forEach((middleware: any) => {
            if (middleware.route) {
                routes.push(
                    `${Object.keys(middleware.route.methods)
                        .join(',')
                        .toUpperCase()} ${middleware.route.path}`,
                );
            } else if (middleware.name === 'router') {
                middleware.handle.stack.forEach((handler: any) => {
                    if (handler.route) {
                        routes.push(
                            `${Object.keys(handler.route.methods)
                                .join(',')
                                .toUpperCase()} ${handler.route.path}`,
                        );
                    }
                });
            }
        });
        res.json(routes);
    });
}

// --------------------
// 🚨 Error Handler
// --------------------
app.use(errorHandler);

export default app;
