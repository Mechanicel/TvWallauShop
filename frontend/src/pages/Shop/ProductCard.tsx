import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { ROUTES } from '@/utils/constants';
import { resolveImageUrl } from '@/utils/imageUrl';
import { formatPrice } from '@/utils/format';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type ProductCardProps = {
   id: number;
   name: string;
   price: number;
   imageUrl: string | null;
};

export const ProductCard: React.FC<ProductCardProps> = ({ id, name, price, imageUrl }) => {
   const navigate = useNavigate();
   const goToDetail = () => navigate(ROUTES.PRODUCT_DETAIL(id));

   return (
      <Card
         onClick={goToDetail}
         className="group flex cursor-pointer flex-col overflow-hidden transition-colors hover:border-primary"
      >
         <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
            <img
               src={resolveImageUrl(imageUrl)}
               alt={name}
               loading="lazy"
               className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
         </div>
         <div className="flex flex-1 flex-col gap-3 p-4">
            <h3 className="line-clamp-2 text-base font-medium text-foreground">{name}</h3>
            <div className="mt-auto flex items-center justify-between gap-2">
               <span className="text-lg font-semibold text-foreground">{formatPrice(price)}</span>
               <Button
                  type="button"
                  size="sm"
                  onClick={(e) => {
                     e.stopPropagation();
                     goToDetail();
                  }}
               >
                  <ShoppingCart className="h-4 w-4" />
                  Auswählen
               </Button>
            </div>
         </div>
      </Card>
   );
};
