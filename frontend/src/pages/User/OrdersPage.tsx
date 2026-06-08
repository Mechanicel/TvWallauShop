import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import orderService from '@/services/orderService';
import type { OrderSummary } from '@tvwallaushop/contracts';
import { formatPrice, formatDate } from '@/utils/format';
import { orderStatusVariant } from '@/utils/orderStatus';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const OrdersPage: React.FC = () => {
   const [orders, setOrders] = useState<OrderSummary[]>([]);
   const [loading, setLoading] = useState(false);
   const [cancelTarget, setCancelTarget] = useState<OrderSummary | null>(null);
   const [cancelling, setCancelling] = useState(false);
   const navigate = useNavigate();

   const loadOrders = async () => {
      setLoading(true);
      try {
         const data = await orderService.getMyOrders();
         setOrders(data);
      } catch (err) {
         console.error('Fehler beim Laden der Bestellungen:', err);
         toast.error('Fehler', { description: 'Bestellungen konnten nicht geladen werden.' });
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => {
      loadOrders();
   }, []);

   const canCancel = (row: OrderSummary) => row.status === 'Bestellt';

   const confirmCancel = async () => {
      if (!cancelTarget) return;
      const row = cancelTarget;
      setCancelling(true);
      try {
         const updated = await orderService.cancelMyOrder(row.id);
         setOrders((prev) => prev.map((o) => (o.id === row.id ? { ...o, ...updated } : o)));
         toast.success('Storniert', { description: `Bestellung #${row.id} wurde storniert.` });
      } catch (err: any) {
         const status = err?.response?.status;
         const msg =
            status === 409
               ? 'Diese Bestellung kann nicht mehr storniert werden (z.B. bereits bezahlt).'
               : 'Stornierung fehlgeschlagen.';
         console.error('cancelOrder failed:', err);
         toast.error('Fehler', { description: msg });
         loadOrders();
      } finally {
         setCancelling(false);
         setCancelTarget(null);
      }
   };

   return (
      <div className="mx-auto max-w-4xl px-4 py-8">
         <div className="rounded-lg border border-solid border-border bg-surface p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
               <h1 className="text-2xl font-semibold text-foreground">Meine Bestellungen</h1>
               <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={loadOrders} disabled={loading}>
                     <RefreshCw className="h-4 w-4" />
                     Aktualisieren
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/user/account')} disabled={loading}>
                     <ArrowLeft className="h-4 w-4" />
                     Zurück
                  </Button>
               </div>
            </div>

            {loading ? (
               <p className="py-8 text-center text-muted-foreground">Lädt…</p>
            ) : orders.length === 0 ? (
               <p className="py-8 text-center text-muted-foreground">Keine Bestellungen gefunden.</p>
            ) : (
               <Table>
                  <TableHeader>
                     <TableRow className="hover:bg-transparent">
                        <TableHead>Bestellnr.</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Gesamt</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {orders.map((row) => (
                        <TableRow key={row.id}>
                           <TableCell className="font-medium text-foreground">#{row.id}</TableCell>
                           <TableCell>
                              <Badge variant={orderStatusVariant(row.status)}>{row.status}</Badge>
                           </TableCell>
                           <TableCell>{formatDate(row.createdAt)}</TableCell>
                           <TableCell>{formatPrice(Number(row.total))}</TableCell>
                           <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                 <Button variant="ghost" size="sm" onClick={() => navigate(`/user/orders/${row.id}`)}>
                                    Ansehen
                                 </Button>
                                 {canCancel(row) && (
                                    <Button
                                       variant="ghost"
                                       size="sm"
                                       className="text-destructive"
                                       onClick={() => setCancelTarget(row)}
                                    >
                                       Stornieren
                                    </Button>
                                 )}
                              </div>
                           </TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>
            )}
         </div>

         <AlertDialog open={cancelTarget !== null} onOpenChange={(open) => !open && setCancelTarget(null)}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>Bestellung stornieren?</AlertDialogTitle>
                  <AlertDialogDescription>
                     Du kannst diese Bestellung nur stornieren, solange sie noch nicht bezahlt ist. Möchtest du wirklich
                     stornieren?
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel disabled={cancelling}>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                     className="bg-destructive text-destructive-foreground hover:opacity-90"
                     disabled={cancelling}
                     onClick={(e) => {
                        e.preventDefault();
                        confirmCancel();
                     }}
                  >
                     Ja, stornieren
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </div>
   );
};
