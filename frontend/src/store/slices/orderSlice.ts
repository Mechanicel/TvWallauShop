// frontend/src/store/slices/orderSlice.ts

import type { AxiosError } from 'axios';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import orderService, { PlaceOrderPayload } from '@/services/orderService';
import type { OrderExtended } from '@/type/order';
import type { RootState } from '..';
import { isAxiosError } from 'axios';

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

type OrderErrorPayload = {
    code?: string;   // z.B. 'INSUFFICIENT_STOCK' oder 'ERR_NETWORK'
    message?: string;
    status?: number; // HTTP-Status, z.B. 400, 500, 200 bei Business-Fehler
    details?: unknown; // hier kommen unsere productId/sizeId-Details rein
};

// 🔹 Orders laden
export const fetchOrders = createAsyncThunk<OrderExtended[]>(
    'orders/fetchOrders',
    async () => {
        return await orderService.getOrders();
    },
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
    },
);

// 🔹 Neue Bestellung anlegen (Checkout)
export const placeOrder = createAsyncThunk<
    OrderExtended,
    PlaceOrderPayload,
    { rejectValue: OrderErrorPayload }
>(
    'orders/placeOrder',
    async (payload, { rejectWithValue }) => {
        try {
            const order = await orderService.placeOrder(payload);
            return order;
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
                    | { code?: string; message?: string; details?: unknown }
                    | undefined;

                return rejectWithValue({
                    code: data?.code ?? axiosErr.code,
                    message: data?.message ?? axiosErr.message,
                    details: data?.details ?? (axiosErr as any).details,
                    status,
                });
            }

            // 🔸 3) Andere Fehler (kein Axios, kein Business-Code)
            if (err instanceof Error) {
                return rejectWithValue({ message: err.message });
            }

            return rejectWithValue({
                message: 'Unbekannter Fehler beim Anlegen der Bestellung.',
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
        builder.addCase(
            fetchOrders.fulfilled,
            (state, action: PayloadAction<OrderExtended[]>) => {
                state.items = action.payload;
                state.loading = false;
            },
        );
        builder.addCase(fetchOrders.rejected, (state, action) => {
            state.loading = false;
            state.error =
                action.error.message ?? 'Fehler beim Laden der Bestellungen';
        });

        // updateOrderStatus
        builder.addCase(
            updateOrderStatus.fulfilled,
            (state, action: PayloadAction<OrderExtended>) => {
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
            },
        );

        // deleteOrder
        builder.addCase(
            deleteOrder.fulfilled,
            (state, action: PayloadAction<number>) => {
                state.items = state.items.filter((o) => o.id !== action.payload);
            },
        );

        // placeOrder – Erfolgsfall
        builder.addCase(
            placeOrder.fulfilled,
            (state, action: PayloadAction<OrderExtended>) => {
                state.items.push(action.payload);
            },
        );
    },
});

// 🔹 Selectors
export const selectOrders = (state: RootState) => state.order.items;
export const selectOrderLoading = (state: RootState) => state.order.loading;

export default ordersSlice.reducer;
