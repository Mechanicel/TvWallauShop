import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchUser, updateUser } from '@/store/slices/userSlice';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { Toast } from 'primereact/toast';
import './ProfilePage.css';

type PaymentValue = 'invoice' | 'paypal' | 'creditcard' | 'banktransfer';

type FormState = {
   firstName: string;
   lastName: string;
   email: string;
   phone: string;
   street: string;
   houseNumber: string;
   postalCode: string;
   city: string;
   state: string;
   country: string;
   preferredPayment: PaymentValue | '';
   newsletterOptIn: boolean;
};

const paymentOptions: Array<{ label: string; value: PaymentValue }> = [
   { label: 'Rechnung', value: 'invoice' },
   { label: 'PayPal', value: 'paypal' },
   { label: 'Kreditkarte', value: 'creditcard' },
   { label: 'Überweisung', value: 'banktransfer' },
];

const emptyForm: FormState = {
   firstName: '',
   lastName: '',
   email: '',
   phone: '',
   street: '',
   houseNumber: '',
   postalCode: '',
   city: '',
   state: '',
   country: '',
   preferredPayment: '',
   newsletterOptIn: false,
};

function toForm(user: any): FormState {
   return {
      firstName: user?.firstName ?? user?.first_name ?? '',
      lastName: user?.lastName ?? user?.last_name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      street: user?.street ?? '',
      houseNumber: user?.houseNumber ?? user?.house_number ?? '',
      postalCode: user?.postalCode ?? user?.postal_code ?? '',
      city: user?.city ?? '',
      state: user?.state ?? '',
      country: user?.country ?? '',
      preferredPayment: (user?.preferredPayment as PaymentValue) ?? '',
      newsletterOptIn: !!user?.newsletterOptIn,
   };
}

function isDirty(a: FormState, b: FormState) {
   const keys = Object.keys(a) as (keyof FormState)[];
   for (const k of keys) {
      if (a[k] !== b[k]) return true;
   }
   return false;
}

