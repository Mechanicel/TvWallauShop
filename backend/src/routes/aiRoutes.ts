// backend/src/routes/aiRoutes.ts

import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import * as productAiController from '../controllers/productAiController';

const router = Router();

// Für den ersten Test speichern wir die Bilder nicht auf der Platte,
// sondern halten sie nur im Speicher. Später kann hier ein diskStorage
// analog zu den Produktbildern verwendet werden.
const upload = multer({
    storage: multer.memoryStorage(),
});

router.post(
    '/product-job',
    authMiddleware,
    requireRole('admin'),
    upload.array('images', 10),
    productAiController.createProductAiJob
);

export default router;
