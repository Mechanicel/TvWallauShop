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
