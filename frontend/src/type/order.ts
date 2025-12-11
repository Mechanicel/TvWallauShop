// frontend/src/type/order.ts

import { User } from './user';
import { createAsyncThunk } from '@reduxjs/toolkit';
import orderService from '@/services/orderService';

export interface OrderItem {
   productId: number;
   productName: string;
   sizeId: number;
   sizeLabel: string;
   quantity: number;
   price: number;
}

export interface OrderExtended {
   id: number;
   user: User;
   status: 'Bestellt' | 'Bezahlt' | 'Storniert';
   createdAt: string; // ISO-String des Zeitpunkts
   items: OrderItem[]; // Alle Line-Items dieser Bestellung
}

export type OrdersState = {
   items: OrderExtended[];
   loading: boolean;
   error: string | null;
};

export const initialState: OrdersState = {
   items: [],
   loading: false,
   error: null,
};

export type OrderErrorPayload = {
   code?: string; // z.B. 'INSUFFICIENT_STOCK' oder 'ERR_NETWORK'
   message?: string;
   status?: number; // HTTP-Status, z.B. 400, 500, 200 bei Business-Fehler
   details?: unknown; // hier kommen unsere productId/sizeId-Details rein
};
