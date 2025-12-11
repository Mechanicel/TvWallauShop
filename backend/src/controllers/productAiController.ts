// backend/src/controllers/productAiController.ts

import { Request, Response } from 'express';
import { catchAsync } from '../utils/helpers';
import {ProductAiJobResponse} from "../models/productModel";



/**
 * POST /api/ai/product-job
 *
 * Erwartet:
 *  - multipart/form-data
 *      - price: number
 *      - images[]: Dateien (mind. 1)
 *
 * Aktuell: Kein echter KI-Service, sondern Mock-Daten, solange
 * AI_PRODUCT_AI_USE_REAL_SERVICE !== "true" ist.
 */
export const createProductAiJob = catchAsync(
    async (req: Request, res: Response) => {
        const useRealService =
            process.env.AI_PRODUCT_AI_USE_REAL_SERVICE === 'true';

        const files = (req.files as Express.Multer.File[]) || [];
        const rawPrice = (req.body?.price ?? '').toString();
        const price = Number(rawPrice) || 0;

        if (!useRealService) {
            // 🔧 Mock-Response für erste Tests im Frontend
            const now = new Date().toISOString();

            const mockJob: ProductAiJobResponse = {
                id: 0,
                product_id: null,
                status: 'SUCCESS',
                result_display_name: 'TV Wallau Mock-Shirt',
                result_description:
                    'Dies ist eine von der KI *simuliert* generierte Beschreibung für ein TV-Wallau-Shirt. ' +
                    'Sobald der echte KI-Service angebunden ist, wird dieser Text automatisch anhand der Bilder erzeugt.',
                result_tags: [
                    'Mock',
                    'Test',
                    'TV Wallau',
                    'Sport',
                    'T-Shirt',
                    'KI',
                ],
                error_message: null,
                created_at: now,
                updated_at: now,
            };

            console.log(
                '[productAiController.createProductAiJob] Mock-AI-Job erzeugt',
                {
                    price,
                    fileCount: files.length,
                    fileNames: files.map((f) => f.originalname),
                }
            );

            res.status(201).json(mockJob);
            return;
        }

        // TODO: Hier später den echten KI-Service anbinden:
        //  1. Bilder speichern (Pfad in image_paths)
        //  2. Datensatz in product_ai_jobs einfügen (STATUS = PENDING / PROCESSING)
        //  3. Python-KI-Service aufrufen
        //  4. Ergebnis in DB aktualisieren
        //  5. Fertigen Job (SUCCESS / FAILED) an Frontend zurückgeben

        res.status(501).json({
            message:
                'Der echte KI-Service ist noch nicht implementiert. Setze AI_PRODUCT_AI_USE_REAL_SERVICE=false für Mock-Daten.',
        });
    }
);
