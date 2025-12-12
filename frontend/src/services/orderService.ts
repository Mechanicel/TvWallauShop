// frontend/src/services/orderService.ts

import api from './api';
import type {
   InsufficientStockResponse,
   OrderDetailResponse,
   OrderExtended,
   OrderMe,
   PlaceOrderPayload,
} from '@/type/order';

// Alle Orders laden (Admin)
const getOrders = async (): Promise<OrderExtended[]> => {
   const { data } = await api.get('/orders');
   return data;
};

const updateOrderStatus = async (orderId: number, status: string): Promise<OrderExtended> => {
   const { data } = await api.put(`/orders/${orderId}/status`, { status });
   return data;
};

const deleteOrder = async (orderId: number): Promise<void> => {
   await api.delete(`/orders/${orderId}`);
};

// ✅ NEU: eigene Orders laden
const getMyOrders = async (): Promise<OrderMe[]> => {
   const { data } = await api.get('/orders/me');
   return data;
};

// ✅ NEU: Order Detail laden
const getOrderById = async (orderId: number): Promise<OrderDetailResponse> => {
   const { data } = await api.get(`/orders/${orderId}`);
   return data;
};

// ✅ NEU: eigene Order stornieren
const cancelMyOrder = async (orderId: number): Promise<OrderMe> => {
   const { data } = await api.post(`/orders/me/${orderId}/cancel`);
   return data;
};

// Neue Bestellung anlegen
export const placeOrder = async (payload: PlaceOrderPayload): Promise<OrderExtended> => {
   const { data } = await api.post('/orders', payload);

   // Backend liefert Business-Fehler INSF jetzt mit HTTP 200 und Payload
   if (data && typeof data === 'object' && (data as any).code === 'INSUFFICIENT_STOCK') {
      const insufficient = data as InsufficientStockResponse;

      const error: any = new Error(
         insufficient.message ||
            'Ein Artikel ist nicht mehr in der gewünschten Menge verfügbar. Bitte prüfe deinen Warenkorb und passe die Mengen an.',
      );

      // 🔹 WICHTIG: Metadaten dranhängen, damit sie im Thunk ausgewertet werden können
      error.code = insufficient.code;
      error.details = insufficient.details;
      error.status = 200;

      throw error;
   }

   // Erfolgsfall: Backend liefert wie bisher direkt die Order zurück
   return data as OrderExtended;
};

const orderService = {
   getOrders,
   updateOrderStatus,
   deleteOrder,
   placeOrder,

   // ✅ user-features
   getMyOrders,
   getOrderById,
   cancelMyOrder,
};

export default orderService;
