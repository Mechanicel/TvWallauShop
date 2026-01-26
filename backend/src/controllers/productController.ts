// backend/src/controllers/productController.ts

import { Request, Response } from 'express';
import fs from 'fs';
import { catchAsync } from '../utils/helpers';
import { ProductValidationError } from '../errors/ProductServiceError';
import { productService } from '../services/productService';
import { storageKeyToAbsolutePath } from '../utils/storage';

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
        throw new ProductValidationError('Invalid product id', { productId });
    }

    const anyReq = req as any;
    const files = (anyReq.files ?? []) as { filename: string }[];

    if (!files.length) {
        throw new ProductValidationError('No files uploaded');
    }

    const imageUrls: string[] = files.map((file) => {
        const normalized = file.filename.replace(/\\/g, '/');
        return `products/${productId}/${normalized}`;
    });

    const product = await productService.addImagesToProduct(productId, imageUrls);

    res.status(201).json(product);
});

// 👇 NEU: einzelnes Bild löschen
export const deleteProductImage = catchAsync(async (req: Request, res: Response) => {
    const productId = Number(req.params.id);
    const imageId = Number(req.params.imageId);

    if (!Number.isFinite(productId) || !Number.isFinite(imageId)) {
        throw new ProductValidationError('Invalid id', { productId, imageId });
    }

    const { product, deletedImageUrl } =
        await productService.deleteProductImage(productId, imageId);

    // Versuchen, die Datei vom Dateisystem zu löschen
    if (deletedImageUrl) {
        let absolutePath: string | null = null;
        try {
            absolutePath = storageKeyToAbsolutePath(deletedImageUrl);
        } catch {
            absolutePath = null;
        }

        if (!absolutePath) {
            res.status(200).json(product);
            return;
        }

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
