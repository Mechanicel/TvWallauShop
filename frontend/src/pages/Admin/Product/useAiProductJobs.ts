import { useCallback, useEffect, useState } from 'react';
import type { ProductAiJob, ProductAiJobStatus } from '@/type/product';
import productService from '@/services/productService';
import { getSocket } from '@/services/socket';

export type QueuedAiItem = {
   job: ProductAiJob;
   price: number;
   files: File[];
};

/** Encapsulates the admin AI-product job queue: restore, live updates, retry, discard. */
export function useAiProductJobs() {
   const [queuedAiItems, setQueuedAiItems] = useState<QueuedAiItem[]>([]);
   const [retryLoadingByJobId, setRetryLoadingByJobId] = useState<Record<number, boolean>>({});

   const setRetryLoading = (jobId: number, value: boolean) => {
      setRetryLoadingByJobId((prev) => (prev[jobId] === value ? prev : { ...prev, [jobId]: value }));
   };

   const isRetrying = (jobId: number) => !!retryLoadingByJobId[jobId];

   const mergeOpenAiJobs = useCallback((jobs: ProductAiJob[]) => {
      setQueuedAiItems((prev) => {
         const prevById = new Map(prev.map((q) => [q.job.id, q]));
         const merged: QueuedAiItem[] = [];

         for (const job of jobs) {
            const existing = prevById.get(job.id);
            if (existing) {
               merged.push({ ...existing, job: { ...existing.job, ...job } });
               prevById.delete(job.id);
            } else {
               merged.push({ job, price: Number(job.price ?? 0), files: [] });
            }
         }

         for (const leftover of prevById.values()) merged.push(leftover);
         return merged;
      });
   }, []);

   const refreshOpenAiJobs = useCallback(async () => {
      const jobs = await productService.getOpenProductAiJobs();
      mergeOpenAiJobs(jobs);
   }, [mergeOpenAiJobs]);

   // Queue-Restore nach Reload
   useEffect(() => {
      void refreshOpenAiJobs().catch((err) => console.error('[AI] Failed to load open AI jobs', err));
   }, [refreshOpenAiJobs]);

   // Live-Updates via WebSocket
   useEffect(() => {
      const socket = getSocket();

      const applyJobUpdate = (job: ProductAiJob) => {
         setQueuedAiItems((prev) => {
            const idx = prev.findIndex((item) => item.job.id === job.id);
            if (idx === -1) return [...prev, { job, price: Number(job.price ?? 0), files: [] }];
            const next = [...prev];
            next[idx] = { ...next[idx], job: { ...next[idx].job, ...job } };
            return next;
         });
         setRetryLoading(job.id, false);
      };

      socket.on('aiJob:updated', applyJobUpdate);
      socket.on('aiJob:completed', applyJobUpdate);

      return () => {
         socket.off('aiJob:updated', applyJobUpdate);
         socket.off('aiJob:completed', applyJobUpdate);
      };
   }, []);

   const addCreatedJob = (job: ProductAiJob, price: number, files: File[]) => {
      setQueuedAiItems((prev) => {
         const idx = prev.findIndex((q) => q.job.id === job.id);
         if (idx === -1) return [...prev, { job, price, files }];
         const next = [...prev];
         next[idx] = { ...next[idx], job: { ...next[idx].job, ...job }, price, files };
         return next;
      });
   };

   const retryJob = async (item: QueuedAiItem) => {
      const jobId = item.job.id;
      if (isRetrying(jobId)) return;

      setRetryLoading(jobId, true);
      setQueuedAiItems((prev) =>
         prev.map((q) =>
            q.job.id === jobId
               ? { ...q, job: { ...q.job, status: 'PROCESSING' as ProductAiJobStatus, error_message: null } }
               : q,
         ),
      );

      try {
         const updatedJob = await productService.retryProductAiJob(jobId);
         setQueuedAiItems((prev) => prev.map((q) => (q.job.id === jobId ? { ...q, job: { ...q.job, ...updatedJob } } : q)));
         await refreshOpenAiJobs();
      } catch (err) {
         console.error('[AI] retry failed', err);
         try {
            await refreshOpenAiJobs();
         } catch (e) {
            console.error('[AI] refresh after retry failed', e);
         }
      } finally {
         setRetryLoading(jobId, false);
      }
   };

   const discardJob = async (jobId: number) => {
      const ok = window.confirm('Diesen KI-Job wirklich verwerfen?\nAlle zugehörigen KI-Bilder werden gelöscht.');
      if (!ok) return;
      try {
         await productService.deleteProductAiJob(jobId);
         setQueuedAiItems((prev) => prev.filter((q) => q.job.id !== jobId));
         setRetryLoading(jobId, false);
      } catch (err) {
         console.error('[AI] delete job failed', err);
         window.alert('Job konnte nicht gelöscht werden.');
      }
   };

   const removeJobLocal = (jobId: number) => {
      setQueuedAiItems((prev) => prev.filter((q) => q.job.id !== jobId));
   };

   return {
      queuedAiItems,
      isRetrying,
      refreshOpenAiJobs,
      addCreatedJob,
      retryJob,
      discardJob,
      removeJobLocal,
   };
}
