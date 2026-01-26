// frontend/src/store/slices/productSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import productService from '@/services/productService';
import type { CreateProductAiJobParams, Product, ProductAiJob, ProductPayload } from '@/type/product';
import type { RootState } from '..';
import { getApiErrorMessage } from '@/utils/error';

type ProductState = {
   products: Product[];
   loading: boolean;
   error: string | null;

   aiJobLoading: boolean;
   aiJobError: string | null;
   currentAiJob: ProductAiJob | null;
};

const initialState: ProductState = {
   products: [],
   loading: false,
   error: null,

   aiJobLoading: false,
   aiJobError: null,
   currentAiJob: null,
};

// --- Helper für Fehlertexte ---

const toErrorMessage = (err: unknown): string => {
   return getApiErrorMessage(err, 'Unbekannter Fehler bei der Produktanfrage');
};

// --- Thunks ---

type ProductQueryParams = {
   q?: string;
   minPrice?: number;
   maxPrice?: number;
   limit?: number;
};

export const fetchProducts = createAsyncThunk<Product[], ProductQueryParams | undefined, { rejectValue: string }>(
   'product/fetchAll',
   async (params, { rejectWithValue }) => {
      try {
         return await productService.getProducts(params);
      } catch (err) {
         return rejectWithValue(toErrorMessage(err));
      }
   },
);

export const addProduct = createAsyncThunk<Product, ProductPayload, { rejectValue: string }>(
   'product/add',
   async (payload, { rejectWithValue }) => {
      try {
         return await productService.addProduct(payload);
      } catch (err) {
         return rejectWithValue(toErrorMessage(err));
      }
   },
);

export const updateProduct = createAsyncThunk<
   Product,
   { id: number; changes: Partial<ProductPayload> },
   { rejectValue: string }
>('product/update', async ({ id, changes }, { rejectWithValue }) => {
   try {
      return await productService.updateProduct(id, changes);
   } catch (err) {
      return rejectWithValue(toErrorMessage(err));
   }
});

export const deleteProduct = createAsyncThunk<number, number, { rejectValue: string }>(
   'product/delete',
   async (id, { rejectWithValue }) => {
      try {
         return await productService.deleteProduct(id);
      } catch (err) {
         return rejectWithValue(toErrorMessage(err));
      }
   },
);

export const uploadProductImages = createAsyncThunk<Product, { id: number; files: File[] }, { rejectValue: string }>(
   'product/uploadImages',
   async ({ id, files }, { rejectWithValue }) => {
      try {
         return await productService.uploadProductImages(id, files);
      } catch (err) {
         return rejectWithValue(toErrorMessage(err));
      }
   },
);

export const deleteProductImage = createAsyncThunk<
   Product,
   { productId: number; imageId: number },
   { rejectValue: string }
>('product/deleteImage', async ({ productId, imageId }, { rejectWithValue }) => {
   try {
      return await productService.deleteProductImage(productId, imageId);
   } catch (err) {
      return rejectWithValue(toErrorMessage(err));
   }
});

export const finalizeProductAiJob = createAsyncThunk<
   Product,
   { jobId: number; payload: ProductPayload },
   { rejectValue: string }
>('product/finalizeAiJob', async ({ jobId, payload }, { rejectWithValue }) => {
   try {
      return await productService.finalizeProductAiJob(jobId, payload);
   } catch (err) {
      return rejectWithValue(toErrorMessage(err));
   }
});

// KI-Job anlegen (Bilder + Preis -> product_ai_jobs-Eintrag)

export const createProductAiJob = createAsyncThunk<ProductAiJob, CreateProductAiJobParams, { rejectValue: string }>(
   'product/createAiJob',
   async (params, { rejectWithValue }) => {
      try {
         return await productService.createProductAiJob(params);
      } catch (err) {
         return rejectWithValue(toErrorMessage(err));
      }
   },
);

// --- Slice ---

