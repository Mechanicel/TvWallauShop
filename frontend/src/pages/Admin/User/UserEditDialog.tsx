// frontend/src/pages/Admin/UserEditDialog.tsx

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { Checkbox } from 'primereact/checkbox';
import { Button } from 'primereact/button';

import { useAppDispatch } from '../../../store';
import { updateUserById } from '../../../store/slices/userSlice';
import type { User } from '../../../type/user';

export interface UserEditDialogProps {
  visible: boolean;
  user: User | null;
  onHide: () => void;
}

const UserEditDialog: React.FC<UserEditDialogProps> = ({
  visible,
  user,
  onHide,
}) => {
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
      first_name,
      last_name,
      email,
      phone,
      role,
      street,
      house_number,
      postal_code,
      city,
      country,
      shippingStreet,
      shippingHouseNumber,
      shippingPostalCode,
      shippingCity,
      shippingState,
      shippingCountry,
      preferred_payment,
      newsletter_opt_in,
      dateOfBirth,
      gender,
    } = draft;

    await dispatch(
      updateUserById({
        id,
        changes: {
          // Felder für das Backend (snake_case)
          first_name,
          last_name,
          email,
          phone,
          role,
          street,
          house_number,
          postal_code,
          city,
          country,
          shipping_street: shippingStreet,
          shipping_house_number: shippingHouseNumber,
          shipping_postal_code: shippingPostalCode,
          shipping_city: shippingCity,
          shipping_state: shippingState,
          shipping_country: shippingCountry,
          preferred_payment,
          newsletter_opt_in,
          date_of_birth: dateOfBirth,
          gender,
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
      <Button
        label="Abbrechen"
        icon="pi pi-times"
        className="p-button-text"
        onClick={onHide}
      />
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
              value={draft.first_name || ''}
              onChange={(e) => handleFieldChange('first_name', e.target.value)}
            />
          </div>
          <div className="p-field p-col-12 p-md-6">
            <label htmlFor="last_name">Nachname</label>
            <InputText
              id="last_name"
              value={draft.last_name || ''}
              onChange={(e) => handleFieldChange('last_name', e.target.value)}
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
                { label: 'Gesperrt', value: 'blocked' },
                { label: 'Inaktiv', value: 'inactive' },
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
              value={draft.house_number || ''}
              onChange={(e) =>
                handleFieldChange('house_number', e.target.value)
              }
            />
          </div>
          <div className="p-field p-col-12 p-md-4">
            <label htmlFor="postal_code">PLZ</label>
            <InputText
              id="postal_code"
              value={draft.postal_code || ''}
              onChange={(e) => handleFieldChange('postal_code', e.target.value)}
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
              onChange={(e) =>
                handleFieldChange('shippingStreet', e.target.value)
              }
            />
          </div>
          <div className="p-field p-col-12 p-md-4">
            <label htmlFor="shippingHouseNumber">Liefer-Hausnr.</label>
            <InputText
              id="shippingHouseNumber"
              value={draft.shippingHouseNumber || ''}
              onChange={(e) =>
                handleFieldChange('shippingHouseNumber', e.target.value)
              }
            />
          </div>
          <div className="p-field p-col-12 p-md-4">
            <label htmlFor="shippingPostalCode">Liefer-PLZ</label>
            <InputText
              id="shippingPostalCode"
              value={draft.shippingPostalCode || ''}
              onChange={(e) =>
                handleFieldChange('shippingPostalCode', e.target.value)
              }
            />
          </div>
          <div className="p-field p-col-12 p-md-4">
            <label htmlFor="shippingCity">Lieferstadt</label>
            <InputText
              id="shippingCity"
              value={draft.shippingCity || ''}
              onChange={(e) =>
                handleFieldChange('shippingCity', e.target.value)
              }
            />
          </div>
          <div className="p-field p-col-12 p-md-4">
            <label htmlFor="shippingCountry">Lieferland</label>
            <InputText
              id="shippingCountry"
              value={draft.shippingCountry || ''}
              onChange={(e) =>
                handleFieldChange('shippingCountry', e.target.value)
              }
            />
          </div>

          {/* Zahlung / Newsletter / Sonstiges */}
          <div className="p-field p-col-12 p-md-6">
            <label htmlFor="preferred_payment">Bevorzugte Zahlung</label>
            <InputText
              id="preferred_payment"
              value={draft.preferred_payment || ''}
              onChange={(e) =>
                handleFieldChange('preferred_payment', e.target.value)
              }
            />
          </div>
          <div className="p-field-checkbox p-col-12 p-md-6 user-edit-dialog__newsletter">
            <Checkbox
              inputId="newsletter"
              checked={!!draft.newsletter_opt_in}
              onChange={(e) =>
                handleFieldChange('newsletter_opt_in', e.checked)
              }
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
              onValueChange={(e) =>
                handleFieldChange('loyaltyPoints', e.value ?? 0)
              }
            />
          </div>
        </div>
      )}
    </Dialog>
  );
};

export default UserEditDialog;
