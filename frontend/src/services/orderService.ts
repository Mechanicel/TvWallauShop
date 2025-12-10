// frontend/src/services/orderService.ts

import api from './api';
import type { OrderExtended } from '../type/order';

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

const getOrders = async (): Promise<OrderExtended[]> => {
  const { data } = await api.get('/orders');
  console.log(data);
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

const placeOrder = async (
  payload: PlaceOrderPayload,
): Promise<OrderExtended> => {
  const { data } = await api.post('/orders', payload);
  return data;
};

const orderService = {
  getOrders,
  updateOrderStatus,
  deleteOrder,
  placeOrder,
};

export default orderService;
