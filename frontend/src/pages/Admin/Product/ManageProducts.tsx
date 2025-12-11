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
import type { Product } from '@/type/product';
import { resolveImageUrl } from '@/utils/imageUrl';
import ProductDialog, { EditableProduct } from './ProductDialog';
import NewProductAiDialog from './ProductAiDialog';

import './ManageProducts.css';

export const ManageProducts: React.FC = () => {
   const dispatch = useAppDispatch();
   const products = useAppSelector(selectProducts);
   const loading = useAppSelector(selectProductLoading);
   const error = useAppSelector(selectProductError);

   const aiJobLoading = useAppSelector(selectProductAiJobLoading);
   const aiJobError = useAppSelector(selectProductAiJobError);

   const dt = useRef<DataTableType<any> | null>(null);

   // Dialog für bestehende Produkte (Bearbeiten)
   const [displayEditDialog, setDisplayEditDialog] = useState(false);
   const [editingProduct, setEditingProduct] = useState<EditableProduct | null>(null);

   // Dialog für neuen KI-basierten Erstellungsschritt (Bilder + Preis)
   const [displayNewAiDialog, setDisplayNewAiDialog] = useState(false);

   // Upload-Files, die sowohl von Neu-Dialog als auch Edit-Dialog genutzt werden können
   const [uploadFiles, setUploadFiles] = useState<File[]>([]);
   const [globalFilter, setGlobalFilter] = useState<string>('');

   useEffect(() => {
      dispatch(fetchProducts());
   }, [dispatch]);

   const openNew = () => {
      setUploadFiles([]);
      setEditingProduct(null);
      setDisplayNewAiDialog(true);
   };

   const handleAiNewContinue = async (payload: { price: number; files: File[] }) => {
      const { price, files } = payload;
      setUploadFiles(files);

      const action = await dispatch(
         createProductAiJob({
            price,
            files,
         }),
      );

      if (createProductAiJob.fulfilled.match(action)) {
         const job = action.payload;
         setEditingProduct({
            name: job.result_display_name ?? '',
            description: job.result_description ?? '',
            price,
            imageUrl: '',
            sizes: [],
            images: [],
            tags: job.result_tags ?? [], // 🟢 KI-Tags übernehmen
         });
      } else {
         // Fallback: Wenn KI-Job fehlschlägt, starten wir trotzdem mit leerem Produkt,
         // damit der Admin manuell weitermachen kann.
         setEditingProduct({
            name: '',
            description: '',
            price,
            imageUrl: '',
            sizes: [],
            images: [],
            tags: [], // 🟢 vorbereitet auf Tags
         });
      }

      setDisplayNewAiDialog(false);
      setDisplayEditDialog(true);
   };

   const editExisting = (product: Product) => {
      setEditingProduct({ ...(product as EditableProduct) });
      setUploadFiles([]);
      setDisplayEditDialog(true);
   };

   const hideEditDialog = () => {
      setDisplayEditDialog(false);
      setEditingProduct(null);
      setUploadFiles([]);
   };

   const saveProduct = async () => {
      if (!editingProduct) return;

      const {
         id,
         name,
         description,
         price,
         imageUrl,
         sizes,
         tags, // 🟢 NEU: tags mit aus dem Dialog holen
      } = editingProduct;

      let productId: number | undefined = id ?? undefined;

      if (id != null) {
         const action = await dispatch(
            updateProduct({
               id,
               changes: {
                  name,
                  description,
                  price,
                  imageUrl,
                  sizes,
                  tags: tags ?? [], // 🟢 Tags beim Update mitschicken
               },
            }),
         );
         if ('payload' in action && (action as any).payload?.id != null) {
            productId = (action as any).payload.id;
         }
      } else {
         const action = await dispatch(
            addProduct({
               name,
               description,
               price,
               imageUrl,
               sizes,
               tags: tags ?? [], // 🟢 Tags beim Create mitschicken
            }),
         );
         if ('payload' in action && (action as any).payload?.id != null) {
            productId = (action as any).payload.id;
         }
      }

      if (productId != null && uploadFiles.length > 0) {
         await dispatch(uploadProductImages({ id: productId, files: uploadFiles }));
      }

      hideEditDialog();
   };

   const confirmDelete = (product: Product) => {
      if (window.confirm(`Produkt "${product.name}" wirklich löschen?`)) {
         if (product.id != null) {
            dispatch(deleteProduct(product.id));
         }
      }
   };

   const handleDeleteImage = async (imageId: number) => {
      if (!editingProduct || editingProduct.id == null) return;

      const ok = window.confirm('Dieses Bild wirklich löschen?');
      if (!ok) return;

      const action = await dispatch(
         deleteProductImage({
            productId: editingProduct.id,
            imageId,
         }),
      );

      if ('payload' in action && (action as any).payload) {
         const updated = action.payload as Product;
         setEditingProduct((prev) => (prev && prev.id === updated.id ? { ...updated } : prev));
      }
   };

   const header = (
      <div className="products-toolbar">
         <div className="products-field">
            <InputText
               placeholder="🔍 Suche nach Name, Beschreibung…"
               value={globalFilter}
               onChange={(e) => setGlobalFilter(e.target.value)}
               className="products-input"
            />
         </div>
         <div className="products-actions">
            <Button icon="pi pi-plus" label="Neues Produkt" onClick={openNew} className="products-button" />
            <Button
               icon="pi pi-file-excel"
               label="CSV export"
               onClick={() => dt.current?.exportCSV()}
               className="products-button"
            />
         </div>
      </div>
   );

   const filters = {
      global: { value: globalFilter, matchMode: FilterMatchMode.CONTAINS },
   };

   return (
      <div className="products-page">
         <h2>Produkte verwalten</h2>

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
            responsiveLayout="scroll"
            className="products-table"
         >
            <Column field="id" header="ID" sortable />
            <Column field="name" header="Name" sortable />
            <Column field="description" header="Beschreibung" />
            <Column field="price" header="Preis" body={(row: Product) => `${row.price.toFixed(2)} €`} sortable />
            <Column
               field="imageUrl"
               header="Bild"
               body={(row: Product) =>
                  row.imageUrl ? (
                     <img
                        src={resolveImageUrl(row.imageUrl)}
                        alt={row.name}
                        style={{
                           width: '60px',
                           height: '60px',
                           objectFit: 'cover',
                        }}
                     />
                  ) : (
                     <span>–</span>
                  )
               }
            />
            <Column
               header="Aktionen"
               body={(row: Product) => (
                  <div className="row-actions">
                     <Button
                        icon="pi pi-pencil"
                        className="p-button-text p-button-sm"
                        onClick={() => editExisting(row)}
                     />
                     <Button
                        icon="pi pi-trash"
                        className="p-button-text p-button-sm p-button-danger"
                        onClick={() => confirmDelete(row)}
                     />
                  </div>
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
            title="Produkt"
            product={editingProduct}
            uploadFiles={uploadFiles}
            onProductChange={setEditingProduct}
            onUploadFilesChange={setUploadFiles}
            onHide={hideEditDialog}
            onSave={saveProduct}
            onDeleteImage={handleDeleteImage}
         />
      </div>
   );
};

export default ManageProducts;
