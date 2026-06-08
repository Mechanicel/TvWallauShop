import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, CreditCard } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store';
import { removeFromCart, updateQuantity } from '@/store/slices/cartSlice';
import { resolveImageUrl } from '@/utils/imageUrl';
import { formatPrice } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type CartItem = {
   productId: number;
   sizeId: number | null;
   sizeLabel?: string | null;
   name: string;
   price: number | string;
   quantity: number;
   imageUrl?: string | null;
};

export const CartPage: React.FC = () => {
   const dispatch = useAppDispatch();
   const navigate = useNavigate();
   const cartItems = useAppSelector((state) => state.cart.items) as CartItem[];

   const handleQuantityChange = (item: CartItem, value: number) => {
      dispatch(updateQuantity({ productId: item.productId, sizeId: item.sizeId ?? null, quantity: value }));
   };

   const handleRemove = (item: CartItem) => {
      dispatch(removeFromCart({ productId: item.productId, sizeId: item.sizeId ?? null }));
   };

   const totalPrice = cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

   return (
      <div className="mx-auto max-w-5xl px-4 py-8">
         <h1 className="mb-6 text-2xl font-semibold text-foreground">Warenkorb</h1>

         {cartItems.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-solid border-border bg-surface">
               <Table>
                  <TableHeader>
                     <TableRow className="hover:bg-transparent">
                        <TableHead>Bild</TableHead>
                        <TableHead>Produkt</TableHead>
                        <TableHead>Größe</TableHead>
                        <TableHead>Preis</TableHead>
                        <TableHead>Menge</TableHead>
                        <TableHead className="text-right">Entfernen</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {cartItems.map((item) => (
                        <TableRow key={`${item.productId}-${item.sizeId}`}>
                           <TableCell>
                              {item.imageUrl ? (
                                 <img
                                    src={resolveImageUrl(item.imageUrl)}
                                    alt={item.name}
                                    className="h-14 w-14 rounded-md object-cover"
                                 />
                              ) : (
                                 <span className="text-xs text-muted-foreground">kein Bild</span>
                              )}
                           </TableCell>
                           <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                           <TableCell>{item.sizeLabel ? item.sizeLabel : '–'}</TableCell>
                           <TableCell>{formatPrice(Number(item.price))}</TableCell>
                           <TableCell>
                              <div className="inline-flex items-center rounded-md border border-solid border-input">
                                 <button
                                    type="button"
                                    aria-label="Menge verringern"
                                    onClick={() => handleQuantityChange(item, Math.max(1, item.quantity - 1))}
                                    disabled={item.quantity <= 1}
                                    className="flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                                 >
                                    <Minus className="h-4 w-4" />
                                 </button>
                                 <span className="w-10 text-center text-sm tabular-nums">{item.quantity}</span>
                                 <button
                                    type="button"
                                    aria-label="Menge erhöhen"
                                    onClick={() => handleQuantityChange(item, item.quantity + 1)}
                                    className="flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:bg-muted"
                                 >
                                    <Plus className="h-4 w-4" />
                                 </button>
                              </div>
                           </TableCell>
                           <TableCell className="text-right">
                              <Button
                                 variant="ghost"
                                 size="icon"
                                 aria-label="Artikel entfernen"
                                 className="text-destructive hover:bg-muted"
                                 onClick={() => handleRemove(item)}
                              >
                                 <Trash2 className="h-4 w-4" />
                              </Button>
                           </TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>

               <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-lg font-semibold text-foreground">Gesamt: {formatPrice(totalPrice)}</span>
                  <Button onClick={() => navigate('/cart/checkout')} disabled={cartItems.length === 0}>
                     <CreditCard className="h-4 w-4" />
                     Zur Kasse
                  </Button>
               </div>
            </div>
         ) : (
            <p className="text-muted-foreground">Ihr Warenkorb ist leer.</p>
         )}
      </div>
   );
};
