// frontend/src/services/productService.ts

import api from './api';
import type { Product } from '../type/product';

export interface ProductPayload {
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    sizes: { id: string | number; label: string; stock: number }[];
}

const getProduct = async (id: number): Promise<Product> => {
    const { data } = await api.get(`/products/${id}`);
    return data;
};

const getProducts = async (): Promise<Product[]> => {
    const { data } = await api.get('/products');
    return data;
};

const addProduct = async (payload: ProductPayload): Promise<Product> => {
    const { data } = await api.post('/products', payload);
    return data;
};

const updateProduct = async (
    id: number,
    changes: Partial<ProductPayload>
): Promise<Product> => {
    const { data } = await api.put(`/products/${id}`, changes);
    return data;
};

const deleteProduct = async (id: number): Promise<void> => {
    await api.delete(`/products/${id}`);
};

const uploadProductImages = async (
    id: number,
    files: File[]
): Promise<Product> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));

    const { data } = await api.post(`/products/${id}/images`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return data;
};

// 👇 NEU: einzelnes Bild löschen
const deleteProductImage = async (
    productId: number,
    imageId: number
): Promise<Product> => {
    const { data } = await api.delete(
        `/products/${productId}/images/${imageId}`
    );
    return data;
};

const productService = {
    getProducts,
    getProduct,
    addProduct,
    updateProduct,
    deleteProduct,
    uploadProductImages,
    deleteProductImage, // 👈 neu
};

export default productService;
