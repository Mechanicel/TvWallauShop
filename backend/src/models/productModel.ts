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
// kleiner Helper-Typ: wir brauchen nur label + stock für die Speicherung
export type ProductSizeInput = {
    label: string;
    stock?: number | null;
};
