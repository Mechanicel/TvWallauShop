// frontend/src/pages/Admin/Ordner/ManageOrders.tsx

import React, { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, FileSpreadsheet, Settings2, Trash2, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
   fetchOrders,
   updateOrderStatus,
   deleteOrder,
   selectOrders,
   selectOrderLoading,
} from '@/store/slices/orderSlice';
import type { Order } from '@tvwallaushop/contracts';
import { mapApiUserToUser } from '@/utils/helpers';
import { formatPrice, formatDate } from '@/utils/format';
import { orderStatusVariant } from '@/utils/orderStatus';
import { exportRowsToCsv } from '@/utils/csv';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import OrderEditDialog, { type OrderStatus } from './OrderEditDialog';

function calculateTotal(items: Order['items']): number {
   return items.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0);
}

const STATUS_ALL = 'all';

const fullName = (order: Order) => {
   const u = mapApiUserToUser(order.user);
   return [u.firstName, u.lastName].filter(Boolean).join(' ');
};

export const ManageOrders: React.FC = () => {
   const dispatch = useAppDispatch();
   const orders = useAppSelector(selectOrders);
   const loading = useAppSelector(selectOrderLoading);

   const [globalFilter, setGlobalFilter] = useState('');
   const [statusFilter, setStatusFilter] = useState<string>(STATUS_ALL);
   const [dateFrom, setDateFrom] = useState('');
   const [dateTo, setDateTo] = useState('');

   const [editDialogVisible, setEditDialogVisible] = useState(false);
   const [editingOrder, setEditingOrder] = useState<Order | null>(null);

   useEffect(() => {
      dispatch(fetchOrders());
   }, [dispatch]);

   const handleStatusChange = (orderId: number, status: OrderStatus) => {
      dispatch(updateOrderStatus({ orderId, status }));
   };

   const handleDelete = (id: number) => {
      dispatch(deleteOrder(id));
   };

   const openEditDialog = (order: Order) => {
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

   const filtered = useMemo(() => {
      return orders.filter((o) => {
         if (statusFilter !== STATUS_ALL && o.status !== statusFilter) return false;
         if (dateFrom && new Date(o.createdAt) < new Date(dateFrom)) return false;
         if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            if (new Date(o.createdAt) > end) return false;
         }
         return true;
      });
   }, [orders, statusFilter, dateFrom, dateTo]);

   const exportCsv = () => {
      exportRowsToCsv(
         'bestellungen.csv',
         ['Nr.', 'E-Mail', 'Name', 'Rolle', 'Status', 'Datum', 'Gesamt'],
         filtered.map((o) => {
            const u = mapApiUserToUser(o.user);
            return [o.id, u.email, fullName(o), u.role, o.status, formatDate(o.createdAt), calculateTotal(o.items).toFixed(2)];
         }),
      );
   };

   const columns: ColumnDef<Order, any>[] = [
      { id: 'id', accessorFn: (row) => row.id, header: 'Nr.', cell: ({ row }) => `#${row.original.id}` },
      { id: 'email', accessorFn: (row) => mapApiUserToUser(row.user).email, header: 'E-Mail' },
      { id: 'name', accessorFn: (row) => fullName(row), header: 'Name' },
      { id: 'role', accessorFn: (row) => mapApiUserToUser(row.user).role, header: 'Rolle' },
      {
         id: 'status',
         accessorFn: (row) => row.status,
         header: 'Status',
         cell: ({ row }) => <Badge variant={orderStatusVariant(row.original.status)}>{row.original.status}</Badge>,
      },
      {
         id: 'createdAt',
         accessorFn: (row) => row.createdAt,
         header: 'Datum',
         cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
         id: 'actions',
         header: 'Aktionen',
         enableSorting: false,
         cell: ({ row }) => {
            const order = row.original;
            return (
               <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label="Bearbeiten" onClick={() => openEditDialog(order)}>
                     <Settings2 className="h-4 w-4" />
                  </Button>
                  {order.status === 'Bestellt' && (
                     <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Als bezahlt markieren"
                        className="text-success"
                        onClick={() => handleStatusChange(order.id, 'Bezahlt')}
                     >
                        <Check className="h-4 w-4" />
                     </Button>
                  )}
                  {order.status !== 'Storniert' && (
                     <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Stornieren"
                        className="text-destructive"
                        onClick={() => handleStatusChange(order.id, 'Storniert')}
                     >
                        <X className="h-4 w-4" />
                     </Button>
                  )}
                  {order.status === 'Storniert' && (
                     <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Endgültig löschen"
                        className="text-muted-foreground"
                        onClick={() => handleDelete(order.id)}
                     >
                        <Trash2 className="h-4 w-4" />
                     </Button>
                  )}
               </div>
            );
         },
      },
   ];

   const renderSubComponent = (order: Order) => {
      const user = mapApiUserToUser(order.user);
      const addressParts: string[] = [];
      const line1 = [user.street, user.houseNumber].filter(Boolean).join(' ');
      if (line1) addressParts.push(line1);
      const line2 = [user.postalCode, user.city].filter(Boolean).join(' ');
      if (line2) addressParts.push(line2);
      if (user.country) addressParts.push(user.country);
      const address = addressParts.join(', ');

      return (
         <div className="grid gap-6 p-2 sm:grid-cols-2">
            <div>
               <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kundendaten</h4>
               <dl className="space-y-1 text-sm">
                  {[
                     ['User-ID', user.id],
                     ['E-Mail', user.email],
                     ['Name', [user.firstName, user.lastName].filter(Boolean).join(' ')],
                     ...(user.phone ? [['Telefon', user.phone]] : []),
                     ['Rolle', user.role],
                     ['Adresse', address || '–'],
                     ['Zahlung', user.preferredPayment || '–'],
                     ['Treuepunkte', user.loyaltyPoints],
                  ].map(([k, v]) => (
                     <div key={String(k)} className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="text-right text-foreground">{v as React.ReactNode}</dd>
                     </div>
                  ))}
               </dl>
            </div>
            <div>
               <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Positionen</h4>
               <div className="overflow-hidden rounded-lg border border-solid border-border bg-surface">
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
                  <div className="flex justify-end border-t border-border p-2 text-sm font-semibold text-foreground">
                     Gesamt: {formatPrice(calculateTotal(order.items))}
                  </div>
               </div>
            </div>
         </div>
      );
   };

   return (
      <div className="tw-scope mx-auto max-w-6xl px-4 py-8">
         <h1 className="mb-6 text-2xl font-semibold text-foreground">Bestellungen verwalten</h1>

         <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Input
               placeholder="Suche nach Nr., Kunde, Status…"
               value={globalFilter}
               onChange={(e) => setGlobalFilter(e.target.value)}
               className="lg:w-72"
            />
            <div className="flex flex-wrap items-center gap-2">
               <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                     <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value={STATUS_ALL}>Alle Status</SelectItem>
                     <SelectItem value="Bestellt">Bestellt</SelectItem>
                     <SelectItem value="Bezahlt">Bezahlt</SelectItem>
                     <SelectItem value="Storniert">Storniert</SelectItem>
                  </SelectContent>
               </Select>
               <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
               <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
               <Button variant="outline" onClick={exportCsv}>
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV-Export
               </Button>
            </div>
         </div>

         <DataTable
            columns={columns}
            data={filtered}
            globalFilter={globalFilter}
            loading={loading}
            getRowId={(row) => String(row.id)}
            renderSubComponent={renderSubComponent}
            emptyMessage="Keine Bestellungen gefunden."
         />

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
