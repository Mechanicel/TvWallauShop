// frontend/src/pages/Shop/ProductDetailPage.tsx

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch } from '@/store';
import { addToCart } from '@/store/slices/cartSlice';
import productService from '@/services/productService';
import type { Product, ProductSize } from '@/type/product';
import { resolveImageUrl } from '@/utils/imageUrl';
import { formatPrice } from '@/utils/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const ProductDetailPage: React.FC = () => {
   const { id } = useParams<{ id: string }>();
   const dispatch = useAppDispatch();

   const [product, setProduct] = useState<Product | null>(null);
   const [selectedSizeId, setSelectedSizeId] = useState<number | null>(null);
   const [quantity, setQuantity] = useState<number>(1);
   const [loading, setLoading] = useState<boolean>(true);
   const [activeIndex, setActiveIndex] = useState(0);

   useEffect(() => {
      const fetchProduct = async () => {
         try {
            const data = await productService.getProduct(Number(id));
            setProduct(data);

            if (data.sizes.length > 0) {
               setSelectedSizeId(data.sizes[0].id);
            }

            if (data.images?.length > 0) {
               const primaryIndex = data.images.findIndex((img) => img.isPrimary);
               setActiveIndex(primaryIndex >= 0 ? primaryIndex : 0);
            } else {
               setActiveIndex(0);
            }
         } catch (err) {
            console.error('Fehler beim Laden des Produkts:', err);
         } finally {
            setLoading(false);
         }
      };
      fetchProduct();
   }, [id]);

   const handlePrev = () => {
      if (!product?.images?.length) return;
      setActiveIndex((prev) => (prev === 0 ? product.images.length - 1 : prev - 1));
   };

   const handleNext = () => {
      if (!product?.images?.length) return;
      setActiveIndex((prev) => (prev === product.images.length - 1 ? 0 : prev + 1));
   };

   const handleAddToCart = () => {
      if (!product || selectedSizeId == null) return;

      const size = product.sizes.find((s) => s.id === selectedSizeId)!;

      let imageUrl: string | undefined;
      if (product.images?.length) {
         const img = product.images[activeIndex] ?? product.images[0];
         imageUrl = img.url;
      } else if (product.imageUrl) {
         imageUrl = product.imageUrl;
      }

      dispatch(
         addToCart({
            productId: product.id,
            name: `${product.name} (${size.label})`,
            price: Number(product.price),
            quantity,
            sizeId: size.id,
            sizeLabel: size.label,
            imageUrl,
         }),
      );

      toast.success('Zum Warenkorb hinzugefügt', {
         description: `${product.name} in Größe ${size.label} (${quantity}×)`,
      });
   };

   if (loading) return <p className="py-12 text-center text-muted-foreground">Lädt…</p>;
   if (!product) return <p className="py-12 text-center text-muted-foreground">Produkt nicht gefunden.</p>;

   const images = product.images?.length ? product.images : [{ url: product.imageUrl ?? '' }];
   const mainImageSrc = resolveImageUrl(images[activeIndex].url);

   return (
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-2">
         {/* Galerie */}
         <div>
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-solid border-border bg-muted">
               <img src={mainImageSrc} alt={product.name} className="h-full w-full object-cover" />
               {images.length > 1 && (
                  <>
                     <button
                        type="button"
                        aria-label="Vorheriges Bild"
                        onClick={handlePrev}
                        className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
                     >
                        <ChevronLeft className="h-5 w-5" />
                     </button>
                     <button
                        type="button"
                        aria-label="Nächstes Bild"
                        onClick={handleNext}
                        className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
                     >
                        <ChevronRight className="h-5 w-5" />
                     </button>
                  </>
               )}
            </div>

            {images.length > 1 && (
               <div className="mt-3 flex flex-wrap gap-2">
                  {images.map((img, i) => (
                     <button
                        type="button"
                        key={img.url + i}
                        onClick={() => setActiveIndex(i)}
                        className={cn(
                           'h-16 w-16 overflow-hidden rounded-md border border-solid transition-colors',
                           i === activeIndex ? 'border-primary' : 'border-border opacity-80 hover:opacity-100',
                        )}
                     >
                        <img src={resolveImageUrl(img.url)} alt="Vorschau" className="h-full w-full object-cover" />
                     </button>
                  ))}
               </div>
            )}
         </div>

         {/* Info */}
         <div className="flex flex-col gap-5">
            <div>
               <h1 className="text-2xl font-semibold text-foreground">{product.name}</h1>
               {product.description && <p className="mt-2 text-sm text-muted-foreground">{product.description}</p>}
            </div>

            <span className="text-2xl font-semibold text-foreground">{formatPrice(Number(product.price))}</span>

            <div className="flex flex-col gap-2">
               <Label htmlFor="size">Größe wählen</Label>
               <Select
                  value={selectedSizeId != null ? String(selectedSizeId) : undefined}
                  onValueChange={(v) => setSelectedSizeId(Number(v))}
               >
                  <SelectTrigger id="size" className="max-w-xs">
                     <SelectValue placeholder="Größe auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                     {product.sizes.map((s: ProductSize) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                           {s.label}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            <div className="flex flex-col gap-2">
               <Label htmlFor="quantity">Menge</Label>
               <Select value={String(quantity)} onValueChange={(v) => setQuantity(Number(v))}>
                  <SelectTrigger id="quantity" className="max-w-[8rem]">
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                           {n}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            <Button onClick={handleAddToCart} disabled={selectedSizeId == null} className="mt-2 w-full sm:w-auto">
               <ShoppingCart className="h-4 w-4" />
               In den Warenkorb
            </Button>
         </div>
      </div>
   );
};
