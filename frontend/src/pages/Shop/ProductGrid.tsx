import React from 'react';
import type { Product } from '@/type/product';
import { ProductCard } from './ProductCard';

type ProductGridProps = {
   products: Product[];
   loading: boolean;
};

export const ProductGrid: React.FC<ProductGridProps> = ({ products, loading }) => {
   if (loading) {
      return <p>Lädt…</p>;
   }

   return (
      <div className="p-d-flex p-flex-wrap">
         {products.map((product) => (
            <ProductCard
               key={product.id}
               id={product.id}
               name={product.name}
               description={product.description}
               price={Number(product.price)}
               imageUrl={product.imageUrl}
            />
         ))}
      </div>
   );
};
