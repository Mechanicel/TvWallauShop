// frontend/src/store/slices/orderSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import orderService, { PlaceOrderPayload } from '../../services/orderService';
import type { OrderExtended } from '../../type/order';
import type { RootState } from '..';

type OrdersState = {
    items: OrderExtended[];
    loading: boolean;
    error: string | null;
};

const initialState: OrdersState = {
    items: [],
    loading: false,
    error: null,
};

// 🔹 Orders laden
export const fetchOrders = createAsyncThunk<OrderExtended[]>(
    'orders/fetchOrders',
    async () => {
        return await orderService.getOrders();
    }
);

// 🔹 Status aktualisieren
export const updateOrderStatus = createAsyncThunk<
    OrderExtended,
    { orderId: number; status: string }
>('orders/updateOrderStatus', async ({ orderId, status }) => {
    return await orderService.updateOrderStatus(orderId, status);
});

// 🔹 Order löschen
export const deleteOrder = createAsyncThunk<number, number>(
    'orders/deleteOrder',
    async (orderId) => {
        await orderService.deleteOrder(orderId);
        return orderId;
    }
);

// 🔹 Neue Bestellung anlegen (Checkout)
export const placeOrder = createAsyncThunk<OrderExtended, PlaceOrderPayload>(
    'orders/placeOrder',
    async (payload) => {
        return await orderService.placeOrder(payload);
    }
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
        builder.addCase(fetchOrders.fulfilled, (state, action: PayloadAction<OrderExtended[]>) => {
            state.items = action.payload;
            state.loading = false;
        });
        builder.addCase(fetchOrders.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message ?? 'Fehler beim Laden der Bestellungen';
        });

        // updateOrderStatus
        builder.addCase(
            updateOrderStatus.fulfilled,
            (state, action: PayloadAction<OrderExtended>) => {
                const idx = state.items.findIndex(
                    (o) => o.id === action.payload.id
                );
                if (idx >= 0) {
                    const current = state.items[idx];
                    const incoming = action.payload as any;

                    state.items[idx] = {
                        ...current,
                        ...incoming,
                        // falls Backend nur Teil-User schickt, behalten wir die
                        // vorhandenen Felder und überschreiben nur, was kommt
                        user: {
                            ...(current as any).user,
                            ...(incoming.user ?? {}),
                        },
                        // falls Items gar nicht mitkommen, behalten wir die alten
                        items: incoming.items ?? current.items,
                    };
                }
            }
        );

        // deleteOrder
        builder.addCase(deleteOrder.fulfilled, (state, action: PayloadAction<number>) => {
            state.items = state.items.filter((o) => o.id !== action.payload);
        });

        // placeOrder
        builder.addCase(placeOrder.fulfilled, (state, action: PayloadAction<OrderExtended>) => {
            state.items.push(action.payload);
        });
    },
});

// 🔹 Selectors
export const selectOrders = (state: RootState) => state.order.items;
export const selectOrderLoading = (state: RootState) => state.order.loading;

export default ordersSlice.reducer;
