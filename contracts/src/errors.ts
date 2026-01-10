export interface InsufficientStockResponseDetails {
  productId: number;
  sizeId: number | null;
  available: number;
  requested: number;
}

export interface InsufficientStockResponse {
  code: 'INSUFFICIENT_STOCK';
  message?: string;
  details?: InsufficientStockResponseDetails | InsufficientStockResponseDetails[];
}
