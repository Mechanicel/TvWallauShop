import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store';
import { selectAuth } from '@/store/slices/authSlice';
import { fetchUser, updateUser } from '@/store/slices/userSlice';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import './ProfilePage.css';

type FormState = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
  state?: string;
  country?: string;
  preferred_payment?: 'invoice' | 'paypal' | 'creditcard' | 'banktransfer';
  newsletter_opt_in?: boolean;
};

export const ProfilePage: React.FC = () => {
  const { user } = useAppSelector(selectAuth);
  const dispatch = useAppDispatch();

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<FormState>({});

  // User ins Formular laden
  useEffect(() => {
    dispatch(fetchUser());
    if (user) {
      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        street: user.street || '',
        house_number: user.house_number || '',
        postal_code: user.postal_code || '',
        city: user.city || '',
        state: user.state || '',
        country: user.country || '',
        preferred_payment: user.preferred_payment || undefined,
        newsletter_opt_in: !!user.newsletter_opt_in,
      });
    }
  }, [user, dispatch]);

  if (!user) return <p>Bitte einloggen.</p>;

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const payload: Partial<FormState> = {
      first_name: form.first_name?.trim(),
      last_name: form.last_name?.trim(),
      phone: form.phone?.trim(),
      street: form.street?.trim(),
      house_number: form.house_number?.trim(),
      postal_code: form.postal_code?.trim(),
      city: form.city?.trim(),
      state: form.state?.trim(),
      country: form.country?.trim(),
      preferred_payment: form.preferred_payment,
      newsletter_opt_in: !!form.newsletter_opt_in,
    };

    await dispatch(updateUser(payload)).unwrap();
    setIsEditing(false);
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <h2>Mein Profil</h2>

        {/* Allgemein */}
        <section>
          <h4>Allgemein</h4>
          <div className="profile-grid">
            <EditableField
              label="Vorname"
              value={form.first_name}
              edit={isEditing}
              onChange={(v) => handleChange('first_name', v)}
            />
            <EditableField
              label="Nachname"
              value={form.last_name}
              edit={isEditing}
              onChange={(v) => handleChange('last_name', v)}
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

        {/* Adresse */}
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
              value={form.house_number}
              edit={isEditing}
              onChange={(v) => handleChange('house_number', v)}
            />
            <EditableField
              label="PLZ"
              value={form.postal_code}
              edit={isEditing}
              onChange={(v) => handleChange('postal_code', v)}
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

        {/* Einstellungen */}
        <section>
          <h4>Einstellungen</h4>
          <div className="profile-grid">
            <EditableField
              label="Bezahlung"
              value={form.preferred_payment}
              edit={isEditing}
              onChange={(v) => handleChange('preferred_payment', v)}
            />
            <div className="p-field">
              <label>Newsletter</label>
              <InputText
                value={form.newsletter_opt_in ? 'Ja' : 'Nein'}
                disabled
              />
            </div>
          </div>
        </section>

        {/* Buttons */}
        <div className="profile-actions">
          {!isEditing ? (
            <Button
              label="Bearbeiten"
              icon="pi pi-pencil"
              onClick={() => setIsEditing(true)}
            />
          ) : (
            <>
              <Button
                label="Abbrechen"
                className="p-button-text"
                onClick={() => setIsEditing(false)}
              />
              <Button
                label="Speichern"
                icon="pi pi-save"
                onClick={handleSave}
              />
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
      <InputText
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : (
      <InputText value={value || ''} disabled />
    )}
  </div>
);
