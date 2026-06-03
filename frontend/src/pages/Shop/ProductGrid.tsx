import React from 'react';
import type { Product } from '@/type/product';
import { ProductCard } from './ProductCard';

type ProductGridProps = {
   products: Product[];
   loading: boolean;
};

export const ProductGrid: React.FC<ProductGridProps> = ({ products, loading }) => {
   if (loading) {
      return <p className="py-12 text-center text-muted-foreground">Lädt…</p>;
   }

   if (!products.length) {
      return <p className="py-12 text-center text-muted-foreground">Keine Produkte gefunden.</p>;
   }

   return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-6">
         {products.map((product) => (
            <ProductCard
               key={product.id}
               id={product.id}
               name={product.name}
               price={Number(product.price)}
               imageUrl={product.imageUrl}
            />
         ))}
      </div>
   );
};
