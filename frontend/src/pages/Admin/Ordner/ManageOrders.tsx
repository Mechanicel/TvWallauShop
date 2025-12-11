// frontend/src/pages/Admin/ManageOrders.tsx

import React, { useEffect, useState, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputText } from 'primereact/inputtext';
import { Dropdown, DropdownChangeEvent } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Button } from 'primereact/button';
import { FilterMatchMode } from 'primereact/api';

import { useAppDispatch, useAppSelector } from '@/store';
import {
   fetchOrders,
   updateOrderStatus,
   deleteOrder,
   selectOrders,
   selectOrderLoading,
} from '@/store/slices/orderSlice';
import type { OrderExtended } from '@/type/order';

import './ManageOrders.css';
import { mapApiUserToUser } from '@/utils/helpers';
import OrderEditDialog, { OrderStatus } from './OrderEditDialog';

// 🔹 Hilfsfunktion: Gesamtpreis berechnen
function calculateTotal(items: OrderExtended['items']): number {
   return items.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0);
}

export const ManageOrders: React.FC = () => {
   const dispatch = useAppDispatch();
   const orders = useAppSelector(selectOrders);
   const loading = useAppSelector(selectOrderLoading);

   const dt = useRef<DataTable<any>>(null);

   const [globalFilter, setGlobalFilter] = useState<string>('');
   const [statusFilter, setStatusFilter] = useState<string | null>(null);
   const [dateRange, setDateRange] = useState<Date[] | null>(null);
   const [expandedRows, setExpandedRows] = useState<{ [key: number]: boolean } | undefined>(undefined);

   // Dialog-State für Order-Edit
   const [editDialogVisible, setEditDialogVisible] = useState(false);
   const [editingOrder, setEditingOrder] = useState<OrderExtended | null>(null);

   useEffect(() => {
      dispatch(fetchOrders());
   }, [dispatch]);

   const statusOptions = [
      { label: 'Alle', value: null },
      { label: 'Bestellt', value: 'Bestellt' },
      { label: 'Bezahlt', value: 'Bezahlt' },
      { label: 'Storniert', value: 'Storniert' },
   ];

   const handleStatusChange = (orderId: number, status: OrderStatus) => {
      dispatch(updateOrderStatus({ orderId, status }));
   };

   const handleDelete = (id: number) => {
      dispatch(deleteOrder(id));
   };

   const openEditDialog = (order: OrderExtended) => {
      setEditingOrder(order);
      setEditDialogVisible(true);
   };

   const handleSaveStatus = async (orderId: number, status: OrderStatus) => {
      await dispatch(updateOrderStatus({ orderId, status }));
      setEditDialogVisible(false);
   };

   const handleDeleteOrder = async (orderId: number) => {
      await dispatch(deleteOrder(orderId));
      setEditingOrder(null);
   };

   // 🔍 Toolbar – Stil analog zu Produkten & Usern
   const header = (
      <div className="orders-toolbar">
         <div className="orders-field">
            <InputText
               placeholder="🔍 Suche nach Nr., Kunde, Status…"
               value={globalFilter}
               onChange={(e) => setGlobalFilter(e.target.value)}
               className="orders-input"
            />
         </div>

         <div className="orders-field">
            <Dropdown
               placeholder="Status filtern"
               value={statusFilter}
               options={statusOptions}
               onChange={(e: DropdownChangeEvent) => setStatusFilter(e.value)}
               showClear
               className="orders-dropdown"
            />
         </div>

         <div className="orders-field">
            <Calendar
               selectionMode="range"
               placeholder="Datum von–bis"
               value={dateRange}
               onChange={(e) => setDateRange(e.value as Date[])}
               dateFormat="dd.mm.yy"
               className="orders-calendar"
            />
         </div>

         <div className="orders-actions">
            <Button
               icon="pi pi-file-excel"
               label="CSV export"
               onClick={() => dt.current?.exportCSV()}
               className="orders-button"
            />
         </div>
      </div>
   );

   // Filter-Konfiguration (global + Status + Datum)
   const filters: any = {
      global: { value: globalFilter, matchMode: FilterMatchMode.CONTAINS },
      status: { value: statusFilter, matchMode: FilterMatchMode.EQUALS },
      createdAt: { value: dateRange, matchMode: FilterMatchMode.BETWEEN },
   };

   const rowExpansionTemplate = (order: OrderExtended) => {
      const user = mapApiUserToUser(order.user);

      const addressParts: string[] = [];
      const line1 = [user.street, user.house_number].filter(Boolean).join(' ');
      if (line1) addressParts.push(line1);
      const line2 = [user.postal_code, user.city].filter(Boolean).join(' ');
      if (line2) addressParts.push(line2);
      if (user.country) addressParts.push(user.country);
      const address = addressParts.join(', ');

      return (
         <div className="order-expansion">
            <div className="order-expansion__cols">
               <div>
                  <h5>Kundendaten</h5>
                  <ul className="kv">
                     <li>
                        <span>User-ID</span>
                        <span>{user.id}</span>
                     </li>
                     <li>
                        <span>E-Mail</span>
                        <span>{user.email}</span>
                     </li>
                     <li>
                        <span>Name</span>
                        <span>{[user.first_name, user.last_name].filter(Boolean).join(' ')}</span>
                     </li>
                     {user.phone && (
                        <li>
                           <span>Telefon</span>
                           <span>{user.phone}</span>
                        </li>
                     )}
                     <li>
                        <span>Rolle</span>
                        <span>{user.role}</span>
                     </li>
                     <li>
                        <span>Adresse</span>
                        <span>{address}</span>
                     </li>
                     <li>
                        <span>Zahlung</span>
                        <span>{user.preferred_payment || '–'}</span>
                     </li>
                     <li>
                        <span>Treuepunkte</span>
                        <span>{user.loyaltyPoints}</span>
                     </li>
                  </ul>
               </div>

               <div>
                  <h5>Bestell-Infos</h5>
                  <ul className="kv">
                     <li>
                        <span>Bestell-Nr.</span>
                        <span>#{order.id}</span>
                     </li>
                     <li>
                        <span>Status</span>
                        <span className={`badge badge--${order.status.toLowerCase()}`}>{order.status}</span>
                     </li>
                     <li>
                        <span>Erstellt</span>
                        <span>{new Date(order.createdAt).toLocaleString('de-DE')}</span>
                     </li>
                     <li>
                        <span>Gesamt</span>
                        <span>{calculateTotal(order.items).toFixed(2)} €</span>
                     </li>
                  </ul>
               </div>
            </div>

            <h5>Positionen</h5>
            <DataTable value={order.items} responsiveLayout="scroll">
               <Column field="productName" header="Produkt" />
               <Column field="sizeLabel" header="Größe" style={{ width: '6rem' }} />
               <Column field="quantity" header="Anzahl" style={{ width: '6rem' }} />
               <Column field="price" header="Preis" body={(item: any) => `${Number(item.price).toFixed(2)} €`} />
            </DataTable>
         </div>
      );
   };

   return (
      <div className="orders-page">
         <h2>Bestellungen verwalten</h2>

         <DataTable
            ref={dt}
            value={orders}
            loading={loading}
            paginator
            rows={10}
            header={header}
            filters={filters}
            globalFilterFields={['id', 'user.email', 'status', 'user.firstName', 'user.lastName']}
            dataKey="id"
            expandedRows={expandedRows}
            onRowToggle={(e) => setExpandedRows(e.data)}
            rowExpansionTemplate={rowExpansionTemplate}
            responsiveLayout="scroll"
            className="orders-table"
         >
            <Column expander style={{ width: '3rem' }} />
            <Column field="id" header="Nr." sortable />
            <Column field="user.email" header="E-Mail" sortable />
            <Column
               header="Name"
               sortable
               body={(row: OrderExtended) => {
                  const user = mapApiUserToUser(row.user);
                  return [user.first_name, user.last_name].filter(Boolean).join(' ');
               }}
            />
            <Column field="user.role" header="Rolle" sortable />
            <Column
               field="status"
               header="Status"
               sortable
               body={(row: OrderExtended) => (
                  <span className={`badge badge--${row.status?.toLowerCase()}`}>{row.status}</span>
               )}
            />
            <Column
               field="createdAt"
               header="Datum"
               sortable
               body={(row: OrderExtended) => new Date(row.createdAt).toLocaleDateString('de-DE')}
            />
            <Column
               header="Aktionen"
               style={{ width: '14rem' }}
               body={(row: OrderExtended) => (
                  <div className="row-actions">
                     <Button
                        icon="pi pi-cog"
                        className="p-button-rounded p-button-text"
                        tooltip="Bestellung bearbeiten"
                        onClick={() => openEditDialog(row)}
                     />
                     {row.status === 'Bestellt' && (
                        <Button
                           icon="pi pi-check"
                           className="p-button-success p-button-rounded p-button-text"
                           tooltip="Als bezahlt markieren"
                           onClick={() => handleStatusChange(row.id, 'Bezahlt')}
                        />
                     )}
                     {row.status !== 'Storniert' && (
                        <Button
                           icon="pi pi-times"
                           className="p-button-danger p-button-rounded p-button-text"
                           tooltip="Stornieren"
                           onClick={() => handleStatusChange(row.id, 'Storniert')}
                        />
                     )}
                     {row.status === 'Storniert' && (
                        <Button
                           icon="pi pi-trash"
                           className="p-button-secondary p-button-rounded p-button-text"
                           tooltip="Endgültig löschen"
                           onClick={() => handleDelete(row.id)}
                        />
                     )}
                  </div>
               )}
            />
         </DataTable>

         <OrderEditDialog
            order={editingOrder}
            visible={editDialogVisible}
            onHide={() => setEditDialogVisible(false)}
            onSaveStatus={handleSaveStatus}
            onDelete={handleDeleteOrder}
         />
      </div>
   );
};

export default ManageOrders;
