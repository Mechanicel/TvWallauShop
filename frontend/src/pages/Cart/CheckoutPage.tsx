// frontend/src/pages/Cart/CheckoutPage.tsx

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store';
import { useNavigate } from 'react-router-dom';
import { clearCart } from '@/store/slices/cartSlice';
import { placeOrder } from '@/store/slices/orderSlice';
import type { AxiosError } from 'axios';
import { isAxiosError } from 'axios';
import type { PlaceOrderPayload } from '@/type/order';
import { resolveImageUrl } from '@/utils/imageUrl';
import { getApiErrorMessage } from '@/utils/error';
import { formatPrice } from '@/utils/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type CartItem = {
   productId: number;
   sizeId?: number | null;
   sizeLabel?: string | null;
   name: string;
   price: number;
   quantity: number;
   imageUrl?: string | null;
};

type InsufficientItemKey = {
   productId: number;
   sizeId: number | null;
};

const normalizeId = (v: unknown): number | null => {
   if (v === null || v === undefined) return null;
   const n = Number(v);
   return Number.isNaN(n) ? null : n;
};

export const CheckoutPage: React.FC = () => {
   const dispatch = useAppDispatch();
   const navigate = useNavigate();
   const cartItems = useAppSelector((state) => state.cart.items) as CartItem[];

   const [name, setName] = useState('');
   const [email, setEmail] = useState('');
   const [address, setAddress] = useState('');
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [insufficientItems, setInsufficientItems] = useState<InsufficientItemKey[]>([]);

   const totalPrice = cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

   const isItemInsufficient = (item: CartItem): boolean =>
      insufficientItems.some(
         (ins) =>
            normalizeId(ins.productId) === normalizeId(item.productId) &&
            normalizeId(ins.sizeId) === normalizeId(item.sizeId),
      );

   const buildErrorMessage = (err: unknown): string => {
      const fallback = 'Die Bestellung konnte nicht abgeschlossen werden. Bitte versuche es später erneut.';

      const anyErr = err as any;

      if (anyErr && typeof anyErr === 'object' && anyErr.code === 'INSUFFICIENT_STOCK') {
         return (
            anyErr.message ||
            'Ein Artikel ist nicht mehr in der gewünschten Menge verfügbar. Bitte prüfe deinen Warenkorb und passe die Mengen an.'
         );
      }

      if (isAxiosError(err)) {
         const axiosErr = err as AxiosError<any>;
         const status = axiosErr.response?.status;
         const data = axiosErr.response?.data as { code?: string; message?: string; error?: string } | undefined;

         if (data?.code === 'INSUFFICIENT_STOCK') {
            return (
               data.message ||
               'Ein Artikel ist nicht mehr in der gewünschten Menge verfügbar. Bitte prüfe deinen Warenkorb und passe die Mengen an.'
            );
         }

         if (axiosErr.code === 'ERR_NETWORK') {
            return 'Es konnte keine Verbindung zum Server hergestellt werden. Bitte überprüfe deine Internetverbindung.';
         }

         if (status && status >= 500) {
            return 'Auf dem Server ist ein Fehler aufgetreten. Bitte versuche es später erneut.';
         }

         if (status === 400 && (data?.message || data?.error)) {
            return String(data?.message ?? data?.error);
         }

         if (axiosErr.message) {
            return axiosErr.message;
         }

         return getApiErrorMessage(err, fallback);
      }

      if (anyErr && typeof anyErr === 'object' && typeof anyErr.message === 'string') {
         return anyErr.message;
      }

      if (err instanceof Error && err.message) {
         return err.message;
      }

      return getApiErrorMessage(err, fallback);
   };

   const handlePlaceOrder = async () => {
      if (cartItems.length === 0) {
         setError('Dein Warenkorb ist leer.');
         return;
      }

      setLoading(true);
      setError(null);
      setInsufficientItems([]);

      const payload: PlaceOrderPayload = {
         name,
         email,
         address,
         items: cartItems.map((item) => ({
            productId: item.productId,
            sizeId: item.sizeId ?? undefined,
            quantity: item.quantity,
            price: item.price,
         })),
      };

      try {
         if (import.meta.env.MODE === 'development') {
            console.log('[CheckoutPage] placeOrder payload:', payload);
         }

         await dispatch(placeOrder(payload)).unwrap();
         dispatch(clearCart());
         navigate('/order-confirmation');
      } catch (err: unknown) {
         const anyErr = err as any;

         const detailsFromError =
            anyErr?.details ?? (isAxiosError(err) ? (err as AxiosError<any>).response?.data?.details : undefined);

         if (
            (anyErr && typeof anyErr === 'object' && anyErr.code === 'INSUFFICIENT_STOCK') ||
            (isAxiosError(err) && (err as AxiosError<any>).response?.data?.code === 'INSUFFICIENT_STOCK')
         ) {
            if (detailsFromError) {
               const list = Array.isArray(detailsFromError) ? detailsFromError : [detailsFromError];

               const keys: InsufficientItemKey[] = list.map((d: any) => ({
                  productId: normalizeId(d.productId) ?? -1,
                  sizeId: normalizeId(d.sizeId),
               }));

               setInsufficientItems(keys);
            }
         }

         if (import.meta.env.MODE === 'development') {
            const axiosErr = isAxiosError(err) ? (err as AxiosError<any>) : null;
            const data = axiosErr?.response?.data as any | undefined;

            console.error('[CheckoutPage] placeOrder ERROR', {
               raw: err,
               code: anyErr?.code ?? data?.code,
               message: anyErr?.message ?? data?.message,
               details: detailsFromError,
               status: axiosErr?.response?.status,
            });
         }

         const msg = buildErrorMessage(err);
         setError(msg);
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="mx-auto max-w-3xl px-4 py-8">
         <h1 className="mb-6 text-2xl font-semibold text-foreground">Bestellübersicht</h1>

         <div className="mb-6 overflow-hidden rounded-lg border border-solid border-border bg-surface">
            {cartItems.length > 0 && (
               <ul className="divide-y divide-border">
                  {cartItems.map((item) => {
                     const insufficient = isItemInsufficient(item);
                     const imageSrc = item.imageUrl ? resolveImageUrl(item.imageUrl) : undefined;
                     const linePrice = Number(item.price) * item.quantity;

                     return (
                        <li
                           key={`${normalizeId(item.productId)}-${normalizeId(item.sizeId)}`}
                           className={cn(
                              'flex items-center gap-4 p-4',
                              insufficient && 'bg-red-50',
                           )}
                        >
                           <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                              {imageSrc && <img src={imageSrc} alt={item.name} className="h-full w-full object-cover" />}
                           </div>
                           <div className="flex flex-1 flex-col">
                              <span className="font-medium text-foreground">{item.name}</span>
                              <span className="text-sm text-muted-foreground">
                                 {item.sizeLabel && <>Größe: {item.sizeLabel} · </>}
                                 Menge: {item.quantity}
                              </span>
                              {insufficient && (
                                 <span className="mt-1 text-sm text-destructive">
                                    Nicht genug Bestand – bitte Menge anpassen.
                                 </span>
                              )}
                           </div>
                           <div className="flex flex-col items-end">
                              <span className="font-semibold text-foreground">{formatPrice(linePrice)}</span>
                              <span className="text-xs text-muted-foreground">
                                 {formatPrice(Number(item.price))} / Stk.
                              </span>
                           </div>
                        </li>
                     );
                  })}
               </ul>
            )}
            <div className="flex items-center justify-between border-t border-border p-4 text-lg font-semibold text-foreground">
               <span>Summe</span>
               <span>{formatPrice(totalPrice)}</span>
            </div>
         </div>

         <Card>
            <CardHeader>
               <CardTitle>Abholer-Informationen</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                     <Label htmlFor="name">Name</Label>
                     <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-2">
                     <Label htmlFor="email">E-Mail</Label>
                     <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-2">
                     <Label htmlFor="address">Adresse</Label>
                     <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required />
                  </div>

                  {error && <p className="whitespace-pre-line text-sm text-destructive">{error}</p>}

                  <Button onClick={handlePlaceOrder} disabled={loading} className="mt-2 w-full sm:w-auto">
                     <Check className="h-4 w-4" />
                     {loading ? 'Wird gesendet …' : 'Bestellung abschicken'}
                  </Button>
               </div>
            </CardContent>
         </Card>
      </div>
   );
};
