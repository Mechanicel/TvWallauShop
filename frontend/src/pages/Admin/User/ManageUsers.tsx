// frontend/src/pages/Admin/User/ManageUsers.tsx

import React, { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { FileSpreadsheet, Pencil, Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchUsers, updateUserById, deleteUser } from '@/store/slices/userSlice';
import type { User } from '@/type/user';
import { formatDate } from '@/utils/format';
import { exportRowsToCsv } from '@/utils/csv';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import UserEditDialog from './UserEditDialog';

const fullName = (u: User) => `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();

export const ManageUsers: React.FC = () => {
   const dispatch = useAppDispatch();
   const { users, loading, error } = useAppSelector((state) => state.user);

   const [globalFilter, setGlobalFilter] = useState('');
   const [editingUser, setEditingUser] = useState<User | null>(null);
   const [dialogVisible, setDialogVisible] = useState(false);

   useEffect(() => {
      dispatch(fetchUsers());
   }, [dispatch]);

   const onRoleChange = (id: number, newRole: User['role']) => {
      dispatch(updateUserById({ id, changes: { role: newRole } }));
   };

   const onDeleteUser = (u: User) => {
      if (window.confirm(`User "${u.email}" wirklich löschen?`)) {
         dispatch(deleteUser(u.id));
      }
   };

   const openEditDialog = (u: User) => {
      setEditingUser(u);
      setDialogVisible(true);
   };

   const hideDialog = () => {
      setDialogVisible(false);
      setEditingUser(null);
   };

   const exportCsv = () => {
      exportRowsToCsv(
         'benutzer.csv',
         ['ID', 'E-Mail', 'Vorname', 'Nachname', 'Rolle', 'Status'],
         users.map((u) => [u.id, u.email, u.firstName, u.lastName, u.role, u.accountStatus]),
      );
   };

   const columns: ColumnDef<User, any>[] = [
      { id: 'id', accessorFn: (row) => row.id, header: 'ID', cell: ({ row }) => `#${row.original.id}` },
      { id: 'email', accessorFn: (row) => row.email, header: 'E-Mail' },
      { id: 'name', accessorFn: (row) => fullName(row), header: 'Name' },
      {
         id: 'role',
         accessorFn: (row) => row.role,
         header: 'Rolle',
         enableSorting: false,
         cell: ({ row }) => (
            <Select value={row.original.role} onValueChange={(v) => onRoleChange(row.original.id, v as User['role'])}>
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
            <Button variant="ghost" size="sm" onClick={() => openEditDialog(row.original)}>
               <Pencil className="h-4 w-4" />
               Bearbeiten
            </Button>
         ),
      },
   ];

   const renderSubComponent = (u: User) => {
      const rows: Array<[string, React.ReactNode]> = [
         ['User-ID', u.id],
         ['E-Mail', u.email],
         ['Name', `${u.firstName ?? ''} ${u.lastName ?? ''}`],
         ['Telefon', u.phone || '–'],
         ['Rolle', u.role],
         ['Konto erstellt', formatDate(u.createdAt)],
         ['Adresse', `${u.street ?? ''} ${u.houseNumber ?? ''}, ${u.postalCode ?? ''} ${u.city ?? ''}, ${u.country ?? ''}`],
         [
            'Lieferadresse',
            `${u.shippingStreet ?? ''} ${u.shippingHouseNumber ?? ''}, ${u.shippingPostalCode ?? ''} ${u.shippingCity ?? ''}, ${u.shippingCountry ?? ''}`,
         ],
         ['Zahlung', u.preferredPayment || '–'],
         ['Newsletter', u.newsletterOptIn ? 'Ja' : 'Nein'],
         ['Geburtsdatum', u.dateOfBirth ?? '–'],
         ['Geschlecht', u.gender ?? '–'],
         ['Treuepunkte', u.loyaltyPoints],
         ['Status', u.accountStatus],
      ];

      return (
         <div className="p-2">
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
               Details für {u.email}
            </h4>
            <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
               {rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-border py-1">
                     <dt className="text-muted-foreground">{k}</dt>
                     <dd className="text-right text-foreground">{v}</dd>
                  </div>
               ))}
            </dl>
            <div className="mt-4 flex gap-2">
               <Button variant="outline" size="sm" onClick={() => openEditDialog(u)}>
                  <Pencil className="h-4 w-4" />
                  Bearbeiten
               </Button>
               <Button
                  size="sm"
                  className="bg-destructive text-destructive-foreground hover:opacity-90"
                  onClick={() => onDeleteUser(u)}
               >
                  <Trash2 className="h-4 w-4" />
                  Löschen
               </Button>
            </div>
         </div>
      );
   };

   return (
      <div className="tw-scope mx-auto max-w-6xl px-4 py-8">
         <h1 className="mb-6 text-2xl font-semibold text-foreground">Benutzer verwalten</h1>

         {error && <p className="mb-4 text-sm text-destructive">Fehler: {error}</p>}

         <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
               placeholder="Suche nach ID, Name, E-Mail…"
               value={globalFilter}
               onChange={(e) => setGlobalFilter(e.target.value)}
               className="sm:w-72"
            />
            <Button variant="outline" onClick={exportCsv}>
               <FileSpreadsheet className="h-4 w-4" />
               CSV-Export
            </Button>
         </div>

         <DataTable
            columns={columns}
            data={users}
            globalFilter={globalFilter}
            loading={loading}
            getRowId={(row) => String(row.id)}
            renderSubComponent={renderSubComponent}
            emptyMessage="Keine Benutzer gefunden."
         />

         <UserEditDialog visible={dialogVisible} user={editingUser} onHide={hideDialog} />
      </div>
   );
};
