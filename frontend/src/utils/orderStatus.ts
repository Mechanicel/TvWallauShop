import type { BadgeProps } from '@/components/ui/badge';

/** Map a (German) order status to a Badge variant. */
export function orderStatusVariant(status: string): NonNullable<BadgeProps['variant']> {
   switch (status) {
      case 'Bestellt':
         return 'info';
      case 'Bezahlt':
      case 'Versendet':
         return 'success';
      case 'Storniert':
         return 'danger';
      default:
         return 'secondary';
   }
}
