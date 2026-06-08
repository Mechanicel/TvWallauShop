import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import orderService from '@/services/orderService';
import type { Order } from '@tvwallaushop/contracts';
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

export const OrderDetailPage: React.FC = () => {
   const { id } = useParams<{ id: string }>();
   const navigate = useNavigate();

   const [order, setOrder] = useState<Order | null>(null);
   const [loading, setLoading] = useState(false);
   const [cancelOpen, setCancelOpen] = useState(false);
   const [cancelling, setCancelling] = useState(false);

   const orderId = Number(id);

   const loadOrder = async () => {
      if (!orderId || Number.isNaN(orderId)) return;
      setLoading(true);
      try {
         const data = await orderService.getOrderById(orderId);
         setOrder(data);
      } catch (err) {
         console.error('Fehler beim Laden der Bestellung:', err);
         toast.error('Fehler', { description: 'Bestellung konnte nicht geladen werden.' });
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => {
      loadOrder();
   }, [orderId]);

   const canCancel = order?.status === 'Bestellt';

   const confirmCancel = async () => {
      if (!order) return;
      setCancelling(true);
      try {
         const updated = await orderService.cancelMyOrder(order.id);
         setOrder((prev) => (prev ? { ...prev, status: updated.status } : prev));
         toast.success('Storniert', { description: `Bestellung #${order.id} wurde storniert.` });
      } catch (err: any) {
         const status = err?.response?.status;
         const msg =
            status === 409
               ? 'Diese Bestellung kann nicht mehr storniert werden (z.B. bereits bezahlt).'
               : 'Stornierung fehlgeschlagen.';
         console.error('cancelThisOrder failed:', err);
         toast.error('Fehler', { description: msg });
         loadOrder();
      } finally {
         setCancelling(false);
         setCancelOpen(false);
      }
   };

   if (!order && loading) {
      return <p className="tw-scope py-12 text-center text-muted-foreground">Lade Bestellung…</p>;
   }

   if (!order) {
      return (
         <div className="tw-scope mx-auto max-w-3xl px-4 py-8">
            <div className="flex flex-col items-start gap-4 rounded-lg border border-solid border-border bg-surface p-6">
               <p className="text-muted-foreground">Keine Bestellung gefunden.</p>
               <Button variant="outline" onClick={() => navigate('/user/orders')}>
                  <ArrowLeft className="h-4 w-4" />
                  Zurück
               </Button>
            </div>
         </div>
      );
   }

   return (
      <div className="tw-scope mx-auto max-w-3xl px-4 py-8">
         <div className="rounded-lg border border-solid border-border bg-surface p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
               <h1 className="text-2xl font-semibold text-foreground">Bestellung #{order.id}</h1>
               <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={loadOrder} disabled={loading}>
                     <RefreshCw className="h-4 w-4" />
                     Aktualisieren
                  </Button>
                  {canCancel && (
                     <Button
                        variant="outline"
                        className="border-red-200 text-destructive"
                        onClick={() => setCancelOpen(true)}
                        disabled={loading}
                     >
                        <X className="h-4 w-4" />
                        Stornieren
                     </Button>
                  )}
                  <Button variant="outline" onClick={() => navigate('/user/orders')} disabled={loading}>
                     <ArrowLeft className="h-4 w-4" />
                     Zurück
                  </Button>
               </div>
            </div>

            <div className="mb-6 flex flex-wrap gap-6 rounded-lg border border-solid border-border p-4">
               <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
                  <Badge variant={orderStatusVariant(order.status)}>{order.status}</Badge>
               </div>
               <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Datum</span>
                  <span className="text-foreground">{formatDate(order.createdAt)}</span>
               </div>
               <div className="ml-auto flex flex-col gap-1 text-right">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Gesamt</span>
                  <span className="text-lg font-semibold text-foreground">{formatPrice(Number(order.total))}</span>
               </div>
            </div>

            <Table>
               <TableHeader>
                  <TableRow className="hover:bg-transparent">
                     <TableHead>Produkt</TableHead>
                     <TableHead>Größe</TableHead>
                     <TableHead>Menge</TableHead>
                     <TableHead className="text-right">Preis</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {order.items.map((row: any, i: number) => (
                     <TableRow key={i}>
                        <TableCell className="font-medium text-foreground">{row.productName}</TableCell>
                        <TableCell>{row.sizeLabel ?? '–'}</TableCell>
                        <TableCell>{row.quantity}</TableCell>
                        <TableCell className="text-right">{formatPrice(Number(row.price))}</TableCell>
                     </TableRow>
                  ))}
               </TableBody>
            </Table>
         </div>

         <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
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
