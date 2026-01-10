export interface OrderListQuery {
    userId?: string | number;
}

export interface OrderItemRow {
    order_id: number;
    product_id: number;
    product_name: string;
    size_id: number;
    size_label: string;
    quantity: number;
    price: number | string;
}

export interface ProductPriceRow {
    id: number | string;
    price: number | string;
    name: string;
}

export interface OrdersByUserRow {
    order_id: number;
    status: string;
    order_created_at: Date;
    product_name: string;
    size_label: string;
    quantity: number;
    price: number | string;
}
