// backend/src/routes/aiRoutes.ts

import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import * as productAiController from '../controllers/productAiController';

const router = Router();

// Basis-Pfad für KI-Uploads (Server-Dateisystem)
const uploadRoot = path.join(process.cwd(), 'uploads', 'ai', 'product-jobs');

// Multer-Storage konfigurieren (analog zu productRoutes)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdir(uploadRoot, { recursive: true }, (err) => {
            cb(err || null, uploadRoot);
        });
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '';
        const base = path.basename(file.originalname, ext);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${base}-${uniqueSuffix}${ext}`);
    },
});

const upload = multer({ storage });

router.post(
    '/product-job',
    authMiddleware,
    requireRole('admin'),
    upload.array('images', 10),
    productAiController.createProductAiJob
);

export default router;
