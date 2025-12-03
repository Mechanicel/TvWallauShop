// backend/src/routes/productRoutes.ts

import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import * as productController from '../controllers/productController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';

const router = Router();

// Basis-Pfad für Uploads (Server-Dateisystem)
const uploadRoot = path.join(process.cwd(), 'uploads', 'products');

// Multer-Storage konfigurieren
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const productId = req.params.id || 'unknown';
        const productDir = path.join(uploadRoot, String(productId));
        fs.mkdirSync(productDir, { recursive: true });
        cb(null, productDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const safeOriginalName = file.originalname.replace(/\s+/g, '_');
        cb(null, `${timestamp}-${safeOriginalName}`);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 15 * 1024 * 1024, // 15 MB pro Datei
        files: 10,
    },
});

// Öffentlich: Produkte lesen
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// Admin: CRUD für Produkte
router.post(
    '/',
    authMiddleware,
    requireRole('admin'),
    productController.createProduct
);

router.put(
    '/:id',
    authMiddleware,
    requireRole('admin'),
    productController.updateProduct
);

router.delete(
    '/:id',
    authMiddleware,
    requireRole('admin'),
    productController.deleteProduct
);

// Bilder hochladen
router.post(
    '/:id/images',
    authMiddleware,
    requireRole('admin'),
    upload.array('images', 10),
    productController.uploadProductImages
);

// 👇 NEU: Bild löschen
// DELETE /api/products/:id/images/:imageId
router.delete(
    '/:id/images/:imageId',
    authMiddleware,
    requireRole('admin'),
    productController.deleteProductImage
);

export default router;
