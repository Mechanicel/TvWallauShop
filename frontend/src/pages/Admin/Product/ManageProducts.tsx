// frontend/src/pages/Admin/ManageProducts.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import type { DataTable as DataTableType } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { FilterMatchMode } from 'primereact/api';

import { useAppDispatch, useAppSelector } from '@/store';
import {
   fetchProducts,
   addProduct,
   updateProduct,
   deleteProduct,
   uploadProductImages,
   createProductAiJob,
   selectProducts,
   selectProductLoading,
   selectProductError,
   selectProductAiJobLoading,
   selectProductAiJobError,
   resetAiJobState,
} from '@/store/slices/productSlice';

import type { Product, ProductAiJob, ProductAiJobStatus } from '@/type/product';
import { resolveImageUrl } from '@/utils/imageUrl';
import ProductDialog, { EditableProduct } from './ProductDialog';
import NewProductAiDialog from './ProductAiDialog';
import { getSocket } from '@/services/socket';
import productService from '@/services/productService';

import './ManageProducts.css';

// Lokaler Typ für die KI-Queue
type QueuedAiItem = {
   job: ProductAiJob;
   price: number;
   files: File[];
};

// Kleine Ladeanimation (3 Punkte) – nutzt deine vorhandenen CSS Klassen
const SpinnerDots: React.FC = () => (
   <span className="products-ai-spinner" aria-hidden="true">
      <span className="dot" />
      <span className="dot dot2" />
      <span className="dot dot3" />
   </span>
);

