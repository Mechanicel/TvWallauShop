// frontend/src/pages/Admin/AdminDashboard.tsx

import React, { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, Pencil, Settings2, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import {
   fetchProducts,
   updateProduct,
   deleteProduct,
   uploadProductImages,
   deleteProductImage,
} from '@/store/slices/productSlice';
import { fetchOrders, updateOrderStatus, selectOrders, deleteOrder } from '@/store/slices/orderSlice';
import { fetchUsers, updateUserById, deleteUser } from '@/store/slices/userSlice';
import type { Product } from '@/type/product';
import type { User } from '@/type/user';
import type { Order } from '@tvwallaushop/contracts';
import { ROUTES } from '@/utils/constants';
import { mapApiUserToUser } from '@/utils/helpers';
import { formatPrice, formatDate } from '@/utils/format';
import { orderStatusVariant } from '@/utils/orderStatus';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProductDialog, { type EditableProduct } from './Product/ProductDialog';
import UserEditDialog from './User/UserEditDialog';
import OrderEditDialog, { type OrderStatus } from './Ordner/OrderEditDialog';

const Section: React.FC<{ title: string; actionLabel: string; onAction: () => void; children: React.ReactNode }> = ({
   title,
   actionLabel,
   onAction,
   children,
}) => (
   <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
         <h2 className="text-lg font-semibold text-foreground">{title}</h2>
         <Button variant="outline" size="sm" onClick={onAction}>
            <Settings2 className="h-4 w-4" />
            {actionLabel}
         </Button>
      </div>
      {children}
   </section>
);

export const AdminDashboard: React.FC = () => {
   const dispatch = useAppDispatch();
   const navigate = useNavigate();

   const products = useAppSelector((state) => state.product.products);
   const orders = useAppSelector(selectOrders);
   const users = useAppSelector((state) => state.user.users);

   const [displayDialog, setDisplayDialog] = useState(false);
   const [editingProduct, setEditingProduct] = useState<EditableProduct | null>(null);
   const [uploadFiles, setUploadFiles] = useState<File[]>([]);

   const [editingUser, setEditingUser] = useState<User | null>(null);
   const [userDialogVisible, setUserDialogVisible] = useState(false);

   const [editingOrder, setEditingOrder] = useState<Order | null>(null);
   const [orderDialogVisible, setOrderDialogVisible] = useState(false);

   useEffect(() => {
      dispatch(fetchProducts());
      dispatch(fetchOrders());
      dispatch(fetchUsers());
   }, [dispatch]);

   // ---------- Produkte ----------
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
      if (!editingProduct || editingProduct.id == null) return;
      const { id, name, description, price, imageUrl, sizes } = editingProduct;
      await dispatch(
         updateProduct({ id, changes: { name, description: description ?? '', price, imageUrl: imageUrl ?? '', sizes } }),
      );
      if (uploadFiles.length > 0) {
         await dispatch(uploadProductImages({ id, files: uploadFiles }));
      }
      hideDialog();
   };

   const confirmDeleteProduct = (product: Product) => {
      if (window.confirm(`Produkt "${product.name}" wirklich löschen?`) && product.id != null) {
         dispatch(deleteProduct(product.id));
      }
   };

   const handleDeleteImage = async (imageId: number) => {
      if (!editingProduct || editingProduct.id == null) return;
      if (!window.confirm('Dieses Bild wirklich löschen?')) return;
      const action = await dispatch(deleteProductImage({ productId: editingProduct.id, imageId }));
      if ('payload' in action && (action as any).payload) {
         const updated = action.payload as Product;
         setEditingProduct((prev) => (prev && prev.id === updated.id ? { ...updated } : prev));
      }
   };

   // ---------- User ----------
   const openUserDialog = (u: User) => {
      setEditingUser(u);
      setUserDialogVisible(true);
   };
   const hideUserDialog = () => {
      setUserDialogVisible(false);
      setEditingUser(null);
   };
   const onUserRoleChange = (id: number, newRole: User['role']) =>
      dispatch(updateUserById({ id, changes: { role: newRole } }));
   const onDeleteUser = (u: User) =>
      void (window.confirm(`User "${u.email}" wirklich löschen?`) && dispatch(deleteUser(u.id)));

   // ---------- Orders ----------
   const openOrderDialog = (order: Order) => {
      setEditingOrder(order);
      setOrderDialogVisible(true);
   };
   const hideOrderDialog = () => {
      setOrderDialogVisible(false);
      setEditingOrder(null);
   };
   const onStatusChange = (orderId: number, newStatus: OrderStatus) =>
      dispatch(updateOrderStatus({ orderId, status: newStatus }));
   const handleSaveOrderStatus = async (orderId: number, status: OrderStatus) => {
      await dispatch(updateOrderStatus({ orderId, status }));
      setOrderDialogVisible(false);
   };
   const handleDeleteOrder = async (orderId: number) => {
      await dispatch(deleteOrder(orderId));
      setOrderDialogVisible(false);
      setEditingOrder(null);
   };

   const productColumns: ColumnDef<Product, any>[] = [
      { id: 'id', accessorFn: (r) => r.id, header: 'ID', cell: ({ row }) => `#${row.original.id}` },
      { id: 'name', accessorFn: (r) => r.name, header: 'Name' },
      { id: 'price', accessorFn: (r) => r.price, header: 'Preis', cell: ({ row }) => formatPrice(Number(row.original.price)) },
      {
         id: 'actions',
         header: 'Aktionen',
         enableSorting: false,
         cell: ({ row }) => (
            <div className="flex gap-1">
               <Button variant="ghost" size="icon" aria-label="Bearbeiten" onClick={() => editExisting(row.original)}>
                  <Pencil className="h-4 w-4" />
               </Button>
               <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  aria-label="Löschen"
                  onClick={() => confirmDeleteProduct(row.original)}
               >
                  <Trash2 className="h-4 w-4" />
               </Button>
            </div>
         ),
      },
   ];

   const orderColumns: ColumnDef<Order, any>[] = [
      { id: 'id', accessorFn: (r) => r.id, header: 'Bestell-Nr.', cell: ({ row }) => `#${row.original.id}` },
      { id: 'email', accessorFn: (r) => mapApiUserToUser(r.user).email, header: 'Kunde' },
      {
         id: 'status',
         accessorFn: (r) => r.status,
         header: 'Status',
         cell: ({ row }) => <Badge variant={orderStatusVariant(row.original.status)}>{row.original.status}</Badge>,
      },
      { id: 'createdAt', accessorFn: (r) => r.createdAt, header: 'Datum', cell: ({ row }) => formatDate(row.original.createdAt) },
      {
         id: 'actions',
         header: 'Aktionen',
         enableSorting: false,
         cell: ({ row }) => {
            const order = row.original;
            return (
               <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label="Bearbeiten" onClick={() => openOrderDialog(order)}>
                     <Settings2 className="h-4 w-4" />
                  </Button>
                  {order.status === 'Bestellt' && (
                     <Button
                        variant="ghost"
                        size="icon"
                        className="text-success"
                        aria-label="Als bezahlt markieren"
                        onClick={() => onStatusChange(order.id, 'Bezahlt')}
                     >
                        <Check className="h-4 w-4" />
                     </Button>
                  )}
                  {order.status !== 'Storniert' && (
                     <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        aria-label="Stornieren"
                        onClick={() => onStatusChange(order.id, 'Storniert')}
                     >
                        <X className="h-4 w-4" />
                     </Button>
                  )}
               </div>
            );
         },
      },
   ];

   const userColumns: ColumnDef<User, any>[] = [
      { id: 'id', accessorFn: (r) => r.id, header: 'ID', cell: ({ row }) => `#${row.original.id}` },
      { id: 'email', accessorFn: (r) => r.email, header: 'E-Mail' },
      { id: 'name', accessorFn: (r) => `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim(), header: 'Name' },
      {
         id: 'role',
         accessorFn: (r) => r.role,
         header: 'Rolle',
         enableSorting: false,
         cell: ({ row }) => (
            <Select value={row.original.role} onValueChange={(v) => onUserRoleChange(row.original.id, v as User['role'])}>
               <SelectTrigger className="w-32">
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                  <SelectItem value="customer">Kunde</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
               </SelectContent>
            </Select>
         ),
      },
      {
         id: 'actions',
         header: 'Aktionen',
         enableSorting: false,
         cell: ({ row }) => (
            <div className="flex gap-1">
               <Button variant="ghost" size="icon" aria-label="Bearbeiten" onClick={() => openUserDialog(row.original)}>
                  <Settings2 className="h-4 w-4" />
               </Button>
               <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  aria-label="Löschen"
                  onClick={() => onDeleteUser(row.original)}
               >
                  <Trash2 className="h-4 w-4" />
               </Button>
            </div>
         ),
      },
   ];

   return (
      <div className="tw-scope mx-auto max-w-6xl px-4 py-8">
         <h1 className="mb-6 text-2xl font-semibold text-foreground">Admin-Dashboard</h1>

         <Section title="Produkte verwalten" actionLabel="Vollständig verwalten" onAction={() => navigate(ROUTES.MANAGE_PRODUCTS)}>
            <DataTable columns={productColumns} data={products} pageSize={5} getRowId={(r) => String(r.id)} emptyMessage="Keine Produkte." />
         </Section>

         <Section title="Bestellungen" actionLabel="Vollständig verwalten" onAction={() => navigate(ROUTES.MANAGE_ORDERS)}>
            <DataTable columns={orderColumns} data={orders} pageSize={5} getRowId={(r) => String(r.id)} emptyMessage="Keine Bestellungen." />
         </Section>

         <Section title="Benutzer verwalten" actionLabel="Vollständig verwalten" onAction={() => navigate(ROUTES.MANAGE_USERS)}>
            <DataTable columns={userColumns} data={users} pageSize={5} getRowId={(r) => String(r.id)} emptyMessage="Keine Benutzer." />
         </Section>

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

         <UserEditDialog visible={userDialogVisible} user={editingUser} onHide={hideUserDialog} />

         <OrderEditDialog
            order={editingOrder}
            visible={orderDialogVisible}
            onHide={hideOrderDialog}
            onSaveStatus={handleSaveOrderStatus}
            onDelete={handleDeleteOrder}
         />
      </div>
   );
};
