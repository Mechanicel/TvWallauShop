import React from 'react';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';

type SortKey = 'priceAsc' | 'priceDesc' | null;

type ProductListToolbarProps = {
   search: string;
   sortKey: SortKey;
   onSearchChange: (value: string) => void;
   onSortChange: (value: SortKey) => void;
};

export const ProductListToolbar: React.FC<ProductListToolbarProps> = ({
   search,
   sortKey,
   onSearchChange,
   onSortChange,
}) => (
   <div className="p-d-flex p-jc-between p-ai-center p-mb-4">
      <h2>Produkte</h2>
      <div className="p-d-flex p-ai-center">
         <InputText
            placeholder="Suche…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="p-mr-2"
         />
         <Dropdown
            value={sortKey}
            options={[
               { label: 'Preis aufsteigend', value: 'priceAsc' },
               { label: 'Preis absteigend', value: 'priceDesc' },
            ]}
            placeholder="Sortieren"
            onChange={(e) => onSortChange(e.value)}
            className="p-mr-2"
         />
      </div>
   </div>
);
