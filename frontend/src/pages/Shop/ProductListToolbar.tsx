import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type SortKey = 'priceAsc' | 'priceDesc' | null;

type ProductListToolbarProps = {
   search: string;
   sortKey: SortKey;
   onSearchChange: (value: string) => void;
   onSortChange: (value: SortKey) => void;
};

const SORT_NONE = 'none';

export const ProductListToolbar: React.FC<ProductListToolbarProps> = ({
   search,
   sortKey,
   onSearchChange,
   onSortChange,
}) => (
   <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-2xl font-semibold text-foreground">Produkte</h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
         <Input
            placeholder="Suche…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="sm:w-64"
         />
         <Select
            value={sortKey ?? SORT_NONE}
            onValueChange={(value) => onSortChange(value === SORT_NONE ? null : (value as SortKey))}
         >
            <SelectTrigger className="sm:w-52">
               <SelectValue placeholder="Sortieren" />
            </SelectTrigger>
            <SelectContent>
               <SelectItem value={SORT_NONE}>Standard</SelectItem>
               <SelectItem value="priceAsc">Preis aufsteigend</SelectItem>
               <SelectItem value="priceDesc">Preis absteigend</SelectItem>
            </SelectContent>
         </Select>
      </div>
   </div>
);
