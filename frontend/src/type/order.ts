// frontend/src/type/order.ts
import type { InsufficientStockResponse, Order, OrderSummary } from '@tvwallaushop/contracts';

export type { InsufficientStockResponse, Order, OrderSummary };

export type OrdersState = {
   items: Order[];
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
