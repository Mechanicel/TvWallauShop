import type { User } from './user';

export interface OrderItem {
  productId: number;
  productName: string;
  sizeId: number;
  sizeLabel: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: number;
  user: User;
  status: string;
  createdAt: string;
  items: OrderItem[];
  total: number;
}

export interface OrderSummaryItem {
  productName: string;
  sizeLabel: string;
  quantity: number;
  price: number;
}

export interface OrderSummary {
  id: number;
  status: string;
  createdAt: string;
  items: OrderSummaryItem[];
  total: number;
}
