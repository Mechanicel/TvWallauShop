// backend/src/services/productAiService.ts

import path from 'path';
import fs from 'fs/promises';
import { knex } from '../database';
import { getIO } from '../middlewares/websocket';
import { analyzeProductViaPython } from './aiPythonClient';

export type ProductAiJobStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

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
    created_at?: Date;
    updated_at?: Date | null;
}

export interface ProductAiJobResponse {
    id: number;
    product_id: number | null;
    status: ProductAiJobStatus;
    result_display_name: string | null;
    result_description: string | null;
    result_tags: string[] | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateProductAiJobInput {
    price: number;
    files: Express.Multer.File[];
    useRealService: boolean;
}

function mapRowToResponse(row: ProductAiJobRow): ProductAiJobResponse {
    return {
        id: row.id,
        product_id: row.product_id,
        status: row.status,
        result_display_name: row.result_display_name,
        result_description: row.result_description,
        result_tags: row.result_tags ? JSON.parse(row.result_tags) : null,
        error_message: row.error_message,
        created_at: row.created_at
            ? row.created_at.toISOString()
            : new Date().toISOString(),
        updated_at: row.updated_at
            ? row.updated_at.toISOString()
            : row.created_at
                ? row.created_at.toISOString()
                : new Date().toISOString(),
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

export async function createProductAiJob(input: CreateProductAiJobInput) {
    const { price, files, useRealService } = input;

    if (!files.length) throw new Error('Keine Dateien übermittelt.');
    if (!price || price <= 0) throw new Error('Ungültiger Preis.');

    // relative Pfade (wie bisher)
    const imagePaths = files.map((f) =>
        path.relative(process.cwd(), f.path).replace(/\\/g, '/')
    );

    // Wenn REAL-Service, dann erstmal nur PENDING anlegen (ohne Result)
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

        const row = await knex<ProductAiJobRow>('product_ai_jobs')
            .where({ id: insertId })
            .first();

        return mapRowToResponse(row!);
    }

    // MOCK-KI-DATEN (wie bisher)
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

    const row = await knex<ProductAiJobRow>('product_ai_jobs')
        .where({ id: insertId })
        .first();

    return mapRowToResponse(row!);
}

/**
 * REAL: verarbeitet einen bestehenden Job:
 * PENDING -> PROCESSING -> SUCCESS/FAILED, emit aiJob:completed
 */
export async function processProductAiJob(jobId: number): Promise<void> {
    const row = await knex<ProductAiJobRow>('product_ai_jobs')
        .where({ id: jobId })
        .first();

    if (!row) throw new Error(`AI Job ${jobId} nicht gefunden.`);

    // ✅ SUCCESS niemals neu verarbeiten
    if (row.status === 'SUCCESS') return;

    // ✅ PROCESSING nur blockieren, wenn wirklich parallel
    // (Retry kommt IMMER aus FAILED oder PENDING)
    await knex('product_ai_jobs')
        .where({ id: jobId })
        .update({
            status: 'PROCESSING' as ProductAiJobStatus,
            error_message: null,
            updated_at: knex.fn.now(),
        });

    try {
        const imagePaths: string[] = row.image_paths ? JSON.parse(row.image_paths) : [];
        const price = Number(row.price);

        const publicBase =
            (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

        const imageUrls = imagePaths.map((p) => {
            // DB speichert z.B. "uploads/ai/product-jobs/file.jpg" (ohne führenden Slash)
            const normalized = String(p).replace(/\\/g, '/').replace(/^\.?\//, '');
            // Wir wollen immer: http://.../uploads/...
            return `${publicBase}/${normalized}`;
        });

        const aiRes = await analyzeProductViaPython({
            jobId,
            price,
            imageUrls,
        });


        const tags = normalizeTags(aiRes.tags);

        await knex('product_ai_jobs')
            .where({ id: jobId })
            .update({
                status: 'SUCCESS',
                result_display_name: aiRes.display_name,
                result_description: aiRes.description,
                result_tags: JSON.stringify(tags),
                error_message: null,
                updated_at: knex.fn.now(),
            });

        const updated = await knex<ProductAiJobRow>('product_ai_jobs')
            .where({ id: jobId })
            .first();

        const io = getIO();
        io.emit('aiJob:completed', mapRowToResponse(updated!));
    } catch (err: any) {
        const message = err?.message || 'AI processing failed';

        await knex('product_ai_jobs')
            .where({ id: jobId })
            .update({
                status: 'FAILED',
                error_message: message,
                updated_at: knex.fn.now(),
            });

        const updated = await knex<ProductAiJobRow>('product_ai_jobs')
            .where({ id: jobId })
            .first();

        const io = getIO();
        io.emit('aiJob:completed', mapRowToResponse(updated!));
    }
}
export async function getOpenProductAiJobs(): Promise<ProductAiJobResponse[]> {
    const rows = await knex<ProductAiJobRow>('product_ai_jobs')
        .whereNull('product_id')
        .whereIn('status', ['PENDING', 'PROCESSING', 'FAILED', 'SUCCESS'])
        .orderBy('created_at', 'asc');

    return rows.map(mapRowToResponse);
}
export async function deleteProductAiJob(jobId: number): Promise<void> {
    const job = await knex<ProductAiJobRow>('product_ai_jobs')
        .where({ id: jobId })
        .first();

    if (!job) return;

    // 🔥 KI-Bilder löschen
    if (job.image_paths) {
        const paths: string[] = JSON.parse(job.image_paths);

        for (const relPath of paths) {
            try {
                const absPath = path.join(process.cwd(), relPath);
                await fs.unlink(absPath);
            } catch (err) {
                // Datei evtl. schon weg → ignorieren, aber loggen
                console.warn('[AI] Failed to delete image:', relPath, err);
            }
        }
    }

    // 🔥 DB-Eintrag löschen
    await knex('product_ai_jobs')
        .where({ id: jobId })
        .del();
}

export const productAiService = {
    createProductAiJob,
    processProductAiJob,
    getOpenProductAiJobs,
    deleteProductAiJob,
};
