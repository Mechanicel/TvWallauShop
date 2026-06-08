import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
   'inline-flex items-center rounded-full border border-solid border-transparent px-2.5 py-0.5 font-sans text-xs font-medium',
   {
      variants: {
         variant: {
            default: 'bg-primary text-primary-foreground',
            secondary: 'bg-muted text-muted-foreground',
            success: 'bg-green-50 text-green-700',
            danger: 'bg-red-50 text-red-700',
            info: 'bg-blue-50 text-blue-700',
            outline: 'border-border text-foreground',
         },
      },
      defaultVariants: {
         variant: 'default',
      },
   },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
   return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
