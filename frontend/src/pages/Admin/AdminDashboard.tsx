// frontend/src/pages/Admin/AdminDashboard.tsx

import React, { useEffect, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { useNavigate } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '../../store';
import {
    fetchProducts,
    updateProduct,
    deleteProduct,
    uploadProductImages,
    deleteProductImage,
} from '../../store/slices/productSlice';
import {
    fetchOrders,
    updateOrderStatus,
    selectOrders,
} from '../../store/slices/orderSlice';
import {
    fetchUsers,
    updateUserById,
    deleteUser,
} from '../../store/slices/userSlice';

import type { Product } from '../../type/product';
import type { User } from '../../type/user';
import ProductDialog, { EditableProduct } from './Product/ProductDialog';
import UserEditDialog from './User/UserEditDialog';
import { ROUTES } from '../../utils/constants';

export const AdminDashboard: React.FC = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const products = useAppSelector((state) => state.product.products);
    const orders = useAppSelector(selectOrders);
    const users = useAppSelector((state) => state.user.users);

    // --- Produkt-Dialog ---
    const [displayDialog, setDisplayDialog] = useState(false);
    const [editingProduct, setEditingProduct] =
        useState<EditableProduct | null>(null);
    const [uploadFiles, setUploadFiles] = useState<File[]>([]);

    // --- User-Dialog (geteilt mit ManageUsers) ---
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [userDialogVisible, setUserDialogVisible] = useState(false);

    useEffect(() => {
        dispatch(fetchProducts());
        dispatch(fetchOrders());
        dispatch(fetchUsers());
    }, [dispatch]);

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

    const openUserDialog = (u: User) => {
        setEditingUser(u);
        setUserDialogVisible(true);
    };

    const hideUserDialog = () => {
        setUserDialogVisible(false);
        setEditingUser(null);
    };

    const saveProduct = async () => {
        if (!editingProduct || editingProduct.id == null) return;

        const { id, name, description, price, imageUrl, sizes } =
            editingProduct;

        await dispatch(
            updateProduct({
                id,
                changes: { name, description, price, imageUrl, sizes },
            })
        );

        if (uploadFiles.length > 0) {
            await dispatch(uploadProductImages({ id, files: uploadFiles }));
        }

        hideDialog();
    };

    const confirmDeleteProduct = (product: Product) => {
        if (window.confirm(`Produkt "${product.name}" wirklich löschen?`)) {
            if (product.id != null) dispatch(deleteProduct(product.id));
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

    // --- Orders & Users ---
    const onStatusChange = (orderId: number, newStatus: string) =>
        dispatch(updateOrderStatus({ orderId, status: newStatus }));

    const onUserRoleChange = (id: number, newRole: User['role']) =>
        dispatch(
            updateUserById({
                id,
                changes: { role: newRole },
            })
        );

    const onDeleteUser = (u: User) =>
        void (
            window.confirm(`User "${u.email}" wirklich löschen?`) &&
            dispatch(deleteUser(u.id))
        );

    return (
        <div className="p-grid p-dir-col p-gap-4 p-p-4">
            {/* Produkte */}
            <div className="p-col">
                <div className="p-d-flex p-jc-between p-ai-center p-mb-2">
                    <h2>Produkte verwalten</h2>
                    <Button
                        label="Vollständig verwalten"
                        icon="pi pi-cog"
                        onClick={() => navigate(ROUTES.MANAGE_PRODUCTS)}
                        className="p-button-sm"
                    />
                </div>
                <DataTable
                    value={products}
                    paginator
                    rows={10}
                    responsiveLayout="scroll"
                >
                    <Column field="id" header="ID" style={{ width: '5rem' }} />
                    <Column field="name" header="Name" />
                    <Column
                        header="Preis (€)"
                        body={(row) => Number(row.price).toFixed(2)}
                        style={{ width: '8rem' }}
                    />
                    <Column
                        header="Aktionen"
                        body={(row) => (
                            <div>
                                <Button
                                    icon="pi pi-pencil"
                                    className="p-button-sm p-button-rounded p-button-text"
                                    onClick={() => editExisting(row)}
                                />
                                <Button
                                    icon="pi pi-trash"
                                    className="p-button-sm p-button-rounded p-button-text p-button-danger"
                                    onClick={() => confirmDeleteProduct(row)}
                                />
                            </div>
                        )}
                        style={{ width: '8rem' }}
                    />
                </DataTable>
            </div>

            {/* Bestellungen */}
            <div className="p-col">
                <div className="p-d-flex p-jc-between p-ai-center p-mb-2">
                    <h2>Bestellungen</h2>
                    <Button
                        label="Vollständig verwalten"
                        icon="pi pi-cog"
                        onClick={() => navigate(ROUTES.MANAGE_ORDERS)}
                        className="p-button-sm"
                    />
                </div>
                <DataTable
                    value={orders}
                    paginator
                    rows={10}
                    responsiveLayout="scroll"
                >
                    <Column
                        field="id"
                        header="Bestell-Nr."
                        style={{ width: '8rem' }}
                    />
                    <Column field="user.email" header="Kunde" />
                    <Column field="status" header="Status" />
                    <Column
                        field="createdAt"
                        header="Datum"
                        body={(row) =>
                            new Date(row.createdAt).toLocaleDateString()
                        }
                    />
                    <Column
                        header="Aktionen"
                        body={(row) => (
                            <Button
                                label={
                                    row.status === 'Bestellt'
                                        ? 'Als bezahlt'
                                        : 'Stornieren'
                                }
                                className="p-button-sm"
                                onClick={() =>
                                    onStatusChange(
                                        row.id,
                                        row.status === 'Bestellt'
                                            ? 'Bezahlt'
                                            : 'Storniert'
                                    )
                                }
                            />
                        )}
                        style={{ width: '10rem' }}
                    />
                </DataTable>
            </div>

            {/* Userverwaltung */}
            <div className="p-col">
                <div className="p-d-flex p-jc-between p-ai-center p-mb-2">
                    <h2>User verwalten</h2>
                    <Button
                        label="Vollständig verwalten"
                        icon="pi pi-cog"
                        onClick={() => navigate(ROUTES.MANAGE_USERS)}
                        className="p-button-sm"
                    />
                </div>
                <DataTable
                    value={users}
                    paginator
                    rows={10}
                    responsiveLayout="scroll"
                >
                    <Column
                        field="id"
                        header="ID"
                        style={{ width: '5rem' }}
                    />
                    <Column field="email" header="E-Mail" />
                    <Column
                        header="Name"
                        body={(u: User) => `${u.first_name} ${u.last_name}`}
                    />
                    <Column
                        header="Rolle"
                        body={(u: User) => (
                            <Dropdown
                                value={u.role}
                                options={[
                                    { label: 'Kunde', value: 'customer' },
                                    { label: 'Admin', value: 'admin' },
                                ]}
                                onChange={(e) =>
                                    onUserRoleChange(u.id, e.value)
                                }
                                style={{ width: '8rem' }}
                            />
                        )}
                    />
                    <Column
                        header="Aktionen"
                        body={(u: User) => (
                            <div className="p-d-flex p-flex-wrap">
                                <Button
                                    icon="pi pi-cog"
                                    className="p-button-text p-button-sm p-mr-2"
                                    tooltip="Details & Bearbeiten"
                                    onClick={() => openUserDialog(u)}
                                />
                                <Button
                                    icon="pi pi-trash"
                                    className="p-button-danger p-button-text p-button-sm"
                                    tooltip="Löschen"
                                    onClick={() => onDeleteUser(u)}
                                />
                            </div>
                        )}
                        style={{ width: '10rem' }}
                    />
                </DataTable>
            </div>

            {/* Produkt-Dialog */}
            <ProductDialog
                visible={displayDialog}
                title="Produkt bearbeiten"
                product={editingProduct}
                uploadFiles={uploadFiles}
                onProductChange={setEditingProduct}
                onUploadFilesChange={setUploadFiles}
                onHide={hideDialog}
                onSave={saveProduct}
                onDeleteImage={handleDeleteImage}
            />

            {/* Gemeinsamer User-Dialog */}
            <UserEditDialog
                visible={userDialogVisible}
                user={editingUser}
                onHide={hideUserDialog}
            />
        </div>
    );
};

export default AdminDashboard;
