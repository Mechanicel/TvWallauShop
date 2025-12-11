export interface ProductRow {
    id: number;
    name: string;
    description: string | null;
    price: number | string;
    image_url: string | null;
    created_at?: Date;
}

export interface ProductSizeRow {
    id: number;
    label: string;
    stock: number;
}

export interface ProductImageRow {
    id: number;
    product_id: number;
    url: string;
    sort_order: number | null;
    is_primary: number | boolean | null;
}


export interface ProductQuery {
    q?: string;
    minPrice?: string | number;
    maxPrice?: string | number;
}
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
    imageUrl: string | null;      // Hauptbild (für Frontend)
    createdAt?: Date;
    sizes: ProductSize[];
    images: ProductImage[];
}

// KI-Job-Typen für product_ai_jobs

export type ProductAiJobStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface ProductAiJobRow {
    id: number;
    product_id: number | null;
    image_paths: string;               // JSON-String mit Bildpfaden
    price: number | string;
    status: ProductAiJobStatus;
    result_display_name: string | null;
    result_description: string | null;
    result_tags: string | null;        // JSON-String (z.B. '["Sport","Shirt"]')
    error_message: string | null;
    created_at?: Date;
    updated_at?: Date | null;
}

export interface ProductAiJobResponse {
    id: number;
    product_id: number | null;
    status: ProductAiJobStatus;
    result_display_name: string | null;
    result_description: string | null;
    result_tags: string[] | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}
