// frontend/src/store/slices/cartSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';

/**
 * Ein Eintrag im Warenkorb.
 * Größe (sizeId) ist optional und kann auch null sein.
 */
export interface CartItem {
  productId?: number;
  name: string;
  price: number;
  quantity: number;
  sizeId?: number | null;
  /**
   * Anzeige-Label der Größe (z.B. "M", "L"), optional.
   */
  sizeLabel?: string | null;
  /**
   * Bild-URL des Produkts (relativer Pfad wie im Produkt.imageUrl / images[i].url)
   */
  imageUrl?: string | null;
}

interface CartState {
  items: CartItem[];
}

const initialState: CartState = {
  items: [],
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    /**
     * Legt ein Produkt in den Warenkorb.
     * Wenn bereits ein Eintrag mit derselben productId und sizeId existiert,
     * wird nur die Menge erhöht.
     */
    addToCart: (state, action: PayloadAction<CartItem>) => {
      const { productId, sizeId, quantity } = action.payload;
      const existing = state.items.find(
        (item) => item.productId === productId && item.sizeId === sizeId,
      );
      if (existing) {
        existing.quantity += quantity;
      } else {
        state.items.push(action.payload);
      }
    },

    /**
     * Setzt die Menge eines bestehenden Warenkorb-Eintrags.
     */
    updateQuantity: (
      state,
      action: PayloadAction<{
        productId: number;
        sizeId?: number | null;
        quantity: number;
      }>,
    ) => {
      const { productId, sizeId, quantity } = action.payload;
      const item = state.items.find(
        (i) => i.productId === productId && i.sizeId === sizeId,
      );
      if (item) {
        item.quantity = quantity;
      }
    },

    /**
     * Entfernt einen Warenkorb-Eintrag vollständig.
     */
    removeFromCart: (
      state,
      action: PayloadAction<{ productId: number; sizeId?: number | null }>,
    ) => {
      const { productId, sizeId } = action.payload;
      state.items = state.items.filter(
        (i) => !(i.productId === productId && i.sizeId === sizeId),
      );
    },

    /**
     * Leert den gesamten Warenkorb.
     */
    clearCart: (state) => {
      state.items = [];
    },
  },
});

export const { addToCart, updateQuantity, removeFromCart, clearCart } =
  cartSlice.actions;

export const selectCartItems = (state: RootState) => state.cart.items;
export default cartSlice.reducer;
