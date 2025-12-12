// frontend/src/pages/Admin/ManageProducts.tsx

import React, { useEffect, useState, useRef } from 'react';
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
   deleteProductImage,
   createProductAiJob,
   selectProducts,
   selectProductLoading,
   selectProductError,
   selectProductAiJobLoading,
   selectProductAiJobError,
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

   /* =======================
      Daten laden
   ======================= */

   useEffect(() => {
      dispatch(fetchProducts());
   }, [dispatch]);

   // 🔁 Offene KI-Jobs beim Laden wiederherstellen
   useEffect(() => {
      (async () => {
         try {
            const jobs = await productService.getOpenProductAiJobs();

            setQueuedAiItems((prev) => {
               const existingIds = new Set(prev.map((q) => q.job.id));

               const restored: QueuedAiItem[] = jobs
                  .filter((job) => !existingIds.has(job.id))
                  .map((job) => ({
                     job,
                     price: 0,
                     files: [],
                  }));

               return [...restored, ...prev];
            });
         } catch (err) {
            console.error('[AI] Failed to load open AI jobs', err);
         }
      })();
   }, []);

   /* =======================
      WebSocket Updates
   ======================= */

   useEffect(() => {
      const socket = getSocket();

      const handleAiJobCompleted = (job: ProductAiJob) => {
         console.log('[WebSocket] aiJob:completed empfangen:', job);
         setQueuedAiItems((prev) =>
            prev.map((item) => (item.job.id === job.id ? { ...item, job: { ...item.job, ...job } } : item)),
         );
      };

      socket.on('aiJob:completed', handleAiJobCompleted);

      return () => {
         socket.off('aiJob:completed', handleAiJobCompleted);
      };
   }, []);

   /* =======================
      KI Flow
   ======================= */

   const openNew = () => {
      setUploadFiles([]);
      setEditingProduct(null);
      setDisplayNewAiDialog(true);
   };

   const handleAiNewContinue = async ({ price, files }: { price: number; files: File[] }) => {
      const action = await dispatch(createProductAiJob({ price, files }));

      if (createProductAiJob.fulfilled.match(action)) {
         setQueuedAiItems((prev) => [...prev, { job: action.payload, price, files }]);
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
      try {
         const updatedJob = await productService.retryProductAiJob(item.job.id);
         setQueuedAiItems((prev) => prev.map((q) => (q.job.id === item.job.id ? { ...q, job: updatedJob } : q)));
      } catch (err) {
         console.error('[AI] retry failed', err);
      }
   };

   // ❌ Job verwerfen → Backend + Files löschen
   const handleRemoveAiItem = async (jobId: number) => {
      const ok = window.confirm('Diesen KI-Job wirklich verwerfen?\nAlle zugehörigen KI-Bilder werden gelöscht.');
      if (!ok) return;

      try {
         await productService.deleteProductAiJob(jobId);
         setQueuedAiItems((prev) => prev.filter((q) => q.job.id !== jobId));
         if (completingJobId === jobId) setCompletingJobId(null);
      } catch (err) {
         console.error('[AI] deleteProductAiJob failed', err);
         alert('KI-Job konnte nicht gelöscht werden.');
      }
   };

   /* =======================
      Produkt speichern
   ======================= */

   const hideEditDialog = () => {
      setDisplayEditDialog(false);
      setEditingProduct(null);
      setUploadFiles([]);
      setCompletingJobId(null);
   };

   const saveProduct = async () => {
      if (!editingProduct) return;

      const { id, name, description, price, imageUrl, sizes, tags } = editingProduct;
      let productId: number | undefined = id ?? undefined;

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

      // 🔥 KI-Bilder + Job nach erfolgreicher Fertigstellung löschen
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

   const header = (
      <div className="products-toolbar">
         <InputText placeholder="🔍 Suche…" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} />
         <Button icon="pi pi-plus" label="Neues Produkt" onClick={openNew} />
      </div>
   );

   const filters = {
      global: { value: globalFilter, matchMode: FilterMatchMode.CONTAINS },
   };

   const renderAiQueue = () =>
      queuedAiItems.length === 0 ? null : (
         <div className="products-ai-queue">
            <h3>Offene KI-Produkte</h3>

            {queuedAiItems.map((item) => {
               const { job, price } = item;
               const isSuccess = job.status === 'SUCCESS';
               const isFailed = job.status === 'FAILED';

               return (
                  <div key={job.id} className={`products-ai-item products-ai-item--${job.status.toLowerCase()}`}>
                     <div>
                        <strong>Job #{job.id}</strong> – {job.status}
                        {job.result_display_name && <div>{job.result_display_name}</div>}
                        <div>Preis: {price.toFixed(2)} €</div>
                        {job.error_message && <div className="products-ai-item-error">{job.error_message}</div>}
                     </div>

                     <div className="products-ai-item-actions">
                        <Button
                           label="Fertigstellen"
                           icon="pi pi-check"
                           disabled={!isSuccess}
                           onClick={() => handleCompleteFromAi(item)}
                        />
                        {isFailed && (
                           <Button
                              label="Erneut versuchen"
                              icon="pi pi-refresh"
                              onClick={() => handleRetryAiJob(item)}
                           />
                        )}
                        <Button icon="pi pi-times" onClick={() => handleRemoveAiItem(job.id)} />
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
               body={(p: Product) => (p.imageUrl ? <img src={resolveImageUrl(p.imageUrl)} width={50} /> : '–')}
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
            onHide={() => setDisplayNewAiDialog(false)}
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
