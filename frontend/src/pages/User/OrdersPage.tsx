import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import './OrdersPage.css';

interface OrderItem {
  productName: string;
  sizeLabel: string;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
  total: number;
}

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<Order[]>('/orders/me') // ✅ nutzt genau den Backend-Path
      .then((res) => setOrders(res.data))
      .catch((err) =>
        console.error('Fehler beim Laden der Bestellungen:', err),
      );
  }, []);

  const statusTemplate = (row: Order) => {
    const severity =
      row.status === 'Bestellt'
        ? 'info'
        : row.status === 'Versendet'
          ? 'success'
          : 'warning';
    return <Tag value={row.status} severity={severity as any} />;
  };

  const dateTemplate = (row: Order) => {
    return new Date(row.createdAt).toLocaleDateString();
  };

  const totalTemplate = (row: Order) => {
    return row.total.toFixed(2) + ' €';
  };

  return (
    <div className="orders-page">
      <div className="orders-card">
        <h2>Meine Bestellungen</h2>
        <DataTable
          value={orders}
          paginator
          rows={5}
          responsiveLayout="scroll"
          className="orders-table"
        >
          <Column field="id" header="Bestellnr." />
          <Column field="status" header="Status" body={statusTemplate} />
          <Column field="createdAt" header="Datum" body={dateTemplate} />
          <Column field="total" header="Gesamt" body={totalTemplate} />
          <Column
            header="Details"
            body={(row: Order) => (
              <button
                className="orders-link"
                onClick={() => navigate(`/user/orders/${row.id}`)}
              >
                Ansehen
              </button>
            )}
          />
        </DataTable>
      </div>
    </div>
  );
};