export const ProfilePage: React.FC = () => {
   const dispatch = useAppDispatch();
   const navigate = useNavigate();
   const toast = useRef<Toast>(null);

   // ✅ Quelle: userSlice (fetchUser/updateUser arbeiten genau darauf)
   const userState = useAppSelector((s) => s.user);
   const user = userState.user;
   const loading = userState.loading;

   const [isEditing, setIsEditing] = useState(false);
   const [saving, setSaving] = useState(false);
   const [form, setForm] = useState<FormState>(emptyForm);

   // ✅ 1) nur EINMAL laden (kein Loop mehr!)
   useEffect(() => {
      dispatch(fetchUser());
   }, [dispatch]);

   // ✅ 2) Form nur dann aus Store nachziehen, wenn NICHT gerade editiert wird
   useEffect(() => {
      if (!user) return;
      if (isEditing) return;
      setForm(toForm(user));
   }, [user, isEditing]);

   const original = useMemo(() => (user ? toForm(user) : emptyForm), [user]);
   const dirty = useMemo(() => isDirty(form, original), [form, original]);

   const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
   };

   const handleCancel = () => {
      if (user) setForm(toForm(user));
      setIsEditing(false);
   };

   const handleSave = async () => {
      if (!user) return;

      const payload = {
         firstName: form.firstName.trim(),
         lastName: form.lastName.trim(),
         phone: form.phone.trim(),
         street: form.street.trim(),
         houseNumber: form.houseNumber.trim(),
         postalCode: form.postalCode.trim(),
         city: form.city.trim(),
         state: form.state.trim(),
         country: form.country.trim(),
         preferredPayment: form.preferredPayment || null,
         newsletterOptIn: !!form.newsletterOptIn,
      };

      setSaving(true);
      try {
         await dispatch(updateUser(payload as any)).unwrap();

         // ✅ Truth refresh (holt sicher den DB-Stand + synchronisiert Store)
         await dispatch(fetchUser()).unwrap();

         toast.current?.show({
            severity: 'success',
            summary: 'Gespeichert',
            detail: 'Deine Änderungen wurden übernommen.',
            life: 2500,
         });

         setIsEditing(false);
      } catch (err) {
         console.error('[ProfilePage] save failed:', err);
         toast.current?.show({
            severity: 'error',
            summary: 'Fehler',
            detail: 'Speichern fehlgeschlagen.',
            life: 3500,
         });
      } finally {
         setSaving(false);
      }
   };

   if (!user) {
      return (
         <div className="profile-page">
            <div className="profile-card">
               <div className="profile-header">
                  <h2>Mein Profil</h2>
                  <div className="profile-header-actions">
                     <Button
                        label="Zurück"
                        icon="pi pi-arrow-left"
                        className="p-button-outlined"
                        onClick={() => navigate('/account')}
                     />
                  </div>
               </div>

               <p className="profile-loading">{loading ? 'Lade...' : 'Bitte einloggen.'}</p>
            </div>
         </div>
      );
   }

   const preferredPaymentLabel = paymentOptions.find((o) => o.value === form.preferredPayment)?.label || '-';

   return (
      <div className="profile-page">
         <Toast ref={toast} />

         <div className="profile-card">
            <div className="profile-header">
               <h2>Mein Profil</h2>

               <div className="profile-header-actions">
                  <Button
                     label="Aktualisieren"
                     icon="pi pi-refresh"
                     className="p-button-outlined"
                     onClick={() => dispatch(fetchUser())}
                     disabled={saving}
                  />
                  <Button
                     label="Zurück"
                     icon="pi pi-arrow-left"
                     className="p-button-outlined"
                     onClick={() => navigate('/user/account')}
                     disabled={saving}
                  />
               </div>
            </div>

            <section>
               <h4>Allgemein</h4>
               <div className="profile-grid">
                  <EditableField
                     label="Vorname"
                     value={form.firstName}
                     edit={isEditing}
                     onChange={(v) => handleChange('firstName', v)}
                  />
                  <EditableField
                     label="Nachname"
                     value={form.lastName}
                     edit={isEditing}
                     onChange={(v) => handleChange('lastName', v)}
                  />
                  <EditableField label="E-Mail" value={form.email} edit={false} />
                  <EditableField
                     label="Telefon"
                     value={form.phone}
                     edit={isEditing}
                     onChange={(v) => handleChange('phone', v)}
                  />
               </div>
            </section>

            <section>
               <h4>Rechnungsadresse</h4>
               <div className="profile-grid">
                  <EditableField
                     label="Straße"
                     value={form.street}
                     edit={isEditing}
                     onChange={(v) => handleChange('street', v)}
                  />
                  <EditableField
                     label="Hausnummer"
                     value={form.houseNumber}
                     edit={isEditing}
                     onChange={(v) => handleChange('houseNumber', v)}
                  />
                  <EditableField
                     label="PLZ"
                     value={form.postalCode}
                     edit={isEditing}
                     onChange={(v) => handleChange('postalCode', v)}
                  />
                  <EditableField
                     label="Stadt"
                     value={form.city}
                     edit={isEditing}
                     onChange={(v) => handleChange('city', v)}
                  />
                  <EditableField
                     label="Bundesland"
                     value={form.state}
                     edit={isEditing}
                     onChange={(v) => handleChange('state', v)}
                  />
                  <EditableField
                     label="Land"
                     value={form.country}
                     edit={isEditing}
                     onChange={(v) => handleChange('country', v)}
                  />
               </div>
            </section>

            <section>
               <h4>Einstellungen</h4>
               <div className="profile-grid">
                  <div className="p-field">
                     <label>Bezahlung</label>

                     {isEditing ? (
                        <Dropdown
                           value={form.preferredPayment || null}
                           options={paymentOptions}
                           optionLabel="label"
                           optionValue="value"
                           placeholder="Bitte auswählen"
                           onChange={(e) => handleChange('preferredPayment', (e.value as PaymentValue) ?? '')}
                           className="profile-dropdown"
                        />
                     ) : (
                        <InputText value={preferredPaymentLabel} disabled />
                     )}
                  </div>

                  <div className="p-field">
                     <label>Newsletter</label>
                     <div className="profile-checkbox-row">
                        <Checkbox
                           inputId="newsletter"
                           checked={!!form.newsletterOptIn}
                           disabled={!isEditing}
                           onChange={(e) => handleChange('newsletterOptIn', !!e.checked)}
                        />
                        <label htmlFor="newsletter" className="profile-checkbox-label">
                           {form.newsletterOptIn ? 'Abonniert' : 'Nicht abonniert'}
                        </label>
                     </div>
                  </div>
               </div>
            </section>

            <div className="profile-actions">
               {!isEditing ? (
                  <Button label="Bearbeiten" icon="pi pi-pencil" onClick={() => setIsEditing(true)} disabled={saving} />
               ) : (
                  <>
                     <Button label="Abbrechen" className="p-button-outlined" onClick={handleCancel} disabled={saving} />
                     <Button label="Speichern" icon="pi pi-save" onClick={handleSave} disabled={saving || !dirty} />
                  </>
               )}
            </div>
         </div>
      </div>
   );
};

const EditableField: React.FC<{
   label: string;
   value?: string | null;
   edit: boolean;
   onChange?: (value: string) => void;
}> = ({ label, value, edit, onChange }) => (
   <div className="p-field">
      <label>{label}</label>
      {edit && onChange ? (
         <InputText value={value || ''} onChange={(e) => onChange(e.target.value)} />
      ) : (
         <InputText value={value || ''} disabled />
      )}
   </div>
);
