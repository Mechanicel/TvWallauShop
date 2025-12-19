// backend/src/controllers/productAiController.ts

import { Request, Response } from 'express';
import { catchAsync } from '../utils/helpers';
import { productAiService } from '../services/productAiService';

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
        return res.status(400).json({
            message: 'Retry ist nur im Real-Service-Modus möglich.',
        });
    }

    const jobId = Number(req.params.id);
    if (!jobId || Number.isNaN(jobId)) {
        return res.status(400).json({ message: 'Ungültige Job-ID.' });
    }

    const existing = await productAiService.getProductAiJobById(jobId);
    if (!existing) return res.status(404).json({ message: 'Job nicht gefunden.' });
    if (existing.status === 'SUCCESS') return res.status(409).json({ message: 'Job ist bereits abgeschlossen.' });

    const updated = await productAiService.retryProductAiJob(jobId);
    if (!updated) return res.status(404).json({ message: 'Job nicht gefunden.' });

    res.status(200).json(updated);
});

export const getOpenProductAiJobs = catchAsync(async (_req: Request, res: Response) => {
    const jobs = await productAiService.getOpenProductAiJobs();
    res.status(200).json(jobs);
});

export const deleteProductAiJob = catchAsync(async (req: Request, res: Response) => {
    const jobId = Number(req.params.id);

    if (!jobId || Number.isNaN(jobId)) {
        return res.status(400).json({ message: 'Ungültige Job-ID.' });
    }

    await productAiService.deleteProductAiJob(jobId);
    res.status(204).send();
});
