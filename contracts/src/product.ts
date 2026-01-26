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

export interface ProductImageInput {
  url: string;
  sortOrder?: number;
  isPrimary?: boolean;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  primaryImageUrl?: string | null;
  createdAt?: string | null;
  sizes: ProductSize[];
  images: ProductImage[];
  tags?: string[];
}

export interface ProductPayload {
  name: string;
  description: string;
  price: number;
  images?: ProductImageInput[];
  imageUrls?: string[];
  sizes: { id: string | number; label: string; stock: number }[];
  tags?: string[];
}

export type ProductAiJobStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface ProductAiJob {
  id: number;
  productId: number | null;
  price: number | null;
  images: ProductImageInput[];
  status: ProductAiJobStatus;
  resultDisplayName: string | null;
  resultDescription: string | null;
  resultTags: string[] | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
