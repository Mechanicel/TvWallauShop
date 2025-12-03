// frontend/src/pages/Admin/ManageProducts.tsx

import React, { useEffect, useState, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { FilterMatchMode } from 'primereact/api';

import { useAppDispatch, useAppSelector } from '../../../store';
import {
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    uploadProductImages,
    deleteProductImage,
    selectProducts,
    selectProductLoading,
    selectProductError,
} from '../../../store/slices/productSlice';
import type { Product } from '../../../type/product';
import { resolveImageUrl } from '../../../utils/imageUrl';
import ProductDialog, { EditableProduct } from './ProductDialog';

import './ManageProducts.css';

export const ManageProducts: React.FC = () => {
    const dispatch = useAppDispatch();
    const products = useAppSelector(selectProducts);
    const loading = useAppSelector(selectProductLoading);
    const error = useAppSelector(selectProductError);

    const dt = useRef<DataTable<any>>(null);

    const [displayDialog, setDisplayDialog] = useState(false);
    const [editingProduct, setEditingProduct] =
        useState<EditableProduct | null>(null);
    const [uploadFiles, setUploadFiles] = useState<File[]>([]);
    const [globalFilter, setGlobalFilter] = useState<string>('');

    useEffect(() => {
        dispatch(fetchProducts());
    }, [dispatch]);

    const openNew = () => {
        setEditingProduct({
            name: '',
            description: '',
            price: 0,
            imageUrl: '',
            sizes: [],
            images: [],
        });
        setUploadFiles([]);
        setDisplayDialog(true);
    };

    const editExisting = (product: Product) => {
        setEditingProduct({ ...product });
        setUploadFiles([]);
        setDisplayDialog(true);
    };

    const hideDialog = () => {
        setDisplayDialog(false);
        setEditingProduct(null);
        setUploadFiles([]);
    };

    const saveProduct = async () => {
        if (!editingProduct) return;
        const { id, name, description, price, imageUrl, sizes } =
            editingProduct;

        let productId: number | undefined = id ?? undefined;

        if (id != null) {
            const action = await dispatch(
                updateProduct({
                    id,
                    changes: { name, description, price, imageUrl, sizes },
                })
            );
            if ('payload' in action && (action as any).payload?.id != null) {
                productId = (action as any).payload.id;
            }
        } else {
            const action = await dispatch(
                addProduct({ name, description, price, imageUrl, sizes })
            );
            if ('payload' in action && (action as any).payload?.id != null) {
                productId = (action as any).payload.id;
            }
        }

        if (productId != null && uploadFiles.length > 0) {
            await dispatch(uploadProductImages({ id: productId, files: uploadFiles }));
        }

        hideDialog();
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
            })
        );

        if ('payload' in action && (action as any).payload) {
            const updated = action.payload as Product;
            setEditingProduct((prev) =>
                prev && prev.id === updated.id ? { ...updated } : prev
            );
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
                <Button
                    icon="pi pi-plus"
                    label="Neues Produkt"
                    onClick={openNew}
                    className="products-button"
                />
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

            {error && <p className="error-message">{error}</p>}

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
            >
                <Column field="id" header="ID" sortable />
                <Column field="name" header="Name" sortable />
                <Column field="description" header="Beschreibung" />
                <Column
                    field="price"
                    header="Preis"
                    body={(row: Product) => `${row.price.toFixed(2)} €`}
                    sortable
                />
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
                        <div className="actions-column">
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

            <ProductDialog
                visible={displayDialog}
                title="Produkt"
                product={editingProduct}
                uploadFiles={uploadFiles}
                onProductChange={setEditingProduct}
                onUploadFilesChange={setUploadFiles}
                onHide={hideDialog}
                onSave={saveProduct}
                onDeleteImage={handleDeleteImage}
            />
        </div>
    );
};
