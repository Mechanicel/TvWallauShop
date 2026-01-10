import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import orderService from '@/services/orderService';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Toast } from 'primereact/toast';
import './OrderDetailPage.css';
import type { Order } from '@tvwallaushop/contracts';

export const OrderDetailPage: React.FC = () => {
   const { id } = useParams<{ id: string }>();
   const navigate = useNavigate();
   const toast = useRef<Toast>(null);

   const [order, setOrder] = useState<Order | null>(null);
   const [loading, setLoading] = useState(false);

   const orderId = Number(id);

   const loadOrder = async () => {
      if (!orderId || Number.isNaN(orderId)) return;

      setLoading(true);
      try {
         const data = await orderService.getOrderById(orderId);
         setOrder(data);
      } catch (err) {
         console.error('Fehler beim Laden der Bestellung:', err);
         toast.current?.show({
            severity: 'error',
            summary: 'Fehler',
            detail: 'Bestellung konnte nicht geladen werden.',
            life: 3500,
         });
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => {
      loadOrder();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [orderId]);

   const canCancel = order?.status === 'Bestellt';

   const statusTag = (status: string) => {
      const severity =
         status === 'Bestellt'
            ? 'info'
            : status === 'Bezahlt' || status === 'Versendet'
              ? 'success'
              : status === 'Storniert'
                ? 'danger'
                : 'warning';

      return <Tag value={status} severity={severity as any} />;
   };

   const cancelThisOrder = () => {
      if (!order) return;

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
               const updated = await orderService.cancelMyOrder(order.id);
               setOrder((prev) => (prev ? { ...prev, ...updated } : prev));

               toast.current?.show({
                  severity: 'success',
                  summary: 'Storniert',
                  detail: `Bestellung #${order.id} wurde storniert.`,
                  life: 3000,
               });
            } catch (err: any) {
               const status = err?.response?.status;
               const msg =
                  status === 409
                     ? 'Diese Bestellung kann nicht mehr storniert werden (z.B. bereits bezahlt).'
                     : 'Stornierung fehlgeschlagen.';

               console.error('cancelThisOrder failed:', err);

               toast.current?.show({
                  severity: 'error',
                  summary: 'Fehler',
                  detail: msg,
                  life: 3500,
               });

               loadOrder();
            }
         },
      });
   };

   if (!order && loading) {
      return (
         <div className="order-detail-page">
            <div className="order-detail-card">
               <p className="order-loading">Lade Bestellung...</p>
            </div>
         </div>
      );
   }

   if (!order) {
      return (
         <div className="order-detail-page">
            <div className="order-detail-card">
               <p className="order-loading">Keine Bestellung gefunden.</p>
               <Button
                  icon="pi pi-arrow-left"
                  label="Zurück"
                  className="p-button-outlined"
                  onClick={() => navigate('/user/orders')}
               />
            </div>
         </div>
      );
   }

   const priceTemplate = (row: any) => `${Number(row.price).toFixed(2)} €`;

   return (
      <div className="order-detail-page">
         <Toast ref={toast} />
         <ConfirmDialog />

         <div className="order-detail-card">
            {/* Header wie OrdersPage: Titel links, Aktionen rechts */}
            <div className="order-detail-header">
               <h2>Bestellung #{order.id}</h2>

               <div className="order-detail-header-actions">
                  <Button
                     label="Aktualisieren"
                     icon="pi pi-refresh"
                     className="p-button-outlined"
                     onClick={loadOrder}
                     disabled={loading}
                  />

                  {canCancel && (
                     <Button
                        label="Stornieren"
                        icon="pi pi-times"
                        className="p-button-outlined p-button-danger order-cancel-btn"
                        onClick={cancelThisOrder}
                        disabled={loading}
                     />
                  )}

                  <Button
                     icon="pi pi-arrow-left"
                     label="Zurück"
                     className="p-button-outlined"
                     onClick={() => navigate('/user/orders')}
                     disabled={loading}
                  />
               </div>
            </div>

            {/* Meta-Zeile wie „Übersicht“-Look: kompakt, sauber */}
            <div className="order-detail-meta">
               <div className="order-detail-meta-item">
                  <span className="order-detail-meta-label">Status</span>
                  <span className="order-detail-meta-value">{statusTag(order.status)}</span>
               </div>

               <div className="order-detail-meta-item">
                  <span className="order-detail-meta-label">Datum</span>
                  <span className="order-detail-meta-value">{new Date(order.createdAt).toLocaleDateString()}</span>
               </div>

               <div className="order-detail-meta-item order-detail-meta-right">
                  <span className="order-detail-meta-label">Gesamt</span>
                  <span className="order-detail-meta-total">{Number(order.total).toFixed(2)} €</span>
               </div>
            </div>

            <DataTable value={order.items} responsiveLayout="scroll" className="order-items-table">
               <Column field="productName" header="Produkt" />
               <Column field="sizeLabel" header="Größe" style={{ width: '140px' }} />
               <Column field="quantity" header="Menge" style={{ width: '120px' }} />
               <Column field="price" header="Preis" body={priceTemplate} style={{ width: '140px' }} />
            </DataTable>
         </div>
      </div>
   );
};
