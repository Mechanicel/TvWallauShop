// frontend/src/pages/Shop/ProductListPage.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchProducts } from '@/store/slices/productSlice';
import useDebouncedValue from '@/utils/useDebouncedValue';
import { ProductGrid } from './ProductGrid';
import { ProductListToolbar } from './ProductListToolbar';

const PRODUCT_LIMIT = 12;

export const ProductListPage: React.FC = () => {
   const dispatch = useAppDispatch();
   const products = useAppSelector((state) => state.product.products);
   const loading = useAppSelector((state) => state.product.loading);

   const [search, setSearch] = useState('');
   const [sortKey, setSortKey] = useState<'priceAsc' | 'priceDesc' | null>(null);
   const debouncedSearch = useDebouncedValue(search.trim(), 300);

   useEffect(() => {
      dispatch(
         fetchProducts({
            q: debouncedSearch.length ? debouncedSearch : undefined,
            limit: PRODUCT_LIMIT,
         }),
      );
   }, [dispatch, debouncedSearch]);

   const sortedProducts = useMemo(() => {
      const items = [...(products || [])];
      if (!sortKey) return items;
      return items.sort((a, b) => (sortKey === 'priceAsc' ? a.price - b.price : b.price - a.price));
   }, [products, sortKey]);

   return (
      <div className="p-p-4">
         <ProductListToolbar
            search={search}
            sortKey={sortKey}
            onSearchChange={setSearch}
            onSortChange={setSortKey}
         />
         <ProductGrid products={sortedProducts} loading={loading} />
      </div>
   );
};
