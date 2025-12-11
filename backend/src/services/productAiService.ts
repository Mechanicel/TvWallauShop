// backend/src/services/productAiService.ts

import path from 'path';
import { knex } from '../database'; // ← KORREKTER IMPORT

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

export async function createProductAiJob(input: CreateProductAiJobInput) {
    const { price, files, useRealService } = input;

    if (!files.length) throw new Error('Keine Dateien übermittelt.');
    if (!price || price <= 0) throw new Error('Ungültiger Preis.');

    const imagePaths = files.map((f) =>
        path.relative(process.cwd(), f.path).replace(/\\/g, '/')
    );

    // MOCK-KI-DATEN
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
        created_at: knex.fn.now(),  // ← funktioniert jetzt
        updated_at: knex.fn.now(),
    });

    const row = await knex<ProductAiJobRow>('product_ai_jobs')
        .where({ id: insertId })
        .first();

    return mapRowToResponse(row!);
}

export const productAiService = {
    createProductAiJob,
};
