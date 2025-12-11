// frontend/src/pages/Admin/ManageUsers.tsx

import React, { useEffect, useRef, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { FilterMatchMode } from 'primereact/api';

import { useAppDispatch, useAppSelector } from '@/store';
import { fetchUsers, updateUserById, deleteUser } from '@/store/slices/userSlice';
import type { User } from '@/type/user';

import UserEditDialog from './UserEditDialog';
import './ManageUsers.css';

export const ManageUsers: React.FC = () => {
   const dispatch = useAppDispatch();
   const { users, loading, error } = useAppSelector((state) => state.user);

   const dt = useRef<DataTable<any>>(null);
   const [expandedRows, setExpandedRows] = useState<{ [key: number]: boolean } | undefined>(undefined);

   const [globalFilter, setGlobalFilter] = useState<string>('');
   const [editingUser, setEditingUser] = useState<User | null>(null);
   const [dialogVisible, setDialogVisible] = useState(false);

   useEffect(() => {
      dispatch(fetchUsers());
   }, [dispatch]);

   const onRoleChange = (id: number, newRole: User['role']) => {
      dispatch(
         updateUserById({
            id,
            changes: { role: newRole },
         }),
      );
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

   const rowExpansionTemplate = (u: User) => (
      <div className="user-expansion">
         <h5>Details für {u.email}</h5>
         <ul className="kv">
            <li>
               <span>User-ID</span>
               <span>{u.id}</span>
            </li>
            <li>
               <span>E-Mail</span>
               <span>{u.email}</span>
            </li>
            <li>
               <span>Name</span>
               <span>
                  {u.first_name} {u.last_name}
               </span>
            </li>
            <li>
               <span>Telefon</span>
               <span>{u.phone || '-'}</span>
            </li>
            <li>
               <span>Rolle</span>
               <span>{u.role}</span>
            </li>
            <li>
               <span>Konto erstellt</span>
               <span>{new Date(u.createdAt).toLocaleDateString('de-DE')}</span>
            </li>

            {/* Adressen, etc. */}
            <li>
               <span>Adresse</span>
               <span>
                  {u.street} {u.house_number}, {u.postal_code} {u.city}, {u.country}
               </span>
            </li>
            <li>
               <span>Lieferadresse</span>
               <span>
                  {u.shippingStreet} {u.shippingHouseNumber}, {u.shippingPostalCode} {u.shippingCity},{' '}
                  {u.shippingCountry}
               </span>
            </li>
            <li>
               <span>Zahlung</span>
               <span>{u.preferred_payment}</span>
            </li>
            <li>
               <span>Newsletter</span>
               <span>{u.newsletter_opt_in ? 'Ja' : 'Nein'}</span>
            </li>
            <li>
               <span>Geburtsdatum</span>
               <span>{u.dateOfBirth ?? '-'}</span>
            </li>
            <li>
               <span>Geschlecht</span>
               <span>{u.gender ?? '-'}</span>
            </li>
            <li>
               <span>Treuepunkte</span>
               <span>{u.loyaltyPoints}</span>
            </li>
            <li>
               <span>Status</span>
               <span>{u.accountStatus}</span>
            </li>
         </ul>

         <div className="user-expansion__actions">
            <Button
               icon="pi pi-pencil"
               className="p-button-text p-mr-2"
               label="Bearbeiten"
               onClick={() => openEditDialog(u)}
            />
            <Button icon="pi pi-trash" className="p-button-danger" label="Löschen" onClick={() => onDeleteUser(u)} />
         </div>
      </div>
   );

   // 🔍 Toolbar-Header – gleiches Pattern wie bei Produkten
   const header = (
      <div className="users-toolbar">
         <div className="users-field">
            <InputText
               placeholder="🔍 Suche nach ID, Name, E-Mail…"
               value={globalFilter}
               onChange={(e) => setGlobalFilter(e.target.value)}
               className="users-input"
            />
         </div>
         <div className="users-actions">
            <Button
               icon="pi pi-file-excel"
               label="CSV export"
               onClick={() => dt.current?.exportCSV()}
               className="users-button"
            />
         </div>
      </div>
   );

   const filters = {
      global: { value: globalFilter, matchMode: FilterMatchMode.CONTAINS },
   };

   return (
      <div className="users-page">
         <h2>User verwalten</h2>

         {error && <div className="p-error users-error">Fehler: {error}</div>}

         <DataTable
            ref={dt}
            value={users}
            loading={loading}
            paginator
            rows={10}
            dataKey="id"
            header={header}
            filters={filters}
            globalFilterFields={['email', 'first_name', 'last_name', 'id']}
            expandedRows={expandedRows}
            onRowToggle={(e) => setExpandedRows(e.data)}
            rowExpansionTemplate={rowExpansionTemplate}
            className="users-table"
            responsiveLayout="scroll"
         >
            <Column expander style={{ width: '3rem' }} />
            <Column field="id" header="ID" sortable style={{ width: '6rem' }} />
            <Column field="email" header="E-Mail" sortable />
            <Column header="Name" body={(u: User) => `${u.first_name} ${u.last_name}`} sortable />
            <Column
               header="Rolle"
               body={(u: User) => (
                  <Dropdown
                     value={u.role}
                     options={[
                        { label: 'Kunde', value: 'customer' },
                        { label: 'Admin', value: 'admin' },
                     ]}
                     onChange={(e) => onRoleChange(u.id, e.value)}
                     style={{ width: '8rem' }}
                  />
               )}
            />
            <Column
               header="Aktionen"
               body={(u: User) => (
                  <Button
                     icon="pi pi-cog"
                     className="p-button-text p-button-sm"
                     label="Bearbeiten"
                     onClick={() => openEditDialog(u)}
                  />
               )}
               style={{ width: '9rem' }}
            />
         </DataTable>

         <UserEditDialog visible={dialogVisible} user={editingUser} onHide={hideDialog} />
      </div>
   );
};

export default ManageUsers;
