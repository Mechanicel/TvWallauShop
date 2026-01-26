// backend/src/services/productService.ts
// Ziel: camelCase im Service/Frontend, Snake-Case bleibt nur in der DB.
// - Alle Produkte haben IMMER ein sizes-Array (leer wenn keine vorhanden).
// - Alle Produkte haben IMMER ein images-Array (leer wenn keine vorhanden).
// - Tags werden in tags/product_tags gespeichert und als string[] zurückgegeben.

import { knex } from '../database';
import type { Knex } from 'knex';
import { InsufficientStockError } from '../errors/InsufficientStockError';
import path from 'path';
import fs from 'fs';
import type { Product, ProductImage, ProductSize } from '@tvwallaushop/contracts';
import {
    ProductImageNotFoundError,
    ProductImageTableMissingError,
    ProductNotFoundError,
    ProductValidationError,
} from '../errors/ProductServiceError';
import {
    ProductImageRow,
    ProductQuery,
    ProductRow,
    ProductSizeInput,
    ProductSizeRow,
} from '../models/productModel';

function mapProductRow(row: ProductRow): Product {
    return {
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        price: Number(row.price),
        imageUrl: row.image_url ?? null,
        createdAt: row.created_at ? row.created_at.toISOString() : null,
        sizes: [],
        images: [],
        tags: [], // wird später gefüllt
    };
}

function mapSizeRow(row: ProductSizeRow): ProductSize {
    return {
        id: row.id,
        label: row.label,
        stock: Number(row.stock),
    };
}

function mapImageRow(row: ProductImageRow): ProductImage {
    return {
        id: row.id,
        url: row.url,
        sortOrder: row.sort_order ?? 0,
        isPrimary: Boolean(row.is_primary),
    };
}

function assertValidId(value: number, label: string): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new ProductValidationError(`Invalid ${label}`, { [label]: value });
    }
}

function assertValidName(value: unknown): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new ProductValidationError('name is required', { field: 'name' });
    }
}

function assertValidPrice(value: unknown): void {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
        throw new ProductValidationError('price is required', { field: 'price' });
    }
}

function normalizeImageUrls(imageUrls: string[]): string[] {
    return imageUrls
        .map((url) => (typeof url === 'string' ? url.trim() : ''))
        .filter((url) => url.length > 0);
}

/**
 * Tags für ein Produkt in der DB setzen.
 * - vorhandene product_tags für dieses Produkt werden gelöscht
 * - tags-Records werden (falls nicht vorhanden) erstellt
 * - neue product_tags-Einträge werden angelegt
 */
async function setTagsForProduct(
    productId: number,
    tags?: string[]
): Promise<void> {
    if (!tags) return;

    // vorhandene Links löschen
    await knex('product_tags').where({ product_id: productId }).del();

    // trimmen + duplikate entfernen
    const cleaned = Array.from(
        new Set(
            tags
                .map((t) => t.trim())
                .filter((t) => t.length > 0)
        )
    );

    if (cleaned.length === 0) return;

    for (const name of cleaned) {
        let tag = await knex('tags').where({ name }).first<{ id: number }>();
        if (!tag) {
            const [newTagId] = await knex('tags').insert({ name });
            tag = { id: newTagId };
        }

        await knex('product_tags').insert({
            product_id: productId,
            tag_id: tag.id,
        });
    }
}


/**
 * Setzt die Größen für ein Produkt:
 * - löscht bestehende Einträge aus product_sizes
 * - legt alle benötigten sizes (Label) in sizes an (falls noch nicht vorhanden)
 * - verknüpft in product_sizes (mit stock)
 */
async function setSizesForProduct(productId: number, sizes?: ProductSizeInput[] | null) {
    if (!sizes || sizes.length === 0) {
        // Falls du hier ALLE Größen entfernen willst:
        await knex('product_sizes').where({ product_id: productId }).del();
        return;
    }

    // Erst alle bestehenden Größenverknüpfungen entfernen
    await knex('product_sizes').where({ product_id: productId }).del();

    for (const s of sizes) {
        if (!s.label || !s.label.trim()) continue;

        // Größe nach Label suchen oder neu anlegen
        let size = await knex('sizes').where({ label: s.label }).first();

        if (!size) {
            const [newSizeId] = await knex('sizes').insert({ label: s.label });
            size = { id: newSizeId, label: s.label } as any;
        }

        await knex('product_sizes').insert({
            product_id: productId,
            size_id: (size as any).id,
            stock: s.stock ?? 0,
        });
    }
}

