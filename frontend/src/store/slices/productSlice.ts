// frontend/src/store/slices/productSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import productService, { ProductPayload } from '@/services/productService';
import type { Product } from '@/type/product';
import type { RootState } from '..';

type ProductState = {
  products: Product[];
  loading: boolean;
  error: string | null;
};

const initialState: ProductState = {
  products: [],
  loading: false,
  error: null,
};

// --- Thunks ---

export const fetchProducts = createAsyncThunk<Product[]>(
  'products/fetchAll',
  async () => {
    return await productService.getProducts();
  },
);

export const addProduct = createAsyncThunk<Product, ProductPayload>(
  'products/add',
  async (payload) => {
    return await productService.addProduct(payload);
  },
);

export const updateProduct = createAsyncThunk<
  Product,
  { id: number; changes: Partial<ProductPayload> }
>('products/update', async ({ id, changes }) => {
  return await productService.updateProduct(id, changes);
});

export const deleteProduct = createAsyncThunk<number, number>(
  'products/delete',
  async (id) => {
    await productService.deleteProduct(id);
    return id;
  },
);

export const uploadProductImages = createAsyncThunk<
  Product,
  { id: number; files: File[] }
>('products/uploadImages', async ({ id, files }) => {
  return await productService.uploadProductImages(id, files);
});

// 👇 NEU: Bild löschen
export const deleteProductImage = createAsyncThunk<
  Product,
  { productId: number; imageId: number }
>('products/deleteImage', async ({ productId, imageId }) => {
  return await productService.deleteProductImage(productId, imageId);
});

// --- Slice ---

const productSlice = createSlice({
  name: 'product',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // fetch
    builder.addCase(fetchProducts.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(
      fetchProducts.fulfilled,
      (state, action: PayloadAction<Product[]>) => {
        state.products = action.payload;
        state.loading = false;
      },
    );
    builder.addCase(fetchProducts.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message ?? 'Fehler beim Laden der Produkte';
    });

    // add
    builder.addCase(
      addProduct.fulfilled,
      (state, action: PayloadAction<Product>) => {
        state.products.push(action.payload);
      },
    );

    // update
    builder.addCase(
      updateProduct.fulfilled,
      (state, action: PayloadAction<Product>) => {
        const idx = state.products.findIndex((p) => p.id === action.payload.id);
        if (idx >= 0) state.products[idx] = action.payload;
      },
    );

    // delete
    builder.addCase(
      deleteProduct.fulfilled,
      (state, action: PayloadAction<number>) => {
        state.products = state.products.filter((p) => p.id !== action.payload);
      },
    );

    // upload images
    builder.addCase(
      uploadProductImages.fulfilled,
      (state, action: PayloadAction<Product>) => {
        const idx = state.products.findIndex((p) => p.id === action.payload.id);
        if (idx >= 0) {
          state.products[idx] = action.payload;
        } else {
          state.products.push(action.payload);
        }
      },
    );

    // 👇 Bild löschen – Produkt im State aktualisieren
    builder.addCase(
      deleteProductImage.fulfilled,
      (state, action: PayloadAction<Product>) => {
        const idx = state.products.findIndex((p) => p.id === action.payload.id);
        if (idx >= 0) {
          state.products[idx] = action.payload;
        }
      },
    );
  },
});

// --- Selectors ---

export const selectProducts = (state: RootState) => state.product.products;
export const selectProductLoading = (state: RootState) => state.product.loading;
export const selectProductError = (state: RootState) => state.product.error;

export default productSlice.reducer;
