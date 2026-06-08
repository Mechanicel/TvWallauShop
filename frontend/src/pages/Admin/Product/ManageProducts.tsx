// frontend/src/pages/Admin/Product/ManageProducts.tsx

import React, { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
import type { Product, ProductAiJob } from '@/type/product';
import { resolveImageUrl } from '@/utils/imageUrl';
import { formatPrice } from '@/utils/format';
import productService from '@/services/productService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import ProductDialog, { type EditableProduct } from './ProductDialog';
import ProductAiDialog from './ProductAiDialog';
import { AiJobQueue } from './AiJobQueue';
import { useAiProductJobs, type QueuedAiItem } from './useAiProductJobs';

export const ManageProducts: React.FC = () => {
   const dispatch = useAppDispatch();
   const products = useAppSelector(selectProducts);
   const loading = useAppSelector(selectProductLoading);
   const error = useAppSelector(selectProductError);
   const aiJobLoading = useAppSelector(selectProductAiJobLoading);
   const aiJobError = useAppSelector(selectProductAiJobError);

   const { queuedAiItems, isRetrying, addCreatedJob, retryJob, discardJob, removeJobLocal } = useAiProductJobs();

   const [displayEditDialog, setDisplayEditDialog] = useState(false);
   const [editingProduct, setEditingProduct] = useState<EditableProduct | null>(null);
   const [displayNewAiDialog, setDisplayNewAiDialog] = useState(false);
   const [uploadFiles, setUploadFiles] = useState<File[]>([]);
   const [globalFilter, setGlobalFilter] = useState('');
   const [completingJobId, setCompletingJobId] = useState<number | null>(null);

   useEffect(() => {
      dispatch(fetchProducts());
   }, [dispatch]);

   const openNew = () => {
      dispatch(resetAiJobState());
      setUploadFiles([]);
      setEditingProduct(null);
      setDisplayNewAiDialog(true);
   };

   const handleAiNewContinue = async ({ price, files }: { price: number; files: File[] }) => {
      const action = await dispatch(createProductAiJob({ price, files }));
      if (createProductAiJob.fulfilled.match(action)) {
         addCreatedJob(action.payload, price, files);
      }
      setDisplayNewAiDialog(false);
   };

   const rehydrateFilesIfNeeded = async (job: ProductAiJob): Promise<File[]> => {
      const paths = job.image_paths ?? [];
      if (!paths.length) return [];

      const urls = paths.map((path) => resolveImageUrl(path));
      return Promise.all(
         urls.map(async (url, idx) => {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to fetch AI image: ${url} (${res.status})`);
            const blob = await res.blob();
            return new File([blob], `ai_${job.id}_${idx}.jpg`, { type: blob.type || 'image/jpeg' });
         }),
      );
   };

   const handleCompleteFromAi = async (item: QueuedAiItem) => {
      setCompletingJobId(item.job.id);

      let files = item.files;
      if ((!files || files.length === 0) && item.job.image_paths?.length) {
         try {
            files = await rehydrateFilesIfNeeded(item.job);
         } catch (err) {
            console.error('[AI] Failed to rehydrate files', err);
            files = [];
         }
      }

      setEditingProduct({
         name: item.job.result_display_name ?? '',
         description: item.job.result_description ?? '',
         price: item.price,
         imageUrl: '',
         sizes: [],
         images: [],
         tags: item.job.result_tags ?? [],
      });
      setUploadFiles(files);
      setDisplayEditDialog(true);
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
      const safeDescription = description ?? '';
      const safeImageUrl = imageUrl ?? '';
      let productId: number | undefined;

      if (id != null) {
         const action = await dispatch(
            updateProduct({ id, changes: { name, description: safeDescription, price, imageUrl: safeImageUrl, sizes, tags } }),
         );
         productId = (action as any).payload?.id;
      } else {
         const action = await dispatch(
            addProduct({ name, description: safeDescription, price, imageUrl: safeImageUrl, sizes, tags }),
         );
         productId = (action as any).payload?.id;
      }

      if (productId && uploadFiles.length > 0) {
         await dispatch(uploadProductImages({ id: productId, files: uploadFiles }));
      }

      if (completingJobId !== null) {
         try {
            await productService.deleteProductAiJob(completingJobId);
         } catch (err) {
            console.warn('[AI] Cleanup after product creation failed', err);
         }
         removeJobLocal(completingJobId);
         setCompletingJobId(null);
      }

      hideEditDialog();
   };

   const columns: ColumnDef<Product, any>[] = [
      { id: 'id', accessorFn: (row) => row.id, header: 'ID', cell: ({ row }) => `#${row.original.id}` },
      { id: 'name', accessorFn: (row) => row.name, header: 'Name' },
      {
         id: 'price',
         accessorFn: (row) => row.price,
         header: 'Preis',
         cell: ({ row }) => formatPrice(Number(row.original.price)),
      },
      {
         id: 'image',
         header: 'Bild',
         enableSorting: false,
         cell: ({ row }) =>
            row.original.imageUrl ? (
               <img src={resolveImageUrl(row.original.imageUrl)} alt="" className="h-12 w-12 rounded-md object-cover" />
            ) : (
               <span className="text-muted-foreground">–</span>
            ),
      },
      {
         id: 'actions',
         header: 'Aktionen',
         enableSorting: false,
         cell: ({ row }) => (
            <div className="flex gap-1">
               <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Bearbeiten"
                  onClick={() => {
                     setEditingProduct({ ...(row.original as EditableProduct) });
                     setDisplayEditDialog(true);
                  }}
               >
                  <Pencil className="h-4 w-4" />
               </Button>
               <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  aria-label="Löschen"
                  onClick={() => row.original.id != null && dispatch(deleteProduct(row.original.id))}
               >
                  <Trash2 className="h-4 w-4" />
               </Button>
            </div>
         ),
      },
   ];

   return (
      <div className="tw-scope mx-auto max-w-6xl px-4 py-8">
         <h1 className="mb-6 text-2xl font-semibold text-foreground">Produkte verwalten</h1>

         <AiJobQueue
            items={queuedAiItems}
            isRetrying={isRetrying}
            onComplete={handleCompleteFromAi}
            onRetry={retryJob}
            onRemove={discardJob}
         />

         {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

         <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
               placeholder="Suche…"
               value={globalFilter}
               onChange={(e) => setGlobalFilter(e.target.value)}
               className="sm:w-72"
            />
            <Button onClick={openNew}>
               <Plus className="h-4 w-4" />
               Neues Produkt
            </Button>
         </div>

         <DataTable
            columns={columns}
            data={products}
            globalFilter={globalFilter}
            loading={loading}
            getRowId={(row) => String(row.id)}
            emptyMessage="Keine Produkte gefunden."
         />

         <ProductAiDialog
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
