import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import './OrderDetailPage.css';

interface OrderItem {
    productName: string;
    sizeLabel: string;
    quantity: number;
    price: number;
}

interface OrderDetail {
    id: number;
    status: string;
    createdAt: string;
    items: OrderItem[];
    total: number;
}

export const OrderDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        api.get<OrderDetail>(`/orders/${id}`).then((res) => setOrder(res.data));
    }, [id]);

    if (!order) return <p className="order-loading">Lade Bestellung...</p>;

    const statusTemplate = () => {
        const severity =
            order.status === 'Bestellt'
                ? 'info'
                : order.status === 'Versendet'
                    ? 'success'
                    : 'warning';
        return <Tag value={order.status} severity={severity as any} />;
    };

    const priceTemplate = (row: OrderItem) => `${row.price.toFixed(2)} €`;

    return (
        <div className="order-detail-page">
            <div className="order-detail-card">
                <div className="order-detail-header">
                    <h2>Bestellung #{order.id}</h2>
                    <Button
                        icon="pi pi-arrow-left"
                        label="Zurück"
                        className="p-button-text order-back-btn"
                        onClick={() => navigate('/user/orders')}
                    />
                </div>

                <div className="order-info">
                    <p><strong>Status:</strong> {statusTemplate()}</p>
                    <p><strong>Datum:</strong> {new Date(order.createdAt).toLocaleDateString()}</p>
                </div>

                <DataTable
                    value={order.items}
                    responsiveLayout="scroll"
                    className="order-items-table"
                >
                    <Column field="productName" header="Produkt" />
                    <Column field="sizeLabel" header="Größe" />
                    <Column field="quantity" header="Menge" />
                    <Column field="price" header="Preis" body={priceTemplate} />
                </DataTable>

                <div className="order-total">
                    Gesamtsumme: <span>{order.total.toFixed(2)} €</span>
                </div>
            </div>
        </div>
    );
};
