import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import orderService from '@/services/orderService';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Toast } from 'primereact/toast';
import './OrdersPage.css';
import type { OrderSummary } from '@tvwallaushop/contracts';

export const OrdersPage: React.FC = () => {
   const [orders, setOrders] = useState<OrderSummary[]>([]);
   const [loading, setLoading] = useState(false);
   const toast = useRef<Toast>(null);
   const navigate = useNavigate();

   const loadOrders = async () => {
      setLoading(true);
      try {
         const data = await orderService.getMyOrders();
         setOrders(data);
      } catch (err) {
         console.error('Fehler beim Laden der Bestellungen:', err);
         toast.current?.show({
            severity: 'error',
            summary: 'Fehler',
            detail: 'Bestellungen konnten nicht geladen werden.',
            life: 3500,
         });
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => {
      loadOrders();
   }, []);

   const statusTemplate = (row: OrderSummary) => {
      const status = row.status;
      const severity =
         status === 'Bestellt'
            ? 'info'
            : status === 'Bezahlt'
              ? 'success'
              : status === 'Versendet'
                ? 'success'
                : status === 'Storniert'
                  ? 'danger'
                  : 'warning';

      return <Tag value={status} severity={severity as any} />;
   };

   const dateTemplate = (row: OrderSummary) => new Date(row.createdAt).toLocaleDateString();
   const totalTemplate = (row: OrderSummary) => `${Number(row.total).toFixed(2)} €`;

   const canCancel = (row: OrderSummary) => row.status === 'Bestellt';

   const cancelOrder = (row: OrderSummary) => {
      confirmDialog({
         header: 'Bestellung stornieren?',
         message:
            'Du kannst diese Bestellung nur stornieren, solange sie noch nicht bezahlt ist. Möchtest du wirklich stornieren?',
         icon: 'pi pi-exclamation-triangle',
         acceptLabel: 'Ja, stornieren',
         rejectLabel: 'Abbrechen',
         acceptClassName: 'p-button-danger',
         accept: async () => {
            try {
               const updated = await orderService.cancelMyOrder(row.id);
               setOrders((prev) => prev.map((o) => (o.id === row.id ? { ...o, ...updated } : o)));

               toast.current?.show({
                  severity: 'success',
                  summary: 'Storniert',
                  detail: `Bestellung #${row.id} wurde storniert.`,
                  life: 3000,
               });
            } catch (err: any) {
               const status = err?.response?.status;
               const msg =
                  status === 409
                     ? 'Diese Bestellung kann nicht mehr storniert werden (z.B. bereits bezahlt).'
                     : 'Stornierung fehlgeschlagen.';

               console.error('cancelOrder failed:', err);

               toast.current?.show({
                  severity: 'error',
                  summary: 'Fehler',
                  detail: msg,
                  life: 3500,
               });

               loadOrders();
            }
         },
      });
   };

   const actionsTemplate = (row: OrderSummary) => {
      const showCancel = canCancel(row);

      return (
         <div className="orders-actions">
            <button className="orders-link" onClick={() => navigate(`/user/orders/${row.id}`)}>
               Ansehen
            </button>

            <div className="orders-cancel-slot">
               {showCancel ? (
                  <Button
                     label="Stornieren"
                     icon="pi pi-times"
                     className="p-button-text p-button-danger orders-cancel-btn"
                     onClick={() => cancelOrder(row)}
                  />
               ) : (
                  <span className="orders-cancel-placeholder" aria-hidden="true" />
               )}
            </div>
         </div>
      );
   };

   return (
      <div className="orders-page">
         <Toast ref={toast} />
         <ConfirmDialog />

         <div className="orders-card">
            <div className="orders-header">
               <h2>Meine Bestellungen</h2>

               <div className="orders-header-actions">
                  <Button
                     label="Aktualisieren"
                     icon="pi pi-refresh"
                     className="p-button-outlined"
                     onClick={loadOrders}
                     disabled={loading}
                  />
                  <Button
                     label="Zurück"
                     icon="pi pi-arrow-left"
                     className="p-button-outlined"
                     onClick={() => navigate('/user/account')}
                     disabled={loading}
                  />
               </div>
            </div>

            <DataTable
               value={orders}
               paginator
               rows={5}
               responsiveLayout="scroll"
               className="orders-table"
               loading={loading}
               emptyMessage="Keine Bestellungen gefunden."
            >
               <Column field="id" header="Bestellnr." style={{ width: '120px' }} />
               <Column field="status" header="Status" body={statusTemplate} style={{ width: '160px' }} />
               <Column field="createdAt" header="Datum" body={dateTemplate} style={{ width: '160px' }} />
               <Column field="total" header="Gesamt" body={totalTemplate} style={{ width: '160px' }} />
               <Column header="Aktionen" body={actionsTemplate} style={{ width: '260px' }} />
            </DataTable>
         </div>
      </div>
   );
};
