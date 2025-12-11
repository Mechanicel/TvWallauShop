// backend/src/controllers/productAiController.ts

import { Request, Response } from 'express';
import { catchAsync } from '../utils/helpers';
import { productAiService } from '../services/productAiService';

/**
 * POST /api/ai/product-job
 *
 * Erwartet:
 *  - multipart/form-data
 *      - price: number
 *      - images[]: Dateien (mind. 1)
 *
 * Validiert Eingaben, delegiert die eigentliche Logik an den Service
 * und gibt den gespeicherten product_ai_jobs-Datensatz zurück.
 */
export const createProductAiJob = catchAsync(
    async (req: Request, res: Response) => {
        const useRealService =
            process.env.AI_PRODUCT_AI_USE_REAL_SERVICE === 'true';

        const files = (req.files as Express.Multer.File[]) || [];
        const rawPrice = (req.body?.price ?? '').toString();
        const price = Number(rawPrice) || 0;

        const job = await productAiService.createProductAiJob({
            price,
            files,
            useRealService,
        });

        res.status(201).json(job);
    }
);
