// frontend/src/services/productService.ts

import api from './api';
import type { CreateProductAiJobParams, Product, ProductAiJob, ProductPayload } from '@/type/product';

/* ============================================================================
 *  Standard Produkt-Endpunkte
 * ========================================================================== */

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

/* ============================================================================
 *  Produktbilder
 * ========================================================================== */

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

/* ============================================================================
 *  KI-Produkt-Jobs
 * ========================================================================== */

/**
 * Erstellt einen neuen KI-Job (Bilder + Preis)
 * POST /api/ai/product-job
 */
const createProductAiJob = async (params: CreateProductAiJobParams): Promise<ProductAiJob> => {
   const formData = new FormData();
   formData.append('price', String(params.price));
   params.files.forEach((file) => formData.append('images', file));

   const { data } = await api.post('/ai/product-job', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
   });

   return data;
};

/**
 * Retry für bestehenden KI-Job
 * POST /api/ai/product-job/:id/retry
 */
const retryProductAiJob = async (jobId: number): Promise<ProductAiJob> => {
   const { data } = await api.post(`/ai/product-job/${jobId}/retry`);
   return data;
};

/**
 * Offene KI-Jobs laden (Queue-Restore nach Reload)
 * GET /api/ai/product-jobs/open
 */
const getOpenProductAiJobs = async (): Promise<ProductAiJob[]> => {
   const { data } = await api.get('/ai/product-jobs/open');
   return data;
};
/**
 * KI-Job komplett löschen (inkl. Bilder)
 */
const deleteProductAiJob = async (jobId: number): Promise<void> => {
   await api.delete(`/ai/product-job/${jobId}`);
};
/* ============================================================================
 *  Export
 * ========================================================================== */

const productService = {
   // Produkte
   getProducts,
   getProduct,
   addProduct,
   updateProduct,
   deleteProduct,

   // Bilder
   uploadProductImages,
   deleteProductImage,

   // KI-Jobs
   createProductAiJob,
   retryProductAiJob,
   getOpenProductAiJobs,
   deleteProductAiJob,
};

export default productService;