const productSlice = createSlice({
   name: 'product',
   initialState,
   reducers: {
      resetProductError(state) {
         state.error = null;
      },
      resetAiJobState(state) {
         state.aiJobLoading = false;
         state.aiJobError = null;
         state.currentAiJob = null;
      },
   },
   extraReducers: (builder) => {
      // fetchProducts
      builder.addCase(fetchProducts.pending, (state) => {
         state.loading = true;
         state.error = null;
      });
      builder.addCase(fetchProducts.fulfilled, (state, action: PayloadAction<Product[]>) => {
         state.loading = false;
         state.products = action.payload;
      });
      builder.addCase(fetchProducts.rejected, (state, action) => {
         state.loading = false;
         state.error = action.payload ?? 'Produkte konnten nicht geladen werden';
      });

      // addProduct
      builder.addCase(addProduct.pending, (state) => {
         state.loading = true;
         state.error = null;
      });
      builder.addCase(addProduct.fulfilled, (state, action: PayloadAction<Product>) => {
         state.loading = false;
         state.products.push(action.payload);
      });
      builder.addCase(addProduct.rejected, (state, action) => {
         state.loading = false;
         state.error = action.payload ?? 'Produkt konnte nicht erstellt werden';
      });

      // updateProduct
      builder.addCase(updateProduct.pending, (state) => {
         state.loading = true;
         state.error = null;
      });
      builder.addCase(updateProduct.fulfilled, (state, action: PayloadAction<Product>) => {
         state.loading = false;
         const idx = state.products.findIndex((p) => p.id === action.payload.id);
         if (idx !== -1) {
            state.products[idx] = action.payload;
         }
      });
      builder.addCase(updateProduct.rejected, (state, action) => {
         state.loading = false;
         state.error = action.payload ?? 'Produkt konnte nicht aktualisiert werden';
      });

      // deleteProduct
      builder.addCase(deleteProduct.pending, (state) => {
         state.loading = true;
         state.error = null;
      });
      builder.addCase(deleteProduct.fulfilled, (state, action: PayloadAction<number>) => {
         state.loading = false;
         state.products = state.products.filter((p) => p.id !== action.payload);
      });
      builder.addCase(deleteProduct.rejected, (state, action) => {
         state.loading = false;
         state.error = action.payload ?? 'Produkt konnte nicht gelöscht werden';
      });

      // uploadProductImages
      builder.addCase(uploadProductImages.pending, (state) => {
         state.loading = true;
         state.error = null;
      });
      builder.addCase(uploadProductImages.fulfilled, (state, action: PayloadAction<Product>) => {
         state.loading = false;
         const idx = state.products.findIndex((p) => p.id === action.payload.id);
         if (idx !== -1) {
            state.products[idx] = action.payload;
         }
      });
      builder.addCase(uploadProductImages.rejected, (state, action) => {
         state.loading = false;
         state.error = action.payload ?? 'Bilder konnten nicht hochgeladen werden';
      });

      // deleteProductImage
      builder.addCase(deleteProductImage.pending, (state) => {
         state.loading = true;
         state.error = null;
      });
      builder.addCase(deleteProductImage.fulfilled, (state, action: PayloadAction<Product>) => {
         state.loading = false;
         const idx = state.products.findIndex((p) => p.id === action.payload.id);
         if (idx !== -1) {
            state.products[idx] = action.payload;
         }
      });
      builder.addCase(deleteProductImage.rejected, (state, action) => {
         state.loading = false;
         state.error = action.payload ?? 'Bild konnte nicht gelöscht werden';
      });

      // createProductAiJob
      builder.addCase(createProductAiJob.pending, (state) => {
         state.aiJobLoading = true;
         state.aiJobError = null;
         state.currentAiJob = null;
      });
      builder.addCase(createProductAiJob.fulfilled, (state, action: PayloadAction<ProductAiJob>) => {
         state.aiJobLoading = false;
         state.currentAiJob = action.payload;
      });
      builder.addCase(createProductAiJob.rejected, (state, action) => {
         state.aiJobLoading = false;
         state.aiJobError = action.payload ?? 'KI-Job konnte nicht angelegt werden';
         state.currentAiJob = null;
      });

      // finalizeProductAiJob
      builder.addCase(finalizeProductAiJob.pending, (state) => {
         state.loading = true;
         state.error = null;
      });
      builder.addCase(finalizeProductAiJob.fulfilled, (state, action: PayloadAction<Product>) => {
         state.loading = false;
         const idx = state.products.findIndex((p) => p.id === action.payload.id);
         if (idx === -1) {
            state.products.push(action.payload);
         } else {
            state.products[idx] = action.payload;
         }
      });
      builder.addCase(finalizeProductAiJob.rejected, (state, action) => {
         state.loading = false;
         state.error = action.payload ?? 'KI-Produkt konnte nicht fertiggestellt werden';
      });
   },
});

// --- Selectors ---

export const selectProducts = (state: RootState) => state.product.products;
export const selectProductLoading = (state: RootState) => state.product.loading;
export const selectProductError = (state: RootState) => state.product.error;

export const selectProductAiJobLoading = (state: RootState) => state.product.aiJobLoading;
export const selectProductAiJobError = (state: RootState) => state.product.aiJobError;
export const selectCurrentProductAiJob = (state: RootState) => state.product.currentAiJob;

export const { resetProductError, resetAiJobState } = productSlice.actions;

export default productSlice.reducer;
