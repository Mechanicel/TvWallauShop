// backend/src/services/productAiService.ts

import path from 'path';
import fs from 'fs/promises';
import { knex } from '../database';
import { getIO } from '../middlewares/websocket';
import { analyzeProductViaPython } from './aiPythonClient';
import type { ProductAiJob, ProductAiJobStatus, ProductImageInput, Tag } from '@tvwallaushop/contracts';
import { ProductAiError } from '../errors/ProductAiError';
import { productService } from './productService';
import {
    normalizeStorageValue,
    parseStorageKey,
    storageKeyFromAbsolutePath,
    storageKeyToAbsolutePath,
    storageKeyToPublicUrl,
} from '../utils/storage';

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

export interface FinalizeProductAiJobInput {
    name?: string;
    description?: string | null;
    price?: number | null;
    sizes?: Array<{ label: string; stock: number }>;
    tags?: string[] | null;
}

function getPublicBaseUrl(): string {
    return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function parseImagePaths(rawPaths: string | null | undefined): string[] {
    if (!rawPaths) return [];
    try {
        const parsed = JSON.parse(rawPaths);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((value) => String(value)).filter(Boolean);
    } catch (err) {
        console.warn('[AI] Failed to parse image_paths', err);
        return [];
    }
}

function buildImageInputsFromKeys(
    storageKeys: string[],
    options: { absolute?: boolean } = {}
): ProductImageInput[] {
    const publicBase = getPublicBaseUrl();
    return storageKeys.map((key, index) => {
        const normalizedKey = normalizeStorageValue(String(key));
        const relativeUrl = storageKeyToPublicUrl(normalizedKey);
        const url =
            options.absolute && !relativeUrl.startsWith('http://') && !relativeUrl.startsWith('https://')
                ? `${publicBase}${relativeUrl}`
                : relativeUrl;
        return {
            url,
            sortOrder: index,
            isPrimary: index === 0,
        };
    });
}

function parsePrice(value: number | string): number | null {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function mapRowToResponse(row: ProductAiJobRow): ProductAiJob {
    const imagePaths = parseImagePaths(row.image_paths);
    return {
        id: row.id,
        productId: row.product_id,
        price: parsePrice(row.price),
        images: buildImageInputsFromKeys(imagePaths),
        status: row.status,
        resultDisplayName: row.result_display_name,
        resultDescription: row.result_description,
        resultTags: row.result_tags ? JSON.parse(row.result_tags) : null,
        errorMessage: row.error_message,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
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

        const tempImageKeys = files.map((file) => storageKeyFromAbsolutePath(file.path));

        if (useRealService) {
            const status: ProductAiJobStatus = 'PENDING';

            const [insertId] = await knex('product_ai_jobs').insert({
                product_id: null,
                image_paths: JSON.stringify(tempImageKeys),
                price,
                status,
                result_display_name: null,
                result_description: null,
                result_tags: null,
                error_message: null,
                created_at: knex.fn.now(),
                updated_at: knex.fn.now(),
            });

            const finalKeys = await moveJobImages(insertId, files);
            await knex('product_ai_jobs')
                .where({ id: insertId })
                .update({ image_paths: JSON.stringify(finalKeys), updated_at: knex.fn.now() });
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
            image_paths: JSON.stringify(tempImageKeys),
            price,
            status,
            result_display_name: mockName,
            result_description: mockDesc,
            result_tags: JSON.stringify(mockTags),
            error_message: null,
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
        });

        const finalKeys = await moveJobImages(insertId, files);
        await knex('product_ai_jobs')
            .where({ id: insertId })
            .update({ image_paths: JSON.stringify(finalKeys), updated_at: knex.fn.now() });
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
            const imagePaths = parseImagePaths(row.image_paths);
            const price = Number(row.price);
            const imageUrls = buildImageInputsFromKeys(imagePaths, { absolute: true }).map((image) => image.url);

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
                    const absPath = storageKeyToAbsolutePath(relPath);
                    await fs.unlink(absPath);
                } catch (err) {
                    console.warn('[AI] Failed to delete image:', relPath, err);
                }
            }
        }

        const jobDir = path.join(process.cwd(), 'uploads', 'ai', 'product-jobs', String(jobId));
        await fs.rm(jobDir, { recursive: true, force: true }).catch((err) => {
            if ((err as any)?.code !== 'ENOENT') {
                console.warn('[AI] Failed to delete job directory:', jobDir, err);
            }
        });

        await knex('product_ai_jobs').where({ id: jobId }).del();
    }

    async function finalizeProductAiJob(
        jobId: number,
        input: FinalizeProductAiJobInput
    ) {
        const job = await knex<ProductAiJobRow>('product_ai_jobs').where({ id: jobId }).first();
        if (!job) {
            throw new ProductAiError('AI_JOB_NOT_FOUND', 'Job nicht gefunden.', 404, { jobId });
        }

        if (job.product_id) {
            return await productService.getProductById(job.product_id);
        }

        if (job.status !== 'SUCCESS') {
            throw new ProductAiError('AI_JOB_NOT_READY', 'Job ist noch nicht fertig.', 409, {
                status: job.status,
            });
        }

        const imageKeys = parseImagePaths(job.image_paths).map((key) => normalizeStorageValue(key));
        const price = input.price ?? parsePrice(job.price);

        if (!price || price <= 0) {
            throw new ProductAiError('AI_INVALID_INPUT', 'Ungültiger Preis.', 400, { price });
        }

        const createdProduct = await productService.createProduct({
            name: input.name ?? job.result_display_name ?? 'AI Produkt',
            description: input.description ?? job.result_description ?? '',
            price,
            sizes: input.sizes ?? [],
            tags: input.tags ?? [],
            images: [],
        });

        try {
            const copiedKeys = await copyJobImagesToProduct(imageKeys, createdProduct.id);

            if (copiedKeys.length > 0) {
                const imageInputs: ProductImageInput[] = copiedKeys.map((key, index) => ({
                    url: key,
                    sortOrder: index,
                    isPrimary: index === 0,
                }));
                await productService.addImageInputsToProduct(createdProduct.id, imageInputs);
            }

            await knex('product_ai_jobs')
                .where({ id: jobId })
                .update({
                    product_id: createdProduct.id,
                    status: 'FINALIZED',
                    updated_at: knex.fn.now(),
                });
        } catch (err) {
            await productService.deleteProduct(createdProduct.id);
            throw err;
        }

        return await productService.getProductById(createdProduct.id);
    }

    async function moveJobImages(jobId: number, files: Express.Multer.File[]): Promise<string[]> {
        const jobDir = path.join(process.cwd(), 'uploads', 'ai', 'product-jobs', String(jobId));
        await fs.mkdir(jobDir, { recursive: true });

        const finalKeys: string[] = [];

        for (const file of files) {
            const targetKey = path.posix.join('ai', 'product-jobs', String(jobId), file.filename);
            const targetPath = storageKeyToAbsolutePath(targetKey);

            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            try {
                await fs.rename(file.path, targetPath);
            } catch (err: any) {
                if (err?.code === 'EXDEV') {
                    await fs.copyFile(file.path, targetPath);
                    await fs.unlink(file.path);
                } else {
                    throw err;
                }
            }

            finalKeys.push(targetKey);
        }

        return finalKeys;
    }

    async function copyJobImagesToProduct(storageKeys: string[], productId: number): Promise<string[]> {
        const copiedKeys: string[] = [];

        for (const key of storageKeys) {
            const parsedKey = parseStorageKey(key);
            if (!parsedKey) continue;

            const filename = path.basename(parsedKey);
            const targetKey = path.posix.join('products', String(productId), filename);
            const sourcePath = storageKeyToAbsolutePath(parsedKey);
            const targetPath = storageKeyToAbsolutePath(targetKey);

            await fs.mkdir(path.dirname(targetPath), { recursive: true });

            try {
                await fs.access(targetPath);
            } catch {
                await fs.copyFile(sourcePath, targetPath);
            }

            copiedKeys.push(targetKey);
        }

        return copiedKeys;
    }

    return {
        createProductAiJob,
        retryProductAiJob,
        getProductAiJobById,
        processProductAiJob,
        getOpenProductAiJobs,
        deleteProductAiJob,
        finalizeProductAiJob,
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
    finalizeProductAiJob,
} = defaultProductAiService;

export const productAiService = defaultProductAiService;
