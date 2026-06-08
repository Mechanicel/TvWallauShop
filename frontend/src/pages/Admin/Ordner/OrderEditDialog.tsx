// frontend/src/pages/Admin/Ordner/OrderEditDialog.tsx

import React, { useEffect, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import type { Order } from '@tvwallaushop/contracts';
import { mapApiUserToUser } from '@/utils/helpers';
import { formatPrice } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
   Dialog,
   DialogContent,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from '@/components/ui/dialog';

export type OrderStatus = 'Bestellt' | 'Bezahlt' | 'Storniert';

interface OrderEditDialogProps {
   order: Order | null;
   visible: boolean;
   onHide: () => void;
   onSaveStatus: (orderId: number, status: OrderStatus) => void | Promise<void>;
   onDelete?: (orderId: number) => void | Promise<void>;
}

const orderStatusOptions: Array<{ label: string; value: OrderStatus }> = [
   { label: 'Bestellt', value: 'Bestellt' },
   { label: 'Bezahlt', value: 'Bezahlt' },
   { label: 'Storniert', value: 'Storniert' },
];

export const OrderEditDialog: React.FC<OrderEditDialogProps> = ({ order, visible, onHide, onSaveStatus, onDelete }) => {
   const [editStatus, setEditStatus] = useState<OrderStatus>('Bestellt');

   useEffect(() => {
      if (order) setEditStatus(order.status as OrderStatus);
   }, [order]);

   const user = order ? mapApiUserToUser(order.user) : null;

   const addressParts: string[] = [];
   if (user) {
      const line1 = [user.street, user.houseNumber].filter(Boolean).join(' ');
      if (line1) addressParts.push(line1);
      const line2 = [user.postalCode, user.city].filter(Boolean).join(' ');
      if (line2) addressParts.push(line2);
      if (user.country) addressParts.push(user.country);
   }
   const address = addressParts.join(', ');

   const handleSave = async () => {
      if (!order) return;
      await onSaveStatus(order.id, editStatus);
   };

   const handleDelete = async () => {
      if (!order || !onDelete) return;
      const ok = window.confirm(`Bestellung #${order.id} wirklich löschen?`);
      if (!ok) return;
      await onDelete(order.id);
      onHide();
   };

   return (
      <Dialog open={visible} onOpenChange={(open) => !open && onHide()}>
         <DialogContent className="max-w-2xl">
            <DialogHeader>
               <DialogTitle>{order ? `Bestellung #${order.id} bearbeiten` : 'Bestellung bearbeiten'}</DialogTitle>
            </DialogHeader>

            {!order || !user ? (
               <p className="text-muted-foreground">Keine Bestellung ausgewählt.</p>
            ) : (
               <>
                  <div className="grid gap-6 sm:grid-cols-2">
                     <div>
                        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                           Kundendaten
                        </h3>
                        <dl className="space-y-1 text-sm">
                           <div className="flex justify-between gap-4">
                              <dt className="text-muted-foreground">User-ID</dt>
                              <dd className="text-foreground">{user.id}</dd>
                           </div>
                           <div className="flex justify-between gap-4">
                              <dt className="text-muted-foreground">E-Mail</dt>
                              <dd className="text-foreground">{user.email}</dd>
                           </div>
                           <div className="flex justify-between gap-4">
                              <dt className="text-muted-foreground">Name</dt>
                              <dd className="text-foreground">{[user.firstName, user.lastName].filter(Boolean).join(' ')}</dd>
                           </div>
                           {user.phone && (
                              <div className="flex justify-between gap-4">
                                 <dt className="text-muted-foreground">Telefon</dt>
                                 <dd className="text-foreground">{user.phone}</dd>
                              </div>
                           )}
                           <div className="flex justify-between gap-4">
                              <dt className="text-muted-foreground">Adresse</dt>
                              <dd className="text-right text-foreground">{address || '–'}</dd>
                           </div>
                        </dl>
                     </div>

                     <div className="flex flex-col gap-2">
                        <Label>Status bearbeiten</Label>
                        <Select value={editStatus} onValueChange={(v) => setEditStatus(v as OrderStatus)}>
                           <SelectTrigger>
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                              {orderStatusOptions.map((o) => (
                                 <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  </div>

                  <div>
                     <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Positionen</h3>
                     <div className="overflow-hidden rounded-lg border border-solid border-border">
                        <Table>
                           <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                 <TableHead>Produkt</TableHead>
                                 <TableHead>Größe</TableHead>
                                 <TableHead>Anzahl</TableHead>
                                 <TableHead className="text-right">Preis</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {order.items.map((item: any, i: number) => (
                                 <TableRow key={i}>
                                    <TableCell className="text-foreground">{item.productName}</TableCell>
                                    <TableCell>{item.sizeLabel ?? '–'}</TableCell>
                                    <TableCell>{item.quantity}</TableCell>
                                    <TableCell className="text-right">{formatPrice(Number(item.price))}</TableCell>
                                 </TableRow>
                              ))}
                           </TableBody>
                        </Table>
                     </div>
                  </div>

                  <DialogFooter className="sm:justify-between">
                     <Button
                        className="bg-destructive text-destructive-foreground hover:opacity-90"
                        onClick={handleDelete}
                     >
                        <Trash2 className="h-4 w-4" />
                        Löschen
                     </Button>
                     <div className="flex gap-2">
                        <Button variant="outline" onClick={onHide}>
                           Abbrechen
                        </Button>
                        <Button onClick={handleSave}>
                           <Save className="h-4 w-4" />
                           Speichern
                        </Button>
                     </div>
                  </DialogFooter>
               </>
            )}
         </DialogContent>
      </Dialog>
   );
};

export default OrderEditDialog;
