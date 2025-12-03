// backend/src/controllers/productController.ts

import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { catchAsync } from '../utils/helpers';
import { productService } from '../services/productService';

export const getAllProducts = catchAsync(async (req: Request, res: Response) => {
    const products = await productService.getAllProducts(req.query);
    res.status(200).json(products);
});

export const getProductById = catchAsync(async (req: Request, res: Response) => {
    const product = await productService.getProductById(Number(req.params.id));
    res.status(200).json(product);
});

export const createProduct = catchAsync(async (req: Request, res: Response) => {
    const product = await productService.createProduct(req.body);
    res.status(201).json(product);
});

export const updateProduct = catchAsync(async (req: Request, res: Response) => {
    const product = await productService.updateProduct(
        Number(req.params.id),
        req.body
    );
    res.status(200).json(product);
});

export const deleteProduct = catchAsync(async (req: Request, res: Response) => {
    await productService.deleteProduct(Number(req.params.id));
    res.sendStatus(204);
});

// Bilder hochladen
export const uploadProductImages = catchAsync(async (req: Request, res: Response) => {
    const productId = Number(req.params.id);

    if (!Number.isFinite(productId)) {
        throw Object.assign(new Error('Invalid product id'), { status: 400 });
    }

    const anyReq = req as any;
    const files = (anyReq.files ?? []) as { filename: string }[];

    if (!files.length) {
        throw Object.assign(new Error('No files uploaded'), { status: 400 });
    }

    const imageUrls: string[] = files.map((file) => {
        const normalized = file.filename.replace(/\\/g, '/');
        return `/uploads/products/${productId}/${normalized}`;
    });

    const product = await productService.addImagesToProduct(productId, imageUrls);

    res.status(201).json(product);
});

// 👇 NEU: einzelnes Bild löschen
export const deleteProductImage = catchAsync(async (req: Request, res: Response) => {
    const productId = Number(req.params.id);
    const imageId = Number(req.params.imageId);

    if (!Number.isFinite(productId) || !Number.isFinite(imageId)) {
        throw Object.assign(new Error('Invalid id'), { status: 400 });
    }

    const { product, deletedImageUrl } =
        await productService.deleteProductImage(productId, imageId);

    // Versuchen, die Datei vom Dateisystem zu löschen
    if (deletedImageUrl) {
        const relative = deletedImageUrl.replace(/^\//, ''); // "/uploads/..." -> "uploads/..."
        const absolutePath = path.join(process.cwd(), relative);

        fs.unlink(absolutePath, (err) => {
            if (err && (err as any).code !== 'ENOENT') {
                console.error(
                    '[productController.deleteProductImage] Failed to delete file',
                    absolutePath,
                    err
                );
            }
        });
    }

    res.status(200).json(product);
});
