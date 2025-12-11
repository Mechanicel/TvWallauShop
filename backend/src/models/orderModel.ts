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
export interface Order {
    id: number;
    status: string;
    createdAt: Date;
    user: {
        id: number;
        email: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        role: 'customer' | 'admin';
        createdAt: Date;
    };
    items: OrderItem[];
    total: number;
}

export interface OrderItem {
    id: string; // synthetische ID: orderId-productId-sizeId
    orderId: number;
    productId: number;
    productName: string;
    sizeId: number;
    sizeLabel: string;
    quantity: number;
    price: number;
}