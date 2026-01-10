// frontend/src/store/slices/orderSlice.ts

import type { AxiosError } from 'axios';
import { isAxiosError } from 'axios';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import orderService from '@/services/orderService';
import type { PlaceOrderPayload } from '@/type/order';
import type { Order } from '@tvwallaushop/contracts';
import { initialState, OrderErrorPayload } from '@/type/order';
import type { RootState } from '..';
import { getApiErrorMessage } from '@/utils/error';

// 🔹 Orders laden
export const fetchOrders = createAsyncThunk<Order[]>('orders/fetchOrders', async () => {
   return await orderService.getOrders();
});

// 🔹 Status aktualisieren
export const updateOrderStatus = createAsyncThunk<Order, { orderId: number; status: string }>(
   'orders/updateOrderStatus',
   async ({ orderId, status }) => {
      return await orderService.updateOrderStatus(orderId, status);
   },
);

// 🔹 Order löschen
export const deleteOrder = createAsyncThunk<number, number>('orders/deleteOrder', async (orderId) => {
   await orderService.deleteOrder(orderId);
   return orderId;
});

// 🔹 Neue Bestellung anlegen (Checkout)
export const placeOrder = createAsyncThunk<Order, PlaceOrderPayload, { rejectValue: OrderErrorPayload }>(
   'orders/placeOrder',
   async (payload, { rejectWithValue }) => {
      try {
         return await orderService.placeOrder(payload);
      } catch (err: any) {
         // 🔸 1) Business-Fehler, den wir selbst in orderService geworfen haben
         if (err && typeof err === 'object' && err.code === 'INSUFFICIENT_STOCK') {
            return rejectWithValue({
               code: err.code,
               message: err.message,
               status: err.status,
               details: err.details,
            });
         }

         // 🔸 2) Axios-Fehler → in ein sauberes, serialisierbares Objekt umwandeln
         if (isAxiosError(err)) {
            const axiosErr = err as AxiosError<any>;
            const status = axiosErr.response?.status;
            const data = axiosErr.response?.data as
               | { code?: string; message?: string; error?: string; details?: unknown }
               | undefined;

            return rejectWithValue({
               code: data?.code ?? axiosErr.code,
               message: data?.message ?? data?.error ?? axiosErr.message,
               details: data?.details ?? (axiosErr as any).details,
               status,
            });
         }

         // 🔸 3) Andere Fehler (kein Axios, kein Business-Code)
         if (err instanceof Error) {
            return rejectWithValue({ message: getApiErrorMessage(err, err.message) });
         }

         return rejectWithValue({
            message: getApiErrorMessage(err, 'Unbekannter Fehler beim Anlegen der Bestellung.'),
         });
      }
   },
);

const ordersSlice = createSlice({
   name: 'orders',
   initialState,
   reducers: {},
   extraReducers: (builder) => {
      // fetchOrders
      builder.addCase(fetchOrders.pending, (state) => {
         state.loading = true;
         state.error = null;
      });
      builder.addCase(fetchOrders.fulfilled, (state, action: PayloadAction<Order[]>) => {
         state.items = action.payload;
         state.loading = false;
      });
      builder.addCase(fetchOrders.rejected, (state, action) => {
         state.loading = false;
         state.error = action.error.message ?? 'Fehler beim Laden der Bestellungen';
      });

      // updateOrderStatus
      builder.addCase(updateOrderStatus.fulfilled, (state, action: PayloadAction<Order>) => {
         const idx = state.items.findIndex((o) => o.id === action.payload.id);
         if (idx >= 0) {
            const current = state.items[idx];
            const incoming = action.payload as any;

            state.items[idx] = {
               ...current,
               ...incoming,
               user: {
                  ...(current as any).user,
                  ...(incoming.user ?? {}),
               },
               items: incoming.items ?? current.items,
            };
         }
      });

      // deleteOrder
      builder.addCase(deleteOrder.fulfilled, (state, action: PayloadAction<number>) => {
         state.items = state.items.filter((o) => o.id !== action.payload);
      });

      // placeOrder – Erfolgsfall
      builder.addCase(placeOrder.fulfilled, (state, action: PayloadAction<Order>) => {
         state.items.push(action.payload);
      });
   },
});

// 🔹 Selectors
export const selectOrders = (state: RootState) => state.order.items;
export const selectOrderLoading = (state: RootState) => state.order.loading;

export default ordersSlice.reducer;
