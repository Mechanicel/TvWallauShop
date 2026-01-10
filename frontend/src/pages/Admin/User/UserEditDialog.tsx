// frontend/src/pages/Admin/UserEditDialog.tsx

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { Checkbox } from 'primereact/checkbox';
import { Button } from 'primereact/button';

import { useAppDispatch } from '@/store';
import { updateUserById } from '@/store/slices/userSlice';
import type { User } from '@/type/user';

export interface UserEditDialogProps {
   visible: boolean;
   user: User | null;
   onHide: () => void;
}

const UserEditDialog: React.FC<UserEditDialogProps> = ({ visible, user, onHide }) => {
   const dispatch = useAppDispatch();
   const [draft, setDraft] = useState<User | null>(user);

   // Immer wenn ein neuer User gesetzt wird, lokalen Draft aktualisieren
   useEffect(() => {
      setDraft(user ? { ...user } : null);
   }, [user]);

   const handleFieldChange = (field: keyof User, value: any) => {
      setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
   };

   const saveUser = async () => {
      if (!draft) return;

      const {
         id,
         firstName,
         lastName,
         email,
         phone,
         role,
         accountStatus,
         loyaltyPoints,
         street,
         houseNumber,
         postalCode,
         city,
         country,
         shippingStreet,
         shippingHouseNumber,
         shippingPostalCode,
         shippingCity,
         shippingState,
         shippingCountry,
         preferredPayment,
         newsletterOptIn,
         dateOfBirth,
         gender,
      } = draft;

      await dispatch(
         updateUserById({
            id,
            changes: {
               firstName,
               lastName,
               email,
               phone,
               role,
               street,
               houseNumber,
               postalCode,
               city,
               country,
               shippingStreet,
               shippingHouseNumber,
               shippingPostalCode,
               shippingCity,
               shippingState,
               shippingCountry,
               preferredPayment,
               newsletterOptIn,
               dateOfBirth,
               gender,
               accountStatus,
               loyaltyPoints,
               // optional – nur wenn in DB + allowedFields vorhanden:
               // loyalty_points: loyaltyPoints,
               // account_status: accountStatus,
            },
         }),
      );

      onHide();
   };

   const footer = (
      <>
         <Button label="Abbrechen" icon="pi pi-times" className="p-button-text" onClick={onHide} />
         <Button label="Speichern" icon="pi pi-check" onClick={saveUser} />
      </>
   );

   return (
      <Dialog
         visible={visible && !!draft}
         header={draft ? `User bearbeiten – ${draft.email}` : 'User bearbeiten'}
         style={{ width: '700px' }}
         modal
         className="user-edit-dialog"
         onHide={onHide}
         footer={footer}
      >
         {draft && (
            <div className="p-fluid p-formgrid p-grid user-edit-dialog__grid">
               {/* Basisdaten */}
               <div className="p-field p-col-12 p-md-6">
                  <label htmlFor="first_name">Vorname</label>
                  <InputText
                     id="first_name"
                     value={draft.firstName || ''}
                     onChange={(e) => handleFieldChange('firstName', e.target.value)}
                  />
               </div>
               <div className="p-field p-col-12 p-md-6">
                  <label htmlFor="last_name">Nachname</label>
                  <InputText
                     id="last_name"
                     value={draft.lastName || ''}
                     onChange={(e) => handleFieldChange('lastName', e.target.value)}
                  />
               </div>
               <div className="p-field p-col-12 p-md-6">
                  <label htmlFor="email">E-Mail</label>
                  <InputText
                     id="email"
                     value={draft.email || ''}
                     onChange={(e) => handleFieldChange('email', e.target.value)}
                  />
               </div>
               <div className="p-field p-col-12 p-md-6">
                  <label htmlFor="phone">Telefon</label>
                  <InputText
                     id="phone"
                     value={draft.phone || ''}
                     onChange={(e) => handleFieldChange('phone', e.target.value)}
                  />
               </div>

               {/* Rolle & Status */}
               <div className="p-field p-col-12 p-md-6">
                  <label>Rolle</label>
                  <Dropdown
                     value={draft.role}
                     options={[
                        { label: 'Kunde', value: 'customer' },
                        { label: 'Admin', value: 'admin' },
                     ]}
                     onChange={(e) => handleFieldChange('role', e.value)}
                     style={{ width: '100%' }}
                  />
               </div>
               <div className="p-field p-col-12 p-md-6">
                  <label>Status</label>
                  <Dropdown
                     value={draft.accountStatus}
                     options={[
                        { label: 'Aktiv', value: 'active' },
                        { label: 'Gesperrt', value: 'suspended' },
                        { label: 'Gelöscht', value: 'deleted' },
                     ]}
                     onChange={(e) => handleFieldChange('accountStatus', e.value)}
                     style={{ width: '100%' }}
                  />
               </div>

               {/* Adresse */}
               <div className="p-field p-col-12 p-md-8">
                  <label htmlFor="street">Straße</label>
                  <InputText
                     id="street"
                     value={draft.street || ''}
                     onChange={(e) => handleFieldChange('street', e.target.value)}
                  />
               </div>
               <div className="p-field p-col-12 p-md-4">
                  <label htmlFor="house_number">Hausnr.</label>
                  <InputText
                     id="house_number"
                     value={draft.houseNumber || ''}
                     onChange={(e) => handleFieldChange('houseNumber', e.target.value)}
                  />
               </div>
               <div className="p-field p-col-12 p-md-4">
                  <label htmlFor="postal_code">PLZ</label>
                  <InputText
                     id="postal_code"
                     value={draft.postalCode || ''}
                     onChange={(e) => handleFieldChange('postalCode', e.target.value)}
                  />
               </div>
               <div className="p-field p-col-12 p-md-4">
                  <label htmlFor="city">Stadt</label>
                  <InputText
                     id="city"
                     value={draft.city || ''}
                     onChange={(e) => handleFieldChange('city', e.target.value)}
                  />
               </div>
               <div className="p-field p-col-12 p-md-4">
                  <label htmlFor="country">Land</label>
                  <InputText
                     id="country"
                     value={draft.country || ''}
                     onChange={(e) => handleFieldChange('country', e.target.value)}
                  />
               </div>

               {/* Lieferadresse */}
               <div className="p-field p-col-12 p-md-8">
                  <label htmlFor="shippingStreet">Lieferstraße</label>
                  <InputText
                     id="shippingStreet"
                     value={draft.shippingStreet || ''}
                     onChange={(e) => handleFieldChange('shippingStreet', e.target.value)}
                  />
               </div>
               <div className="p-field p-col-12 p-md-4">
                  <label htmlFor="shippingHouseNumber">Liefer-Hausnr.</label>
                  <InputText
                     id="shippingHouseNumber"
                     value={draft.shippingHouseNumber || ''}
                     onChange={(e) => handleFieldChange('shippingHouseNumber', e.target.value)}
                  />
               </div>
               <div className="p-field p-col-12 p-md-4">
                  <label htmlFor="shippingPostalCode">Liefer-PLZ</label>
                  <InputText
                     id="shippingPostalCode"
                     value={draft.shippingPostalCode || ''}
                     onChange={(e) => handleFieldChange('shippingPostalCode', e.target.value)}
                  />
               </div>
               <div className="p-field p-col-12 p-md-4">
                  <label htmlFor="shippingCity">Lieferstadt</label>
                  <InputText
                     id="shippingCity"
                     value={draft.shippingCity || ''}
                     onChange={(e) => handleFieldChange('shippingCity', e.target.value)}
                  />
               </div>
               <div className="p-field p-col-12 p-md-4">
                  <label htmlFor="shippingCountry">Lieferland</label>
                  <InputText
                     id="shippingCountry"
                     value={draft.shippingCountry || ''}
                     onChange={(e) => handleFieldChange('shippingCountry', e.target.value)}
                  />
               </div>

               {/* Zahlung / Newsletter / Sonstiges */}
               <div className="p-field p-col-12 p-md-6">
                  <label htmlFor="preferred_payment">Bevorzugte Zahlung</label>
                  <InputText
                     id="preferred_payment"
                     value={draft.preferredPayment || ''}
                     onChange={(e) => handleFieldChange('preferredPayment', e.target.value)}
                  />
               </div>
               <div className="p-field-checkbox p-col-12 p-md-6 user-edit-dialog__newsletter">
                  <Checkbox
                     inputId="newsletter"
                     checked={!!draft.newsletterOptIn}
                     onChange={(e) => handleFieldChange('newsletterOptIn', e.checked)}
                  />
                  <label htmlFor="newsletter">Newsletter erhalten</label>
               </div>

               <div className="p-field p-col-12 p-md-4">
                  <label htmlFor="dateOfBirth">Geburtsdatum</label>
                  <InputText
                     id="dateOfBirth"
                     placeholder="YYYY-MM-DD"
                     value={draft.dateOfBirth || ''}
                     onChange={(e) => handleFieldChange('dateOfBirth', e.target.value)}
                  />
               </div>
               <div className="p-field p-col-12 p-md-4">
                  <label htmlFor="gender">Geschlecht</label>
                  <InputText
                     id="gender"
                     value={draft.gender || ''}
                     onChange={(e) => handleFieldChange('gender', e.target.value)}
                  />
               </div>
               <div className="p-field p-col-12 p-md-4">
                  <label htmlFor="loyaltyPoints">Treuepunkte</label>
                  <InputNumber
                     id="loyaltyPoints"
                     value={draft.loyaltyPoints ?? 0}
                     onValueChange={(e) => handleFieldChange('loyaltyPoints', e.value ?? 0)}
                  />
               </div>
            </div>
         )}
      </Dialog>
   );
};

export default UserEditDialog;
