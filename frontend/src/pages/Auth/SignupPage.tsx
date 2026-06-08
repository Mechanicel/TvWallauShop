import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAppDispatch } from '@/store';
import { signup } from '@/store/slices/authSlice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type PaymentValue = 'invoice' | 'paypal' | 'creditcard' | 'banktransfer';
type GenderValue = 'male' | 'female' | 'other';

const paymentOptions: Array<{ label: string; value: PaymentValue }> = [
   { label: 'Rechnung', value: 'invoice' },
   { label: 'PayPal', value: 'paypal' },
   { label: 'Kreditkarte', value: 'creditcard' },
   { label: 'Überweisung', value: 'banktransfer' },
];

const genderOptions: Array<{ label: string; value: GenderValue }> = [
   { label: 'Männlich', value: 'male' },
   { label: 'Weiblich', value: 'female' },
   { label: 'Divers', value: 'other' },
];

const Field: React.FC<{
   label: string;
   value: string;
   onChange: (v: string) => void;
   required?: boolean;
   type?: string;
   autoComplete?: string;
}> = ({ label, value, onChange, required, type = 'text', autoComplete }) => (
   <div className="flex flex-col gap-2">
      <Label>
         {label}
         {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} />
   </div>
);

export const SignupPage: React.FC = () => {
   const dispatch = useAppDispatch();
   const navigate = useNavigate();

   const [firstName, setFirstName] = useState('');
   const [lastName, setLastName] = useState('');
   const [email, setEmail] = useState('');
   const [phone, setPhone] = useState('');
   const [password, setPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');

   const [street, setStreet] = useState('');
   const [houseNumber, setHouseNumber] = useState('');
   const [postalCode, setPostalCode] = useState('');
   const [city, setCity] = useState('');
   const [country, setCountry] = useState('');
   const [state, setState] = useState('');

   const [shippingStreet, setShippingStreet] = useState('');
   const [shippingHouseNumber, setShippingHouseNumber] = useState('');
   const [shippingPostalCode, setShippingPostalCode] = useState('');
   const [shippingCity, setShippingCity] = useState('');
   const [shippingCountry, setShippingCountry] = useState('');
   const [shippingState, setShippingState] = useState('');

   const [preferredPayment, setPreferredPayment] = useState<PaymentValue | ''>('');
   const [newsletterOptIn, setNewsletterOptIn] = useState(false);
   const [dateOfBirth, setDateOfBirth] = useState('');
   const [gender, setGender] = useState<GenderValue | ''>('');

   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const isFormValid = () =>
      !!(
         firstName.trim() &&
         lastName.trim() &&
         email.trim() &&
         password.trim() &&
         confirmPassword.trim() &&
         street.trim() &&
         houseNumber.trim() &&
         postalCode.trim() &&
         city.trim() &&
         country.trim() &&
         preferredPayment
      );

   const handleSignup = async () => {
      if (password !== confirmPassword) {
         setError('Passwörter stimmen nicht überein');
         return;
      }
      setLoading(true);
      setError(null);
      try {
         const normalizedDateOfBirth = dateOfBirth ? new Date(dateOfBirth).toISOString() : null;
         await dispatch(
            signup({
               firstName,
               lastName,
               email,
               password,
               phone,
               street,
               houseNumber,
               postalCode,
               city,
               country,
               state,
               shippingStreet,
               shippingHouseNumber,
               shippingPostalCode,
               shippingCity,
               shippingState,
               shippingCountry,
               preferredPayment: preferredPayment || null,
               newsletterOptIn,
               dateOfBirth: normalizedDateOfBirth,
               gender: gender || null,
            }),
         ).unwrap();
         navigate('/auth/login');
      } catch (err: any) {
         setError(err || 'Fehler bei der Registrierung');
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="mx-auto max-w-2xl px-4 py-8">
         <div className="rounded-lg border border-solid border-border bg-surface p-6">
            <h1 className="mb-6 text-2xl font-semibold text-foreground">Registrieren</h1>

            <div className="grid gap-4 sm:grid-cols-2">
               <Field label="Vorname" required value={firstName} onChange={setFirstName} autoComplete="given-name" />
               <Field label="Nachname" required value={lastName} onChange={setLastName} autoComplete="family-name" />
               <Field label="E-Mail" required value={email} onChange={setEmail} type="email" autoComplete="email" />
               <Field label="Telefon" value={phone} onChange={setPhone} autoComplete="tel" />
            </div>

            <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
               Rechnungsadresse
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
               <Field label="Straße" required value={street} onChange={setStreet} />
               <Field label="Hausnummer" required value={houseNumber} onChange={setHouseNumber} />
               <Field label="PLZ" required value={postalCode} onChange={setPostalCode} />
               <Field label="Stadt" required value={city} onChange={setCity} />
               <Field label="Land" required value={country} onChange={setCountry} />
               <Field label="Bundesland" value={state} onChange={setState} />
            </div>

            <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
               Lieferadresse (optional)
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
               <Field label="Straße" value={shippingStreet} onChange={setShippingStreet} />
               <Field label="Hausnummer" value={shippingHouseNumber} onChange={setShippingHouseNumber} />
               <Field label="PLZ" value={shippingPostalCode} onChange={setShippingPostalCode} />
               <Field label="Stadt" value={shippingCity} onChange={setShippingCity} />
               <Field label="Land" value={shippingCountry} onChange={setShippingCountry} />
               <Field label="Bundesland" value={shippingState} onChange={setShippingState} />
            </div>

            <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
               Weitere Angaben
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
               <div className="flex flex-col gap-2">
                  <Label>
                     Bevorzugte Zahlung<span className="text-destructive"> *</span>
                  </Label>
                  <Select value={preferredPayment || undefined} onValueChange={(v) => setPreferredPayment(v as PaymentValue)}>
                     <SelectTrigger>
                        <SelectValue placeholder="Auswählen" />
                     </SelectTrigger>
                     <SelectContent>
                        {paymentOptions.map((o) => (
                           <SelectItem key={o.value} value={o.value}>
                              {o.label}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>

               <div className="flex flex-col gap-2">
                  <Label>Geschlecht</Label>
                  <Select value={gender || undefined} onValueChange={(v) => setGender(v as GenderValue)}>
                     <SelectTrigger>
                        <SelectValue placeholder="Auswählen" />
                     </SelectTrigger>
                     <SelectContent>
                        {genderOptions.map((o) => (
                           <SelectItem key={o.value} value={o.value}>
                              {o.label}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>

               <Field label="Geburtsdatum" value={dateOfBirth} onChange={setDateOfBirth} type="date" />

               <div className="flex flex-col gap-2">
                  <Label>Newsletter</Label>
                  <div className="flex h-10 items-center gap-2">
                     <Checkbox
                        id="newsletter"
                        checked={newsletterOptIn}
                        onCheckedChange={(c) => setNewsletterOptIn(c === true)}
                     />
                     <Label htmlFor="newsletter" className="font-normal text-muted-foreground">
                        Newsletter abonnieren
                     </Label>
                  </div>
               </div>
            </div>

            <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Passwort</h2>
            <div className="grid gap-4 sm:grid-cols-2">
               <Field label="Passwort" required value={password} onChange={setPassword} type="password" autoComplete="new-password" />
               <Field
                  label="Passwort bestätigen"
                  required
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  type="password"
                  autoComplete="new-password"
               />
            </div>

            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

            <Button className="mt-6" onClick={handleSignup} disabled={!isFormValid() || loading}>
               <UserPlus className="h-4 w-4" />
               {loading ? 'Wird registriert …' : 'Registrieren'}
            </Button>
         </div>
      </div>
   );
};
