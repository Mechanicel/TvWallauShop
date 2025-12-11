// frontend/src/pages/Shop/ProductListPage.tsx

import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchProducts } from '@/store/slices/productSlice';
import { ProductCard } from './ProductCard';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';

export const ProductListPage: React.FC = () => {
   const dispatch = useAppDispatch();
   const products = useAppSelector((state) => state.product.products);
   const loading = useAppSelector((state) => state.product.loading);

   const [search, setSearch] = useState('');
   const [sortKey, setSortKey] = useState<'priceAsc' | 'priceDesc' | null>(null);

   useEffect(() => {
      dispatch(fetchProducts());
   }, [dispatch]);

   const filtered = (products || [])
      .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
         if (!sortKey) return 0;
         return sortKey === 'priceAsc' ? a.price - b.price : b.price - a.price;
      });

   return (
      <div className="p-p-4">
         <div className="p-d-flex p-jc-between p-ai-center p-mb-4">
            <h2>Produkte</h2>
            <div className="p-d-flex p-ai-center">
               <InputText
                  placeholder="Suche…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="p-mr-2"
               />
               <Dropdown
                  value={sortKey}
                  options={[
                     { label: 'Preis aufsteigend', value: 'priceAsc' },
                     { label: 'Preis absteigend', value: 'priceDesc' },
                  ]}
                  placeholder="Sortieren"
                  onChange={(e) => setSortKey(e.value)}
                  className="p-mr-2"
               />
            </div>
         </div>

         {loading ? (
            <p>Lädt…</p>
         ) : (
            <div className="p-d-flex p-flex-wrap">
               {filtered.map((product) => (
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
         )}
      </div>
   );
};
