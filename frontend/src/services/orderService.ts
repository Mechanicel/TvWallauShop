// frontend/src/services/orderService.ts

import api from './api';
import type { OrderExtended } from '@/type/order';

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

// Alle Orders laden
const getOrders = async (): Promise<OrderExtended[]> => {
  const { data } = await api.get('/orders');
  return data;
};

const updateOrderStatus = async (
    orderId: number,
    status: string,
): Promise<OrderExtended> => {
  const { data } = await api.put(`/orders/${orderId}/status`, { status });
  return data;
};

const deleteOrder = async (orderId: number): Promise<void> => {
  await api.delete(`/orders/${orderId}`);
};

// Neue Bestellung anlegen
export const placeOrder = async (
    payload: PlaceOrderPayload,
): Promise<OrderExtended> => {
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
};

export default orderService;
