import React from 'react';
import { Check, Loader2, RefreshCw, X } from 'lucide-react';
import type { ProductAiJobStatus } from '@/type/product';
import type { QueuedAiItem } from './useAiProductJobs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/utils/format';

type AiJobQueueProps = {
   items: QueuedAiItem[];
   isRetrying: (jobId: number) => boolean;
   onComplete: (item: QueuedAiItem) => void;
   onRetry: (item: QueuedAiItem) => void;
   onRemove: (jobId: number) => void;
};

const StatusBadge: React.FC<{ status: ProductAiJobStatus; retrying: boolean }> = ({ status, retrying }) => {
   if (retrying) {
      return (
         <Badge variant="info">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            retry…
         </Badge>
      );
   }
   switch (status) {
      case 'PENDING':
         return (
            <Badge variant="info">
               <Loader2 className="mr-1 h-3 w-3 animate-spin" />
               wartet…
            </Badge>
         );
      case 'PROCESSING':
         return (
            <Badge variant="info">
               <Loader2 className="mr-1 h-3 w-3 animate-spin" />
               läuft…
            </Badge>
         );
      case 'SUCCESS':
         return <Badge variant="success">bereit</Badge>;
      case 'FAILED':
         return <Badge variant="danger">fehler</Badge>;
      default:
         return null;
   }
};

export const AiJobQueue: React.FC<AiJobQueueProps> = ({ items, isRetrying, onComplete, onRetry, onRemove }) => {
   if (items.length === 0) return null;

   return (
      <div className="mb-6 rounded-lg border border-solid border-border bg-surface p-4">
         <h2 className="mb-3 text-lg font-semibold text-foreground">Offene KI-Produkte</h2>
         <div className="flex flex-col gap-3">
            {items.map((item) => {
               const { job, price } = item;
               const success = job.status === 'SUCCESS';
               const failed = job.status === 'FAILED';
               const retrying = isRetrying(job.id);

               return (
                  <div
                     key={job.id}
                     className="flex flex-col gap-3 rounded-lg border border-solid border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                     <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                           <strong className="text-foreground">Job #{job.id}</strong>
                           <StatusBadge status={job.status as ProductAiJobStatus} retrying={retrying} />
                        </div>
                        {job.result_display_name && <div className="text-sm text-foreground">{job.result_display_name}</div>}
                        <div className="text-sm text-muted-foreground">Preis: {formatPrice(price)}</div>
                        {job.error_message && <div className="text-sm text-destructive">{job.error_message}</div>}
                     </div>

                     <div className="flex flex-wrap gap-2">
                        <Button size="sm" disabled={!success || retrying} onClick={() => onComplete(item)}>
                           <Check className="h-4 w-4" />
                           Fertigstellen
                        </Button>
                        {failed && (
                           <Button size="sm" variant="outline" disabled={retrying} onClick={() => onRetry(item)}>
                              <RefreshCw className={retrying ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                              {retrying ? 'Retry läuft…' : 'Erneut versuchen'}
                           </Button>
                        )}
                        <Button
                           size="icon"
                           variant="ghost"
                           className="text-destructive"
                           disabled={retrying}
                           aria-label="Verwerfen"
                           onClick={() => onRemove(job.id)}
                        >
                           <X className="h-4 w-4" />
                        </Button>
                     </div>
                  </div>
               );
            })}
         </div>
      </div>
   );
};