export const ManageProducts: React.FC = () => {
   const dispatch = useAppDispatch();
   const products = useAppSelector(selectProducts);
   const loading = useAppSelector(selectProductLoading);
   const error = useAppSelector(selectProductError);

   const aiJobLoading = useAppSelector(selectProductAiJobLoading);
   const aiJobError = useAppSelector(selectProductAiJobError);

   const dt = useRef<DataTableType<any> | null>(null);

   const [displayEditDialog, setDisplayEditDialog] = useState(false);
   const [editingProduct, setEditingProduct] = useState<EditableProduct | null>(null);
   const [displayNewAiDialog, setDisplayNewAiDialog] = useState(false);
   const [uploadFiles, setUploadFiles] = useState<File[]>([]);
   const [globalFilter, setGlobalFilter] = useState<string>('');

   const [queuedAiItems, setQueuedAiItems] = useState<QueuedAiItem[]>([]);
   const [completingJobId, setCompletingJobId] = useState<number | null>(null);

   // ✅ UI-Verbesserung: pro Job eigenes Retry-Loading
   const [retryLoadingByJobId, setRetryLoadingByJobId] = useState<Record<number, boolean>>({});

   const setRetryLoading = (jobId: number, value: boolean) => {
      setRetryLoadingByJobId((prev) => {
         if (prev[jobId] === value) return prev;
         return { ...prev, [jobId]: value };
      });
   };

   const isRetrying = (jobId: number) => !!retryLoadingByJobId[jobId];

   const mergeOpenAiJobs = (jobs: ProductAiJob[]) => {
      setQueuedAiItems((prev) => {
         const prevById = new Map(prev.map((q) => [q.job.id, q]));
         const merged: QueuedAiItem[] = [];

         // Backend-Quelle ist "Truth" für job.* Felder, lokale price/files bleiben erhalten.
         for (const job of jobs) {
            const existing = prevById.get(job.id);
            if (existing) {
               merged.push({ ...existing, job: { ...existing.job, ...job } });
               prevById.delete(job.id);
            } else {
               merged.push({ job, price: 0, files: [] });
            }
         }

         // Jobs, die lokal existieren aber (kurzzeitig) nicht im Backend-Response sind, behalten wir.
         for (const leftover of prevById.values()) merged.push(leftover);

         return merged;
      });
   };

   const refreshOpenAiJobs = async () => {
      const jobs = await productService.getOpenProductAiJobs();
      mergeOpenAiJobs(jobs);
   };

   /* =======================
      Daten laden
   ======================= */

   useEffect(() => {
      dispatch(fetchProducts());
   }, [dispatch]);

   // 🔁 Offene KI-Jobs beim Laden wiederherstellen (Queue-Restore nach Reload)
   useEffect(() => {
      void refreshOpenAiJobs().catch((err) => {
         console.error('[AI] Failed to load open AI jobs', err);
      });
   }, []);

   /* =======================
      WebSocket Updates
   ======================= */

   useEffect(() => {
      const socket = getSocket();

      const applyJobUpdate = (job: ProductAiJob) => {
         setQueuedAiItems((prev) => {
            const idx = prev.findIndex((item) => item.job.id === job.id);
            if (idx === -1) {
               return [...prev, { job, price: 0, files: [] }];
            }
            const next = [...prev];
            next[idx] = { ...next[idx], job: { ...next[idx].job, ...job } };
            return next;
         });

         // Retry-Loading beenden sobald irgendein Update kommt
         setRetryLoading(job.id, false);
      };

      const handleAiJobUpdated = (job: ProductAiJob) => {
         console.log('[WebSocket] aiJob:updated empfangen:', job);
         applyJobUpdate(job);
      };

      const handleAiJobCompleted = (job: ProductAiJob) => {
         console.log('[WebSocket] aiJob:completed empfangen:', job);
         applyJobUpdate(job);
      };

      socket.on('aiJob:updated', handleAiJobUpdated);
      socket.on('aiJob:completed', handleAiJobCompleted);

      return () => {
         socket.off('aiJob:updated', handleAiJobUpdated);
         socket.off('aiJob:completed', handleAiJobCompleted);
      };
   }, []);

   /* =======================
      KI Flow
   ======================= */

   const openNew = () => {
      dispatch(resetAiJobState());
      setUploadFiles([]);
      setEditingProduct(null);
      setDisplayNewAiDialog(true);
   };

   const handleAiNewContinue = async ({ price, files }: { price: number; files: File[] }) => {
      const action = await dispatch(createProductAiJob({ price, files }));

      if (createProductAiJob.fulfilled.match(action)) {
         const createdJob = action.payload;

         // ✅ Upsert, damit kein Duplicate entsteht, falls ein Socket-Update bereits vorher ankam
         setQueuedAiItems((prev) => {
            const idx = prev.findIndex((q) => q.job.id === createdJob.id);
            if (idx === -1) return [...prev, { job: createdJob, price, files }];

            const next = [...prev];
            next[idx] = {
               ...next[idx],
               job: { ...next[idx].job, ...createdJob },
               price,
               files,
            };
            return next;
         });
      }

      setDisplayNewAiDialog(false);
   };

   const handleCompleteFromAi = (item: QueuedAiItem) => {
      setCompletingJobId(item.job.id);

      setEditingProduct({
         name: item.job.result_display_name ?? '',
         description: item.job.result_description ?? '',
         price: item.price,
         imageUrl: '',
         sizes: [],
         images: [],
         tags: item.job.result_tags ?? [],
      });

      setUploadFiles(item.files);
      setDisplayEditDialog(true);
   };

   const handleRetryAiJob = async (item: QueuedAiItem) => {
      const jobId = item.job.id;
      if (isRetrying(jobId)) return;

      setRetryLoading(jobId, true);

      // Optimistisch: sofort Feedback im UI (ohne Reload)
      setQueuedAiItems((prev) =>
         prev.map((q) =>
            q.job.id === jobId
               ? { ...q, job: { ...q.job, status: 'PROCESSING' as ProductAiJobStatus, error_message: null } }
               : q,
         ),
      );

      try {
         const updatedJob = await productService.retryProductAiJob(jobId);

         setQueuedAiItems((prev) =>
            prev.map((q) => (q.job.id === jobId ? { ...q, job: { ...q.job, ...updatedJob } } : q)),
         );

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

   // ❌ Job verwerfen → Backend + Files löschen
   const handleRemoveAiItem = async (jobId: number) => {
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

   const hideEditDialog = () => {
      setDisplayEditDialog(false);
      setEditingProduct(null);
      setUploadFiles([]);
      setCompletingJobId(null);
   };

   const saveProduct = async () => {
      if (!editingProduct) return;

      const { id, name, description, price, imageUrl, sizes, tags } = editingProduct;
      let productId: number | undefined;

      if (id != null) {
         const action = await dispatch(
            updateProduct({ id, changes: { name, description, price, imageUrl, sizes, tags } }),
         );
         productId = (action as any).payload?.id;
      } else {
         const action = await dispatch(addProduct({ name, description, price, imageUrl, sizes, tags }));
         productId = (action as any).payload?.id;
      }

      if (productId && uploadFiles.length > 0) {
         await dispatch(uploadProductImages({ id: productId, files: uploadFiles }));
      }

      // 🔥 KI-Job nach erfolgreicher Fertigstellung löschen
      if (completingJobId !== null) {
         try {
            await productService.deleteProductAiJob(completingJobId);
         } catch (err) {
            console.warn('[AI] Cleanup after product creation failed', err);
         }

         setQueuedAiItems((prev) => prev.filter((q) => q.job.id !== completingJobId));
         setCompletingJobId(null);
      }

      hideEditDialog();
   };

   /* =======================
      UI
   ======================= */

   const filters = useMemo(
      () => ({
         global: { value: null, matchMode: FilterMatchMode.CONTAINS },
      }),
      [],
   );

   const header = (
      <div className="products-toolbar">
         <InputText placeholder="🔍 Suche…" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} />
         <Button icon="pi pi-plus" label="Neues Produkt" onClick={openNew} />
      </div>
   );

   const renderAiBadge = (status: ProductAiJobStatus, retrying: boolean) => {
      if (retrying) {
         return (
            <span className="products-ai-badge products-ai-badge--retry">
               retry…
               <SpinnerDots />
            </span>
         );
      }

      if (status === 'PENDING') {
         return (
            <span className="products-ai-badge products-ai-badge--pending">
               wartet…
               <SpinnerDots />
            </span>
         );
      }

      if (status === 'PROCESSING') {
         return (
            <span className="products-ai-badge products-ai-badge--processing">
               läuft…
               <SpinnerDots />
            </span>
         );
      }

      if (status === 'SUCCESS') {
         return <span className="products-ai-badge products-ai-badge--success">bereit</span>;
      }

      if (status === 'FAILED') {
         return <span className="products-ai-badge products-ai-badge--failed">fehler</span>;
      }

      return null;
   };

   const renderAiQueue = () =>
      queuedAiItems.length === 0 ? null : (
         <div className="products-ai-queue">
            <h3>Offene KI-Produkte</h3>

            {queuedAiItems.map((item) => {
               const { job, price } = item;
               const success = job.status === 'SUCCESS';
               const failed = job.status === 'FAILED';

               const retrying = isRetrying(job.id);

               return (
                  <div key={job.id} className={`products-ai-item products-ai-item--${job.status.toLowerCase()}`}>
                     <div className="products-ai-item-main">
                        <div className="products-ai-item-header">
                           <strong>Job #{job.id}</strong>
                           <span className="products-ai-status-inline">– {job.status}</span>
                           {renderAiBadge(job.status as ProductAiJobStatus, retrying)}
                        </div>

                        {job.result_display_name && <div>{job.result_display_name}</div>}
                        <div>Preis: {price.toFixed(2)} €</div>
                        {job.error_message && <div className="products-ai-item-error">{job.error_message}</div>}
                     </div>

                     <div className="products-ai-item-actions">
                        <Button
                           label="Fertigstellen"
                           icon="pi pi-check"
                           disabled={!success || retrying}
                           onClick={() => handleCompleteFromAi(item)}
                        />

                        {failed && (
                           <Button
                              label={retrying ? 'Retry läuft…' : 'Erneut versuchen'}
                              icon={retrying ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'}
                              disabled={retrying}
                              onClick={() => handleRetryAiJob(item)}
                           />
                        )}

                        <Button icon="pi pi-times" disabled={retrying} onClick={() => handleRemoveAiItem(job.id)} />
                     </div>
                  </div>
               );
            })}
         </div>
      );

   return (
      <div className="products-page">
         <h2>Produkte verwalten</h2>

         {renderAiQueue()}

         {error && <p className="products-error">{error}</p>}

         <DataTable
            ref={dt}
            value={products}
            paginator
            rows={10}
            loading={loading}
            header={header}
            filters={filters}
            dataKey="id"
         >
            <Column field="id" header="ID" />
            <Column field="name" header="Name" />
            <Column field="price" header="Preis" body={(p: Product) => `${p.price.toFixed(2)} €`} />
            <Column
               field="imageUrl"
               header="Bild"
               body={(p: Product) =>
                  p.imageUrl ? <img src={resolveImageUrl(p.imageUrl)} width={50} alt={'Fehler'} /> : '–'
               }
            />
            <Column
               header="Aktionen"
               body={(p: Product) => (
                  <>
                     <Button
                        icon="pi pi-pencil"
                        onClick={() => {
                           setEditingProduct({ ...(p as EditableProduct) });
                           setDisplayEditDialog(true);
                        }}
                     />
                     <Button
                        icon="pi pi-trash"
                        className="p-button-danger"
                        onClick={() => p.id != null && dispatch(deleteProduct(p.id))}
                     />
                  </>
               )}
            />
         </DataTable>

         <NewProductAiDialog
            visible={displayNewAiDialog}
            onHide={() => {
               dispatch(resetAiJobState());
               setDisplayNewAiDialog(false);
            }}
            onContinue={handleAiNewContinue}
            loading={aiJobLoading}
            error={aiJobError}
         />

         <ProductDialog
            visible={displayEditDialog}
            product={editingProduct}
            uploadFiles={uploadFiles}
            onProductChange={setEditingProduct}
            onUploadFilesChange={setUploadFiles}
            onHide={hideEditDialog}
            onSave={saveProduct}
         />
      </div>
   );
};

export default ManageProducts;
