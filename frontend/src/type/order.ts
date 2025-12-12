// frontend/src/type/order.ts

import { User } from './user';

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
// Payload für neue Bestellungen
export interface PlaceOrderPayload {
   name: string;
   email: string;
   address: string;
   items: {
      productId: number;
      quantity: number;
      price: number;
      sizeId?: number;
   }[];
}

// Response-Form für den fachlichen Fehler "INSUFFICIENT_STOCK"
export interface InsufficientStockResponseDetails {
   productId: number;
   sizeId: number | null;
   available: number;
   requested: number;
}

export interface InsufficientStockResponse {
   success?: false;
   code: 'INSUFFICIENT_STOCK';
   message?: string;
   details?: InsufficientStockResponseDetails | InsufficientStockResponseDetails[];
}

/** User-Order (me) – minimaler Shape wie dein /orders/me Endpoint */
export interface OrderMeItem {
   productName: string;
   sizeLabel: string;
   quantity: number;
   price: number;
}

export interface OrderMe {
   id: number;
   status: string;
   createdAt: string;
   items: OrderMeItem[];
   total: number;
}

/** Detail (GET /orders/:id) – kommt bei dir inkl. total */
export interface OrderDetailResponse {
   id: number;
   status: string;
   createdAt: string;
   items: OrderMeItem[];
   total: number;
   // user wird ggf. mitgeliefert (backend), brauchen wir hier nicht zwingend
   user?: any;
}
