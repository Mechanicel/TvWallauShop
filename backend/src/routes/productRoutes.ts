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
/**
 * @openapi
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: List all products.
 *     responses:
 *       200:
 *         description: Product list.
 */
router.get('/', productController.getAllProducts);
/**
 * @openapi
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get product by id.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product details.
 */
router.get('/:id', productController.getProductById);

// Admin: CRUD für Produkte
/**
 * @openapi
 * /products:
 *   post:
 *     tags: [Products]
 *     summary: Create a new product.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Product created.
 */
router.post(
    '/',
    authMiddleware,
    requireRole('admin'),
    productController.createProduct
);

/**
 * @openapi
 * /products/{id}:
 *   put:
 *     tags: [Products]
 *     summary: Update a product.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Product updated.
 */
router.put(
    '/:id',
    authMiddleware,
    requireRole('admin'),
    productController.updateProduct
);

/**
 * @openapi
 * /products/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Delete a product.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Product deleted.
 */
router.delete(
    '/:id',
    authMiddleware,
    requireRole('admin'),
    productController.deleteProduct
);

// Bilder hochladen
/**
 * @openapi
 * /products/{id}/images:
 *   post:
 *     tags: [Products]
 *     summary: Upload product images.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Images uploaded.
 */
router.post(
    '/:id/images',
    authMiddleware,
    requireRole('admin'),
    upload.array('images', 10),
    productController.uploadProductImages
);

// 👇 NEU: Bild löschen
// DELETE /api/products/:id/images/:imageId
/**
 * @openapi
 * /products/{id}/images/{imageId}:
 *   delete:
 *     tags: [Products]
 *     summary: Delete a product image.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Image deleted.
 */
router.delete(
    '/:id/images/:imageId',
    authMiddleware,
    requireRole('admin'),
    productController.deleteProductImage
);

export default router;
