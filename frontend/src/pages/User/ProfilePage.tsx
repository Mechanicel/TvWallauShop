import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchUser, updateUser } from '@/store/slices/userSlice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const EditableField: React.FC<{
   label: string;
   value?: string | null;
   edit: boolean;
   onChange?: (value: string) => void;
}> = ({ label, value, edit, onChange }) => (
   <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Input
         value={value || ''}
         disabled={!edit || !onChange}
         onChange={(e) => onChange?.(e.target.value)}
      />
   </div>
);

export const ProfilePage: React.FC = () => {
   const dispatch = useAppDispatch();
   const navigate = useNavigate();

   const userState = useAppSelector((s) => s.user);
   const user = userState.user;
   const loading = userState.loading;

   const [isEditing, setIsEditing] = useState(false);
   const [saving, setSaving] = useState(false);
   const [form, setForm] = useState<FormState>(emptyForm);

   useEffect(() => {
      dispatch(fetchUser());
   }, [dispatch]);

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
         await dispatch(fetchUser()).unwrap();
         toast.success('Gespeichert', { description: 'Deine Änderungen wurden übernommen.' });
         setIsEditing(false);
      } catch (err) {
         console.error('[ProfilePage] save failed:', err);
         toast.error('Fehler', { description: 'Speichern fehlgeschlagen.' });
      } finally {
         setSaving(false);
      }
   };

   if (!user) {
      return (
         <div className="mx-auto max-w-3xl px-4 py-8">
            <div className="rounded-lg border border-solid border-border bg-surface p-6">
               <div className="mb-4 flex items-center justify-between">
                  <h1 className="text-2xl font-semibold text-foreground">Mein Profil</h1>
                  <Button variant="outline" onClick={() => navigate('/account')}>
                     <ArrowLeft className="h-4 w-4" />
                     Zurück
                  </Button>
               </div>
               <p className="text-muted-foreground">{loading ? 'Lade…' : 'Bitte einloggen.'}</p>
            </div>
         </div>
      );
   }

   const preferredPaymentLabel = paymentOptions.find((o) => o.value === form.preferredPayment)?.label || '–';

   return (
      <div className="mx-auto max-w-3xl px-4 py-8">
         <div className="rounded-lg border border-solid border-border bg-surface p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
               <h1 className="text-2xl font-semibold text-foreground">Mein Profil</h1>
               <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => dispatch(fetchUser())} disabled={saving}>
                     <RefreshCw className="h-4 w-4" />
                     Aktualisieren
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/user/account')} disabled={saving}>
                     <ArrowLeft className="h-4 w-4" />
                     Zurück
                  </Button>
               </div>
            </div>

            <section className="mb-6">
               <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Allgemein</h2>
               <div className="grid gap-4 sm:grid-cols-2">
                  <EditableField label="Vorname" value={form.firstName} edit={isEditing} onChange={(v) => handleChange('firstName', v)} />
                  <EditableField label="Nachname" value={form.lastName} edit={isEditing} onChange={(v) => handleChange('lastName', v)} />
                  <EditableField label="E-Mail" value={form.email} edit={false} />
                  <EditableField label="Telefon" value={form.phone} edit={isEditing} onChange={(v) => handleChange('phone', v)} />
               </div>
            </section>

            <section className="mb-6">
               <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rechnungsadresse</h2>
               <div className="grid gap-4 sm:grid-cols-2">
                  <EditableField label="Straße" value={form.street} edit={isEditing} onChange={(v) => handleChange('street', v)} />
                  <EditableField label="Hausnummer" value={form.houseNumber} edit={isEditing} onChange={(v) => handleChange('houseNumber', v)} />
                  <EditableField label="PLZ" value={form.postalCode} edit={isEditing} onChange={(v) => handleChange('postalCode', v)} />
                  <EditableField label="Stadt" value={form.city} edit={isEditing} onChange={(v) => handleChange('city', v)} />
                  <EditableField label="Bundesland" value={form.state} edit={isEditing} onChange={(v) => handleChange('state', v)} />
                  <EditableField label="Land" value={form.country} edit={isEditing} onChange={(v) => handleChange('country', v)} />
               </div>
            </section>

            <section className="mb-6">
               <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Einstellungen</h2>
               <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                     <Label>Bezahlung</Label>
                     {isEditing ? (
                        <Select
                           value={form.preferredPayment || undefined}
                           onValueChange={(v) => handleChange('preferredPayment', v as PaymentValue)}
                        >
                           <SelectTrigger>
                              <SelectValue placeholder="Bitte auswählen" />
                           </SelectTrigger>
                           <SelectContent>
                              {paymentOptions.map((o) => (
                                 <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     ) : (
                        <Input value={preferredPaymentLabel} disabled />
                     )}
                  </div>

                  <div className="flex flex-col gap-2">
                     <Label>Newsletter</Label>
                     <div className="flex h-10 items-center gap-2">
                        <Checkbox
                           id="newsletter"
                           checked={!!form.newsletterOptIn}
                           disabled={!isEditing}
                           onCheckedChange={(c) => handleChange('newsletterOptIn', c === true)}
                        />
                        <Label htmlFor="newsletter" className="font-normal text-muted-foreground">
                           {form.newsletterOptIn ? 'Abonniert' : 'Nicht abonniert'}
                        </Label>
                     </div>
                  </div>
               </div>
            </section>

            <div className="flex flex-wrap justify-end gap-2">
               {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)} disabled={saving}>
                     <Pencil className="h-4 w-4" />
                     Bearbeiten
                  </Button>
               ) : (
                  <>
                     <Button variant="outline" onClick={handleCancel} disabled={saving}>
                        Abbrechen
                     </Button>
                     <Button onClick={handleSave} disabled={saving || !dirty}>
                        <Save className="h-4 w-4" />
                        Speichern
                     </Button>
                  </>
               )}
            </div>
         </div>
      </div>
   );
};
