// backend/src/controllers/productAiController.ts

import { Request, Response } from 'express';
import { catchAsync } from '../utils/helpers';
import { productAiService } from '../services/productAiService';
import { ProductAiError } from '../errors/ProductAiError';

export const createProductAiJob = catchAsync(async (req: Request, res: Response) => {
    const useRealService = process.env.AI_PRODUCT_AI_USE_REAL_SERVICE === 'true';

    const files = (req.files as Express.Multer.File[]) || [];
    const rawPrice = (req.body?.price ?? '').toString();
    const price = Number(rawPrice) || 0;

    const job = await productAiService.createProductAiJob({
        price,
        files,
        useRealService,
    });

    if (useRealService) {
        res.status(201).json(job);

        void productAiService.processProductAiJob(job.id).catch((err) => {
            console.error('[productAiController.createProductAiJob] processProductAiJob failed:', err);
        });

        return;
    }

    // Mock: Service emitted already aiJob:completed
    res.status(201).json(job);
});

export const retryProductAiJob = catchAsync(async (req: Request, res: Response) => {
    const useRealService = process.env.AI_PRODUCT_AI_USE_REAL_SERVICE === 'true';

    if (!useRealService) {
        throw new ProductAiError(
            'AI_REAL_SERVICE_REQUIRED',
            'Retry ist nur im Real-Service-Modus möglich.',
            400
        );
    }

    const jobId = Number(req.params.id);
    if (!jobId || Number.isNaN(jobId)) {
        throw new ProductAiError('AI_INVALID_JOB_ID', 'Ungültige Job-ID.', 400, {
            providedId: req.params.id,
        });
    }

    const existing = await productAiService.getProductAiJobById(jobId);
    if (!existing) throw new ProductAiError('AI_JOB_NOT_FOUND', 'Job nicht gefunden.', 404);
    if (existing.status === 'SUCCESS') {
        throw new ProductAiError(
            'AI_JOB_ALREADY_COMPLETED',
            'Job ist bereits abgeschlossen.',
            409
        );
    }

    const updated = await productAiService.retryProductAiJob(jobId);
    if (!updated) throw new ProductAiError('AI_JOB_NOT_FOUND', 'Job nicht gefunden.', 404);

    res.status(200).json(updated);
});

export const getOpenProductAiJobs = catchAsync(async (_req: Request, res: Response) => {
    const jobs = await productAiService.getOpenProductAiJobs();
    res.status(200).json(jobs);
});

export const deleteProductAiJob = catchAsync(async (req: Request, res: Response) => {
    const jobId = Number(req.params.id);

    if (!jobId || Number.isNaN(jobId)) {
        throw new ProductAiError('AI_INVALID_JOB_ID', 'Ungültige Job-ID.', 400, {
            providedId: req.params.id,
        });
    }

    await productAiService.deleteProductAiJob(jobId);
    res.status(204).send();
});
