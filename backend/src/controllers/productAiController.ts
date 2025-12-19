// backend/src/controllers/productAiController.ts

import { Request, Response } from 'express';
import { catchAsync } from '../utils/helpers';
import { productAiService } from '../services/productAiService';
import { getIO } from '../middlewares/websocket';
import { knex } from '../database';

/**
 * POST /api/ai/product-job
 *
 * Erwartet:
 *  - multipart/form-data
 *      - price: number
 *      - images[]: Dateien (mind. 1)
 *
 * Mock:
 *  - Job wird direkt SUCCESS erstellt und aiJob:completed emitted.
 *
 * Real:
 *  - Job wird PENDING erstellt und sofort zurückgegeben.
 *  - Danach async: PROCESSING -> SUCCESS/FAILED + aiJob:completed emit.
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

        // MOCK: sofort completed emitten (wie bisher)
        if (!useRealService) {
            try {
                const io = getIO();
                io.emit('aiJob:completed', job);
            } catch (err) {
                console.error(
                    '[productAiController.createProductAiJob] WebSocket emit failed:',
                    err
                );
            }

            return res.status(201).json(job);
        }

        // REAL: sofort antworten (Queue sichtbar)
        res.status(201).json(job);

        // danach async verarbeiten
        void productAiService.processProductAiJob(job.id).catch((err) => {
            console.error(
                '[productAiController.createProductAiJob] processProductAiJob failed:',
                err
            );
        });
    }
);

/**
 * POST /api/ai/product-job/:id/retry
 *
 * Setzt Job sofort auf PROCESSING und startet Analyse erneut.
 */
export const retryProductAiJob = catchAsync(
    async (req: Request, res: Response) => {
        const useRealService =
            process.env.AI_PRODUCT_AI_USE_REAL_SERVICE === 'true';

        if (!useRealService) {
            return res.status(400).json({
                message: 'Retry ist nur im Real-Service-Modus möglich.',
            });
        }

        const jobId = Number(req.params.id);
        if (!jobId || Number.isNaN(jobId)) {
            return res.status(400).json({ message: 'Ungültige Job-ID.' });
        }

        const row = await knex('product_ai_jobs').where({ id: jobId }).first();

        if (!row) {
            return res.status(404).json({ message: 'Job nicht gefunden.' });
        }

        if (row.status === 'SUCCESS') {
            return res
                .status(409)
                .json({ message: 'Job ist bereits abgeschlossen.' });
        }

        // ✅ Nur triggern – Status setzt der Service
        void productAiService.processProductAiJob(jobId).catch((err) => {
            console.error(
                '[productAiController.retryProductAiJob] processProductAiJob failed:',
                err
            );
        });

        // aktuellen Zustand zurückgeben
        const updated = await knex('product_ai_jobs')
            .where({ id: jobId })
            .first();

        res.status(200).json({
            id: updated.id,
            product_id: updated.product_id,
            status: updated.status,
            result_display_name: updated.result_display_name,
            result_description: updated.result_description,
            result_tags: updated.result_tags
                ? JSON.parse(updated.result_tags)
                : null,
            error_message: updated.error_message,
            created_at: updated.created_at.toISOString(),
            updated_at: updated.updated_at.toISOString(),
        });
    }
);
export const getOpenProductAiJobs = catchAsync(
    async (_req: Request, res: Response) => {
        const jobs = await productAiService.getOpenProductAiJobs();
        res.status(200).json(jobs);
    }
);
/**
 * DELETE /api/ai/product-job/:id
 *
 * Löscht einen KI-Job inkl. aller gespeicherten Bilder
 */
export const deleteProductAiJob = catchAsync(
    async (req: Request, res: Response) => {
        const jobId = Number(req.params.id);

        if (!jobId || Number.isNaN(jobId)) {
            return res.status(400).json({ message: 'Ungültige Job-ID.' });
        }

        await productAiService.deleteProductAiJob(jobId);

        res.status(204).send();
    }
);

