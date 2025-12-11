// frontend/src/components/Admin/OrderEditDialog.tsx

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Dropdown, DropdownChangeEvent } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';

import type { OrderExtended } from '@/type/order';
import { mapApiUserToUser } from '@/utils/helpers';

export type OrderStatus = 'Bestellt' | 'Bezahlt' | 'Storniert';

interface OrderEditDialogProps {
   order: OrderExtended | null;
   visible: boolean;
   onHide: () => void;
   onSaveStatus: (orderId: number, status: OrderStatus) => void | Promise<void>;

   // Callback zum Löschen
   onDelete?: (orderId: number) => void | Promise<void>;
}

const orderStatusOptions = [
   { label: 'Bestellt', value: 'Bestellt' as OrderStatus },
   { label: 'Bezahlt', value: 'Bezahlt' as OrderStatus },
   { label: 'Storniert', value: 'Storniert' as OrderStatus },
];

export const OrderEditDialog: React.FC<OrderEditDialogProps> = ({ order, visible, onHide, onSaveStatus, onDelete }) => {
   const [editStatus, setEditStatus] = useState<OrderStatus>('Bestellt');

   useEffect(() => {
      if (order) {
         setEditStatus(order.status as OrderStatus);
      }
   }, [order]);

   if (!order) {
      return (
         <Dialog visible={visible} header="Bestellung bearbeiten" onHide={onHide}>
            <p>Keine Bestellung ausgewählt.</p>
         </Dialog>
      );
   }

   const user = mapApiUserToUser(order.user);

   // Adresse wie in ManageOrders bauen
   const addressParts: string[] = [];
   const line1 = [user.street, user.house_number].filter(Boolean).join(' ');
   if (line1) addressParts.push(line1);
   const line2 = [user.postal_code, user.city].filter(Boolean).join(' ');
   if (line2) addressParts.push(line2);
   if (user.country) addressParts.push(user.country);
   const address = addressParts.join(', ');

   const handleSave = async () => {
      await onSaveStatus(order.id, editStatus);
   };

   const handleDelete = async () => {
      if (!onDelete) return;

      const ok = window.confirm(`Bestellung #${order.id} wirklich löschen?`);
      if (!ok) return;

      await onDelete(order.id);
      onHide();
   };

   return (
      <Dialog
         visible={visible}
         header={`Bestellung #${order.id} bearbeiten`}
         style={{ width: '40rem' }}
         modal
         onHide={onHide}
      >
         <div className="order-edit-dialog">
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
                        <span>Adresse</span>
                        <span>{address || '–'}</span>
                     </li>
                  </ul>
               </div>

               <div>
                  <h5>Status bearbeiten</h5>
                  <div className="orders-field">
                     <Dropdown
                        value={editStatus}
                        options={orderStatusOptions}
                        onChange={(e: DropdownChangeEvent) => setEditStatus(e.value as OrderStatus)}
                        className="orders-dropdown"
                     />
                  </div>
               </div>
            </div>

            <h5 className="mt-3">Positionen</h5>
            <DataTable value={order.items} responsiveLayout="scroll">
               <Column field="productName" header="Produkt" />
               <Column field="sizeLabel" header="Größe" />
               <Column field="quantity" header="Anzahl" />
               <Column field="price" header="Preis" body={(item: any) => `${Number(item.price).toFixed(2)} €`} />
            </DataTable>

            {/* Footer mit Löschen / Abbrechen / Speichern */}
            <div className="dialog-footer mt-3" style={{ display: 'flex', justifyContent: 'space-between' }}>
               <Button label="Löschen" icon="pi pi-trash" className="p-button-danger" onClick={handleDelete} />
               <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button label="Abbrechen" className="p-button-text" onClick={onHide} />
                  <Button label="Speichern" icon="pi pi-save" onClick={handleSave} />
               </div>
            </div>
         </div>
      </Dialog>
   );
};

export default OrderEditDialog;
