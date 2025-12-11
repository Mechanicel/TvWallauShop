// frontend/src/services/productService.ts

import api from './api';
import type { CreateProductAiJobParams, Product, ProductAiJob, ProductPayload } from '@/type/product';

// --- Standard Produkt-Endpunkte ---

const getProducts = async (): Promise<Product[]> => {
   const { data } = await api.get('/products');
   return data;
};

const getProduct = async (id: number): Promise<Product> => {
   const { data } = await api.get(`/products/${id}`);
   return data;
};

const addProduct = async (payload: ProductPayload): Promise<Product> => {
   const { data } = await api.post('/products', payload);
   return data;
};

const updateProduct = async (id: number, changes: Partial<ProductPayload>): Promise<Product> => {
   const { data } = await api.put(`/products/${id}`, changes);
   return data;
};

const deleteProduct = async (id: number): Promise<number> => {
   await api.delete(`/products/${id}`);
   return id;
};

const uploadProductImages = async (id: number, files: File[]): Promise<Product> => {
   const formData = new FormData();
   files.forEach((file) => formData.append('images', file));

   const { data } = await api.post(`/products/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
   });
   return data;
};

const deleteProductImage = async (productId: number, imageId: number): Promise<Product> => {
   const { data } = await api.delete(`/products/${productId}/images/${imageId}`);
   return data;
};

// --- KI-Job Endpoint ---

const createProductAiJob = async (params: CreateProductAiJobParams): Promise<ProductAiJob> => {
   const formData = new FormData();
   formData.append('price', String(params.price));
   params.files.forEach((file) => formData.append('images', file));

   // Achtung: Backend sollte diesen Endpoint bereitstellen (/api ist im api-Client schon enthalten)
   const { data } = await api.post('/ai/product-job', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
   });
   return data;
};

const productService = {
   getProducts,
   getProduct,
   addProduct,
   updateProduct,
   deleteProduct,
   uploadProductImages,
   deleteProductImage,
   createProductAiJob,
};

export default productService;
