// backend/src/services/productService.ts
// Ziel: camelCase im Service/Frontend, Snake-Case bleibt nur in der DB.
// - Alle Produkte haben IMMER ein sizes-Array (leer wenn keine vorhanden).
// - Alle Produkte haben IMMER ein images-Array (leer wenn keine vorhanden).

import { knex } from '../database';
import path from "path";
import fs from "fs";
import {Product, ProductImage, ProductImageRow, ProductQuery, ProductRow, ProductSize} from "../models/productModel";


function mapProductRow(row: ProductRow): Product {
    return {
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        price: Number(row.price),
        imageUrl: row.image_url ?? null,
        createdAt: row.created_at,
        sizes: [],
        images: [],
    };
}

function mapSizeRow(row: ProductSize): ProductSize {
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

export const productService = {
    // Liste mit optionalen Filtern (q, minPrice, maxPrice).
    // Jetzt IMMER inkl. sizes UND images.
    async getAllProducts(query: ProductQuery = {}): Promise<Product[]> {
        const { q, minPrice, maxPrice } = query;

        let sql = knex<ProductRow>('products').select('*');

        if (q && String(q).trim()) {
            sql = sql.where('name', 'like', `%${String(q).trim()}%`);
        }
        if (minPrice !== undefined && !Number.isNaN(Number(minPrice))) {
            sql = sql.andWhere('price', '>=', Number(minPrice));
        }
        if (maxPrice !== undefined && !Number.isNaN(Number(maxPrice))) {
            sql = sql.andWhere('price', '<=', Number(maxPrice));
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

        for (const p of products) {
            p.sizes = allSizes
                .filter((s) => s.product_id === p.id)
                .map(mapSizeRow);

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
        }

        return products;
    },

    // Einzelnes Produkt inkl. Sizes UND Images
    async getProductById(id: number): Promise<Product> {
        const productRow = await knex('products').where({ id }).first();
        if (!productRow) {
            throw Object.assign(new Error('Product not found'), { status: 404 });
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

        return product;
    },

    async createProduct(data: Partial<Product>): Promise<Product> {
        if (!data || typeof data.name !== 'string' || typeof data.price !== 'number') {
            throw Object.assign(new Error('name and price are required'), { status: 400 });
        }

        const [newId] = await knex('products').insert({
            name: data.name,
            description: data.description ?? null,
            price: data.price,
            image_url: data.imageUrl ?? null,
        });

        return await this.getProductById(newId);
    },

    async updateProduct(id: number, data: Partial<Product>): Promise<Product> {
        const existing = await knex('products').where({ id }).first();
        if (!existing) {
            throw Object.assign(new Error('Product not found'), { status: 404 });
        }

        await knex('products')
            .where({ id })
            .update({
                name: data.name ?? existing.name,
                description: data.description ?? existing.description,
                price:
                    typeof data.price === 'number'
                        ? data.price
                        : Number(existing.price),
                image_url: data.imageUrl ?? existing.image_url,
            });

        if (data.sizes) {
            await knex('product_sizes').where({ product_id: id }).del();

            for (const s of data.sizes) {
                let size = await knex('sizes').where({ label: s.label }).first();

                if (!size) {
                    const [newId] = await knex('sizes').insert({ label: s.label });
                    size = { id: newId, label: s.label };
                }

                await knex('product_sizes').insert({
                    product_id: id,
                    size_id: size.id,
                    stock: s.stock ?? 0,
                });
            }
        }

        return await this.getProductById(id);
    },

    // mehrere Bild-URLs zu einem Produkt hinzufügen
    async addImagesToProduct(
        productId: number,
        imageUrls: string[]
    ): Promise<Product> {
        const existing = await knex('products').where({ id: productId }).first();
        if (!existing) {
            throw Object.assign(new Error('Product not found'), { status: 404 });
        }

        if (!imageUrls || imageUrls.length === 0) {
            return await this.getProductById(productId);
        }

        let existingImages: ProductImageRow[] = [];
        try {
            existingImages = await knex('product_images')
                .where({ product_id: productId })
                .orderBy('sort_order', 'asc');
        } catch {
            throw Object.assign(
                new Error(
                    'Table "product_images" not found. Please create it in the database.'
                ),
                { status: 500 }
            );
        }

        const hasPrimaryAlready = existingImages.some(
            (img: any) => img.is_primary
        );
        let nextSortOrder =
            existingImages.length > 0
                ? (existingImages[existingImages.length - 1].sort_order ??
                existingImages.length - 1) + 1
                : 0;

        const inserts = imageUrls.map((url, index) => ({
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

    // 👇 NEU: einzelnes Bild löschen + Primary/Hauptbild sauber nachziehen
    async deleteProductImage(
        productId: number,
        imageId: number
    ): Promise<{ product: Product; deletedImageUrl: string }> {
        const trx = await knex.transaction();

        try {
            const image = await trx('product_images')
                .where({ id: imageId, product_id: productId })
                .first();

            if (!image) {
                await trx.rollback();
                throw Object.assign(new Error('Image not found'), { status: 404 });
            }

            const deletedImageUrl: string = image.url;

            // Bild löschen
            await trx('product_images').where({ id: imageId }).del();

            // Übrige Bilder holen
            const remaining = await trx('product_images')
                .where({ product_id: productId })
                .orderBy('sort_order', 'asc');

            let newPrimaryUrl: string | null = null;

            if (remaining.length > 0) {
                // Primary-Bild bestimmen
                let primary = remaining.find((img: any) => img.is_primary);
                if (!primary) {
                    primary = remaining[0];
                }

                newPrimaryUrl = primary.url;

                // Primary-Flags neu setzen
                await trx('product_images')
                    .where({ product_id: productId })
                    .update({ is_primary: 0 });
                await trx('product_images')
                    .where({ id: primary.id })
                    .update({ is_primary: 1 });
            }

            // products.image_url aktualisieren (kann auch null sein)
            await trx('products')
                .where({ id: productId })
                .update({ image_url: newPrimaryUrl });

            await trx.commit();

            const product = await this.getProductById(productId);
            return { product, deletedImageUrl };
        } catch (err) {
            (await knex.transaction()).rollback; // safety
            throw err;
        }
    },

    async deleteProduct(id: number): Promise<void> {
        const existing = await knex('products').where({ id }).first();
        if (!existing) {
            throw Object.assign(new Error('Product not found'), { status: 404 });
        }

        // 1) DB-Bereinigung in einer Transaktion
        await knex.transaction(async (trx) => {
            await trx('product_images').where({ product_id: id }).del();
            await trx('product_sizes').where({ product_id: id }).del();
            await trx('products').where({ id }).del();
        });

        // 2) Upload-Ordner auf Dateisystem löschen: /uploads/products/<id>
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