export const productService = {
    // Liste mit optionalen Filtern (q, minPrice, maxPrice).
    // Jetzt IMMER inkl. sizes, images und tags.
    async getAllProducts(query: ProductQuery = {}): Promise<Product[]> {
        const { q, minPrice, maxPrice, limit } = query;

        let sql = knex<ProductRow>('products').select('*');

        if (q && String(q).trim()) {
            const searchValue = `%${String(q).trim()}%`;
            sql = sql.where((builder) => {
                builder.where('name', 'like', searchValue).orWhere('description', 'like', searchValue);
            });
        }
        if (minPrice !== undefined && !Number.isNaN(Number(minPrice))) {
            sql = sql.andWhere('price', '>=', Number(minPrice));
        }
        if (maxPrice !== undefined && !Number.isNaN(Number(maxPrice))) {
            sql = sql.andWhere('price', '<=', Number(maxPrice));
        }
        if (limit !== undefined && Number.isFinite(Number(limit)) && Number(limit) > 0) {
            sql = sql.limit(Math.floor(Number(limit)));
        }

        const productRows = await sql.orderBy('id', 'asc');
        const products = productRows.map(mapProductRow);

        if (products.length === 0) return products;

        const productIds = products.map((p) => p.id);

        // Sizes
        const allSizes = await knex('product_sizes as ps')
            .join('sizes as s', 'ps.size_id', 's.id')
            .select('ps.product_id', 's.id', 's.label', 'ps.stock')
            .whereIn('ps.product_id', productIds);

        // Images
        let allImages: ProductImageRow[] = [];
        try {
            allImages = await knex('product_images')
                .select('id', 'product_id', 'url', 'sort_order', 'is_primary')
                .whereIn('product_id', productIds)
                .orderBy('product_id', 'asc')
                .orderBy('sort_order', 'asc');
        } catch {
            allImages = [];
        }

        // Tags
        const tagRows = await knex('product_tags as pt')
            .join('tags as t', 'pt.tag_id', 't.id')
            .select<{ product_id: number; name: string }[]>(
                'pt.product_id',
                't.name'
            )
            .whereIn('pt.product_id', productIds);

        for (const p of products) {
            // Größen
            p.sizes = allSizes
                .filter((s: any) => s.product_id === p.id)
                .map(mapSizeRow);

            // Bilder
            const imagesForProduct = allImages
                .filter((img) => img.product_id === p.id)
                .map(mapImageRow);

            p.images = imagesForProduct;

            const primary =
                imagesForProduct.find((img) => img.isPrimary) ??
                imagesForProduct[0] ??
                null;

            if (primary) {
                p.imageUrl = primary.url;
            }

            // Tags
            p.tags = tagRows
                .filter((t) => t.product_id === p.id)
                .map((t) => t.name);
        }

        return products;
    },

    async getProductPricingByIds(
        productIds: number[],
        db?: Knex | Knex.Transaction
    ): Promise<Map<number, { price: number; name: string }>> {
        if (productIds.length === 0) return new Map();
        const rows = await (db ?? knex)('products')
            .select<{ id: number; price: number | string; name: string }[]>('id', 'price', 'name')
            .whereIn('id', productIds);

        return new Map(
            rows.map((row) => [Number(row.id), { price: Number(row.price), name: row.name }]),
        );
    },

    async getProductNamesByIds(
        productIds: number[],
        db?: Knex | Knex.Transaction
    ): Promise<Map<number, string>> {
        if (productIds.length === 0) return new Map();
        const rows = await (db ?? knex)('products')
            .select<{ id: number; name: string }[]>('id', 'name')
            .whereIn('id', productIds);
        return new Map(rows.map((row) => [Number(row.id), row.name]));
    },

    async getSizeLabelsByIds(
        sizeIds: number[],
        db?: Knex | Knex.Transaction
    ): Promise<Map<number, string>> {
        if (sizeIds.length === 0) return new Map();
        const rows = await (db ?? knex)('sizes')
            .select<{ id: number; label: string }[]>('id', 'label')
            .whereIn('id', sizeIds);
        return new Map(rows.map((row) => [Number(row.id), row.label]));
    },

    async reserveStock(
        items: Array<{ productId: number; sizeId: number; quantity: number }>,
        db: Knex.Transaction,
    ): Promise<void> {
        for (const { productId, sizeId, quantity } of items) {
            const stockRow = await db('product_sizes')
                .where({ product_id: productId, size_id: sizeId })
                .forUpdate()
                .first();

            if (!stockRow) {
                throw new ProductValidationError(
                    `Lagerbestand für Produkt ${productId}, Größe ${sizeId} nicht gefunden`,
                    { productId, sizeId },
                );
            }

            const available = Number(stockRow.stock);
            if (available < quantity) {
                throw new InsufficientStockError(productId, sizeId ?? null, available, quantity);
            }

            await db('product_sizes')
                .where({ product_id: productId, size_id: sizeId })
                .decrement('stock', quantity);
        }
    },

    async restockItems(
        items: Array<{ productId: number; sizeId: number; quantity: number }>,
        db: Knex.Transaction,
    ): Promise<void> {
        for (const { productId, sizeId, quantity } of items) {
            await db('product_sizes')
                .where({ product_id: productId, size_id: sizeId })
                .increment('stock', quantity);
        }
    },

    // Einzelnes Produkt inkl. Sizes, Images und Tags
    async getProductById(id: number): Promise<Product> {
        assertValidId(id, 'productId');
        const productRow = await knex<ProductRow>('products').where({ id }).first();
        if (!productRow) {
            throw new ProductNotFoundError(id);
        }

        const product = mapProductRow(productRow);

        const sizeRows = await knex('product_sizes as ps')
            .join('sizes as s', 'ps.size_id', 's.id')
            .select('s.id', 's.label', 'ps.stock')
            .where('ps.product_id', id);

        product.sizes = sizeRows.map(mapSizeRow);

        let imageRows: ProductImageRow[] = [];
        try {
            imageRows = await knex('product_images')
                .select('id', 'product_id', 'url', 'sort_order', 'is_primary')
                .where({ product_id: id })
                .orderBy('sort_order', 'asc');
        } catch {
            imageRows = [];
        }

        const images = imageRows.map(mapImageRow);
        product.images = images;

        const primary =
            images.find((img) => img.isPrimary) ??
            images[0] ??
            null;

        if (primary) {
            product.imageUrl = primary.url;
        }

        // Tags
        const tagRows = await knex('product_tags as pt')
            .join('tags as t', 'pt.tag_id', 't.id')
            .select<{ name: string }[]>('t.name')
            .where('pt.product_id', id);

        product.tags = tagRows.map((t) => t.name);

        return product;
    },

    async createProduct(data: Partial<Product> & { imageUrls?: string[] }): Promise<Product> {
        console.log('createProduct payload:', data);

        if (!data) {
            throw new ProductValidationError('Invalid payload');
        }
        assertValidName(data.name);
        assertValidPrice(data.price);

        const requestedImageUrl =
            typeof data.imageUrl === 'string' && data.imageUrl.trim().length > 0
                ? data.imageUrl.trim()
                : null;
        const providedImageUrls = normalizeImageUrls(data.imageUrls ?? []);
        const primaryImageUrl = requestedImageUrl ?? providedImageUrls[0] ?? null;
        const imageUrls = normalizeImageUrls(
            primaryImageUrl ? [primaryImageUrl, ...providedImageUrls] : providedImageUrls
        );

        const [newId] = await knex('products').insert({
            name: data.name,
            description: data.description ?? null,
            price: data.price,
            image_url: primaryImageUrl,
        });

        // Größen für neues Produkt setzen (falls übergeben)
        if (data.sizes) {
            // data.sizes enthält im Frontend ggf. id als UUID (lokal) → ignorieren, wir nutzen nur label + stock
            const sizeInput: ProductSizeInput[] = data.sizes.map((s: any) => ({
                label: s.label,
                stock: s.stock,
            }));
            await setSizesForProduct(newId, sizeInput);
        }

        // Tags für neues Produkt setzen (falls übergeben)
        await setTagsForProduct(newId, data.tags);

        if (imageUrls.length > 0) {
            await this.addImagesToProduct(newId, imageUrls);
        }

        return await this.getProductById(newId);
    },

    async updateProduct(id: number, data: Partial<Product> & { imageUrls?: string[] }): Promise<Product> {
        console.log('updateProduct payload:', data);
        assertValidId(id, 'productId');
        if (!data) {
            throw new ProductValidationError('Invalid payload');
        }
        const existing = await knex<ProductRow>('products').where({ id }).first();
        if (!existing) {
            throw new ProductNotFoundError(id);
        }

        const requestedImageUrl =
            typeof data.imageUrl === 'string' && data.imageUrl.trim().length > 0
                ? data.imageUrl.trim()
                : null;

        await knex('products')
            .where({ id })
            .update({
                name: data.name ?? existing.name,
                description: data.description ?? existing.description,
                price:
                    typeof data.price === 'number' && !Number.isNaN(data.price) && data.price >= 0
                        ? data.price
                        : Number(existing.price),
                image_url: requestedImageUrl ?? existing.image_url,
            });

        const providedImageUrls = normalizeImageUrls(data.imageUrls ?? []);
        if (providedImageUrls.length > 0) {
            await this.addImagesToProduct(id, providedImageUrls);
        }

        // Größen aktualisieren
        if (data.sizes) {
            const sizeInput: ProductSizeInput[] = data.sizes.map((s: any) => ({
                label: s.label,
                stock: s.stock,
            }));
            await setSizesForProduct(id, sizeInput);
        }

        // Tags aktualisieren (nur wenn data.tags übergeben wurde)
        if (data.tags) {
            await setTagsForProduct(id, data.tags);
        }

        return await this.getProductById(id);
    },

    // mehrere Bild-URLs zu einem Produkt hinzufügen
    async addImagesToProduct(
        productId: number,
        imageUrls: string[]
    ): Promise<Product> {
        assertValidId(productId, 'productId');
        const existing = await knex<ProductRow>('products').where({ id: productId }).first();
        if (!existing) {
            throw new ProductNotFoundError(productId);
        }

        const sanitizedUrls = normalizeImageUrls(imageUrls ?? []);
        if (sanitizedUrls.length === 0) {
            return await this.getProductById(productId);
        }

        let existingImages: ProductImageRow[] = [];
        try {
            existingImages = await knex('product_images')
                .where({ product_id: productId })
                .orderBy('sort_order', 'asc');
        } catch {
            throw new ProductImageTableMissingError();
        }

        const hasPrimaryAlready = existingImages.some(
            (img: any) => img.is_primary
        );
        let nextSortOrder =
            existingImages.length > 0
                ? (existingImages[existingImages.length - 1].sort_order ??
                existingImages.length - 1) + 1
                : 0;

        const inserts = sanitizedUrls.map((url, index) => ({
            product_id: productId,
            url,
            sort_order: nextSortOrder + index,
            is_primary: !hasPrimaryAlready && index === 0 ? 1 : 0,
        }));

        await knex('product_images').insert(inserts);

        if (!existing.image_url && inserts.length > 0) {
            await knex('products')
                .where({ id: productId })
                .update({ image_url: inserts[0].url });
        }

        return await this.getProductById(productId);
    },

    async deleteProductImage(
        productId: number,
        imageId: number
    ): Promise<{ product: Product; deletedImageUrl: string }> {
        assertValidId(productId, 'productId');
        assertValidId(imageId, 'imageId');
        const trx = await knex.transaction();

        try {
            const image = await trx('product_images')
                .where({ id: imageId, product_id: productId })
                .first();

            if (!image) {
                await trx.rollback();
                throw new ProductImageNotFoundError(productId, imageId);
            }

            const deletedImageUrl: string = image.url;

            await trx('product_images').where({ id: imageId }).del();

            const remaining = await trx('product_images')
                .where({ product_id: productId })
                .orderBy('sort_order', 'asc');

            let newPrimaryUrl: string | null = null;

            if (remaining.length > 0) {
                let primary = remaining.find((img: any) => img.is_primary);
                if (!primary) {
                    primary = remaining[0];
                }

                newPrimaryUrl = primary.url;

                await trx('product_images')
                    .where({ product_id: productId })
                    .update({ is_primary: 0 });
                await trx('product_images')
                    .where({ id: primary.id })
                    .update({ is_primary: 1 });
            }

            await trx('products')
                .where({ id: productId })
                .update({ image_url: newPrimaryUrl });

            await trx.commit();

            const product = await this.getProductById(productId);
            return { product, deletedImageUrl };
        } catch (err) {
            await trx.rollback();
            throw err;
        }
    },

    async deleteProduct(id: number): Promise<void> {
        assertValidId(id, 'productId');
        const existing = await knex<ProductRow>('products').where({ id }).first();
        if (!existing) {
            throw new ProductNotFoundError(id);
        }

        await knex.transaction(async (trx) => {
            await trx('product_images').where({ product_id: id }).del();
            await trx('product_sizes').where({ product_id: id }).del();
            await trx('product_tags').where({ product_id: id }).del();
            await trx('products').where({ id }).del();
        });

        const productDir = path.join(process.cwd(), 'uploads', 'products', String(id));
        fs.rm(productDir, { recursive: true, force: true }, (err) => {
            if (err && (err as any).code !== 'ENOENT') {
                console.error(
                    '[productService.deleteProduct] Failed to remove directory',
                    productDir,
                    err
                );
            }
        });
    },
};
