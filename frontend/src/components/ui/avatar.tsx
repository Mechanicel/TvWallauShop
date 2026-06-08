import * as React from 'react';
import { cn } from '@/lib/utils';

type AvatarProps = {
   label: string;
   className?: string;
};

/** Minimal initials avatar (no image support needed yet). */
export const Avatar: React.FC<AvatarProps> = ({ label, className }) => (
   <span
      className={cn(
         'inline-flex h-14 w-14 select-none items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground',
         className,
      )}
   >
      {label}
   </span>
);
