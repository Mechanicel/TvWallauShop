// backend/src/services/productAiService.ts

import path from 'path';
import fs from 'fs/promises';
import { knex } from '../database';
import { getIO } from '../middlewares/websocket';
import { analyzeProductViaPython } from './aiPythonClient';
import type { ProductAiJob, ProductAiJobStatus, Tag } from '@tvwallaushop/contracts';
import { ProductAiError } from '../errors/ProductAiError';

export interface ProductAiJobRow {
    id: number;
    product_id: number | null;
    image_paths: string;
    price: number | string;
    status: ProductAiJobStatus;
    result_display_name: string | null;
    result_description: string | null;
    result_tags: string | null;
    error_message: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateProductAiJobInput {
    price: number;
    files: Express.Multer.File[];
    useRealService: boolean;
}

export interface ProductAiServiceDependencies {
    knex: typeof knex;
    analyzeProductViaPython: typeof analyzeProductViaPython;
    getIO: typeof getIO;
}

function mapRowToResponse(row: ProductAiJobRow): ProductAiJob {
    return {
        id: row.id,
        product_id: row.product_id,
        status: row.status,
        result_display_name: row.result_display_name,
        result_description: row.result_description,
        result_tags: row.result_tags ? JSON.parse(row.result_tags) : null,
        error_message: row.error_message,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
    };
}

function normalizeTags(tags: string[] | null | undefined): string[] {
    return Array.from(
        new Set(
            (tags || [])
                .map((t) => String(t).trim())
                .filter(Boolean)
                .map((t) => t.toLowerCase())
        )
    );
}

function extractTagValues(tags: Tag[] | null | undefined): string[] {
    if (!tags?.length) return [];
    return tags.map((tag) => tag.value);
}

function truncateLogText(value: string, maxChars: number): string {
    if (value.length <= maxChars) return value;
    return value.slice(0, maxChars);
}

function validateAiCopyOutput(
    title: string | null | undefined,
    description: string | null | undefined
): { valid: boolean; error?: string } {
    if (typeof title !== 'string' || typeof description !== 'string') {
        return { valid: false, error: 'Title and description must be strings.' };
    }
    const sentenceCount = description.split('.').filter((s) => s.trim()).length;
    if (sentenceCount < 2 || sentenceCount > 4) {
        return { valid: false, error: 'Description must be 2-4 sentences.' };
    }
    if (!description.trim()) {
        return { valid: false, error: 'Description must not be empty.' };
    }
    return { valid: true };
}

export function createProductAiService(dependencies: ProductAiServiceDependencies) {
    const { knex, analyzeProductViaPython, getIO } = dependencies;

    function safeEmit(event: 'aiJob:updated' | 'aiJob:completed', payload: ProductAiJob) {
        try {
            const io = getIO();
            io.emit(event, payload);
        } catch (err) {
            console.warn(`[AI] WebSocket emit failed (${event})`, err);
        }
    }

    function logJobUpdate({
        jobId,
        incomingStatus,
        storedStatusBefore,
        storedStatusAfter,
        errorMessage,
        updateSkipped,
    }: {
        jobId: number;
        incomingStatus: ProductAiJobStatus;
        storedStatusBefore: ProductAiJobStatus | 'MISSING';
        storedStatusAfter: ProductAiJobStatus | 'MISSING';
        errorMessage: string | null;
        updateSkipped: boolean;
    }) {
        console.info(
            `[AI] Job update jobId=${jobId} incoming_status=${incomingStatus} stored_status_before=${storedStatusBefore} stored_status_after=${storedStatusAfter} error_message=${errorMessage || ''} update_skipped=${updateSkipped}`
        );
    }

    async function applyJobUpdate(
        jobId: number,
        incomingStatus: ProductAiJobStatus,
        update: Partial<ProductAiJobRow>,
        options: { skipIfSuccess?: boolean } = {}
    ): Promise<{ row: ProductAiJobRow | null; skipped: boolean }> {
        const before = await knex<ProductAiJobRow>('product_ai_jobs').where({ id: jobId }).first();
        if (!before) {
            logJobUpdate({
                jobId,
                incomingStatus,
                storedStatusBefore: 'MISSING',
                storedStatusAfter: 'MISSING',
                errorMessage: update.error_message ?? null,
                updateSkipped: true,
            });
            return { row: null, skipped: true };
        }

        let query = knex('product_ai_jobs').where({ id: jobId });
        if (options.skipIfSuccess) {
            query = query.whereNot('status', 'SUCCESS');
        }

        const updatedCount = await query.update({
            ...update,
            updated_at: knex.fn.now(),
        });
        const after = await knex<ProductAiJobRow>('product_ai_jobs').where({ id: jobId }).first();
        const storedAfter = after?.status ?? before.status;
        const skipped = updatedCount === 0;

        logJobUpdate({
            jobId,
            incomingStatus,
            storedStatusBefore: before.status,
            storedStatusAfter: storedAfter,
            errorMessage: update.error_message ?? null,
            updateSkipped: skipped,
        });

        return { row: after ?? before, skipped };
    }

    async function getProductAiJobById(jobId: number): Promise<ProductAiJob | null> {
        const row = await knex<ProductAiJobRow>('product_ai_jobs').where({ id: jobId }).first();
        return row ? mapRowToResponse(row) : null;
    }

    async function createProductAiJob(input: CreateProductAiJobInput) {
        const { price, files, useRealService } = input;

        if (!files.length) {
            throw new ProductAiError('AI_INVALID_INPUT', 'Keine Dateien übermittelt.', 400, {
                filesCount: files.length,
            });
        }
        if (!price || price <= 0) {
            throw new ProductAiError('AI_INVALID_INPUT', 'Ungültiger Preis.', 400, {
                price,
            });
        }

        const imagePaths = files.map((f) => path.relative(process.cwd(), f.path).replace(/\\/g, '/'));

        if (useRealService) {
            const status: ProductAiJobStatus = 'PENDING';

            const [insertId] = await knex('product_ai_jobs').insert({
                product_id: null,
                image_paths: JSON.stringify(imagePaths),
                price,
                status,
                result_display_name: null,
                result_description: null,
                result_tags: null,
                error_message: null,
                created_at: knex.fn.now(),
                updated_at: knex.fn.now(),
            });

            const row = await knex<ProductAiJobRow>('product_ai_jobs').where({ id: insertId }).first();
            const res = mapRowToResponse(row!);

            safeEmit('aiJob:updated', res);
            return res;
        }

        const mockName = 'AI Test Produkt';
        const mockDesc = 'Dies ist ein KI-Mock-Text.';
        const mockTags = ['Mock', 'AI', 'TV Wallau'];

        const status: ProductAiJobStatus = 'SUCCESS';

        const [insertId] = await knex('product_ai_jobs').insert({
            product_id: null,
            image_paths: JSON.stringify(imagePaths),
            price,
            status,
            result_display_name: mockName,
            result_description: mockDesc,
            result_tags: JSON.stringify(mockTags),
            error_message: null,
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
        });

        const row = await knex<ProductAiJobRow>('product_ai_jobs').where({ id: insertId }).first();
        const res = mapRowToResponse(row!);

        safeEmit('aiJob:completed', res);
        return res;
    }

    async function retryProductAiJob(jobId: number): Promise<ProductAiJob | null> {
        const row = await knex<ProductAiJobRow>('product_ai_jobs').where({ id: jobId }).first();
        if (!row) return null;

        if (row.status === 'PROCESSING') return mapRowToResponse(row);

        const updated = await applyJobUpdate(
            jobId,
            'PROCESSING',
            {
                status: 'PROCESSING',
                error_message: null,
                result_display_name: null,
                result_description: null,
                result_tags: null,
            },
            { skipIfSuccess: true }
        );

        if (!updated.row) return null;
        if (updated.skipped && updated.row.status === 'SUCCESS') {
            return mapRowToResponse(updated.row);
        }

        safeEmit('aiJob:updated', mapRowToResponse(updated.row));

        void processProductAiJobImpl(jobId, true).catch((err) => {
            console.error('[AI] processProductAiJob failed after retry', err);
        });

        return mapRowToResponse(updated.row);
    }

    async function processProductAiJobImpl(jobId: number, allowIfAlreadyProcessing: boolean): Promise<void> {
        const row = await knex<ProductAiJobRow>('product_ai_jobs').where({ id: jobId }).first();
        if (!row) {
            throw new ProductAiError('AI_JOB_NOT_FOUND', `AI Job ${jobId} nicht gefunden.`, 404, { jobId });
        }
        if (row.status === 'SUCCESS') return;
        if (row.status === 'PROCESSING' && !allowIfAlreadyProcessing) return;

        const processingUpdate = await applyJobUpdate(
            jobId,
            'PROCESSING',
            {
                status: 'PROCESSING',
                error_message: null,
                result_display_name: null,
                result_description: null,
                result_tags: null,
            },
            { skipIfSuccess: true }
        );

        if (!processingUpdate.row) return;
        if (processingUpdate.skipped && processingUpdate.row.status === 'SUCCESS') return;

        safeEmit('aiJob:updated', mapRowToResponse(processingUpdate.row));

        try {
            const imagePaths: string[] = row.image_paths ? JSON.parse(row.image_paths) : [];
            const price = Number(row.price);

            const publicBase = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

            const imageUrls = imagePaths.map((p) => {
                const normalized = String(p).replace(/\\/g, '/').replace(/^\.\?\//, '').replace(/^\.\//, '');
                return `${publicBase}/${normalized}`;
            });

            const aiRes = await analyzeProductViaPython({ jobId, price, imageUrls });
            const validation = validateAiCopyOutput(aiRes.title, aiRes.description);
            const parsedTitle = typeof aiRes.title === 'string' ? aiRes.title : '';
            const parsedDescription = typeof aiRes.description === 'string' ? aiRes.description : '';
            console.info(
                `[AI] LLM parsed output jobId=${jobId} schema_valid=${validation.valid} schema_error=${
                    validation.error || ''
                } parsed_title=${JSON.stringify(truncateLogText(parsedTitle, 200))} parsed_description=${JSON.stringify(
                    truncateLogText(parsedDescription, 400)
                )}`
            );
            if (!validation.valid) {
                throw new ProductAiError('AI_INVALID_OUTPUT', validation.error || 'Invalid AI output.', 502, {
                    jobId,
                    title: parsedTitle,
                    description: parsedDescription,
                });
            }
            const tags = normalizeTags(extractTagValues(aiRes.tags));

            console.info(
                `[AI] Persisting AI results jobId=${jobId} result_display_name=${JSON.stringify(
                    truncateLogText(parsedTitle, 200)
                )} result_description=${JSON.stringify(truncateLogText(parsedDescription, 400))}`
            );

            const updated = await applyJobUpdate(jobId, 'SUCCESS', {
                status: 'SUCCESS',
                result_display_name: parsedTitle,
                result_description: parsedDescription,
                result_tags: JSON.stringify(tags),
                error_message: null,
            });

            if (updated.row) {
                safeEmit('aiJob:completed', mapRowToResponse(updated.row));
            }
        } catch (err: any) {
            const message = err?.message || 'AI processing failed';

            const updated = await applyJobUpdate(
                jobId,
                'FAILED',
                {
                    status: 'FAILED',
                    error_message: message,
                },
                { skipIfSuccess: true }
            );

            if (updated.row) {
                safeEmit('aiJob:completed', mapRowToResponse(updated.row));
            }
        }
    }

    async function processProductAiJob(jobId: number): Promise<void> {
        return processProductAiJobImpl(jobId, false);
    }

    async function getOpenProductAiJobs(): Promise<ProductAiJob[]> {
        const rows = await knex<ProductAiJobRow>('product_ai_jobs')
            .whereNull('product_id')
            .whereIn('status', ['PENDING', 'PROCESSING', 'FAILED', 'SUCCESS'])
            .orderBy('created_at', 'asc');

        return rows.map(mapRowToResponse);
    }

    async function deleteProductAiJob(jobId: number): Promise<void> {
        const job = await knex<ProductAiJobRow>('product_ai_jobs').where({ id: jobId }).first();
        if (!job) {
            throw new ProductAiError('AI_JOB_NOT_FOUND', 'Job nicht gefunden.', 404, { jobId });
        }

        if (job.image_paths) {
            const paths: string[] = JSON.parse(job.image_paths);
            for (const relPath of paths) {
                try {
                    const absPath = path.join(process.cwd(), relPath);
                    await fs.unlink(absPath);
                } catch (err) {
                    console.warn('[AI] Failed to delete image:', relPath, err);
                }
            }
        }

        await knex('product_ai_jobs').where({ id: jobId }).del();
    }

    return {
        createProductAiJob,
        retryProductAiJob,
        getProductAiJobById,
        processProductAiJob,
        getOpenProductAiJobs,
        deleteProductAiJob,
    };
}

const defaultProductAiService = createProductAiService({
    knex,
    analyzeProductViaPython,
    getIO,
});

export const {
    createProductAiJob,
    retryProductAiJob,
    getProductAiJobById,
    processProductAiJob,
    getOpenProductAiJobs,
    deleteProductAiJob,
} = defaultProductAiService;

export const productAiService = defaultProductAiService;
