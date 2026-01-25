export interface ProductSize {
  id: number;
  label: string;
  stock: number;
}

export interface ProductImage {
  id: number;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  createdAt?: string | null;
  sizes: ProductSize[];
  images: ProductImage[];
  tags?: string[];
}

export interface ProductPayload {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  sizes: { id: string | number; label: string; stock: number }[];
  tags?: string[];
}

export type ProductAiJobStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface ProductAiJob {
  id: number;
  product_id: number | null;
  price: number | null;
  image_urls: string[];
  status: ProductAiJobStatus;
  result_display_name: string | null;
  result_description: string | null;
  result_tags: string[] | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
