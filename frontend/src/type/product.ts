// frontend/src/type/product.ts

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
   id?: number;
   name: string;
   description: string;
   price: number;
   imageUrl: string;
   sizes: ProductSize[];
   images: ProductImage[]; // 👈 neu: alle Bilder aus product_images
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

// --- KI-Job Typen ---

export type ProductAiJobStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface ProductAiJob {
   id: number;
   product_id?: number | null;
   status: ProductAiJobStatus;
   result_display_name?: string | null;
   result_description?: string | null;
   result_tags?: string[] | null;
   error_message?: string | null;
   created_at?: string;
   updated_at?: string;
}

export interface CreateProductAiJobParams {
   price: number;
   files: File[];
}
