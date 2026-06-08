// frontend/src/pages/Admin/User/UserEditDialog.tsx

import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useAppDispatch } from '@/store';
import { updateUserById } from '@/store/slices/userSlice';
import type { User } from '@/type/user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface UserEditDialogProps {
   visible: boolean;
   user: User | null;
   onHide: () => void;
}

const UserEditDialog: React.FC<UserEditDialogProps> = ({ visible, user, onHide }) => {
   const dispatch = useAppDispatch();
   const [draft, setDraft] = useState<User | null>(user);

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
            },
         }),
      );

      onHide();
   };

   const field = (label: string, key: keyof User, type = 'text') => (
      <div className="flex flex-col gap-2">
         <Label htmlFor={String(key)}>{label}</Label>
         <Input
            id={String(key)}
            type={type}
            value={(draft?.[key] as string) || ''}
            onChange={(e) => handleFieldChange(key, e.target.value)}
         />
      </div>
   );

   return (
      <Dialog open={visible && !!draft} onOpenChange={(open) => !open && onHide()}>
         <DialogContent className="max-w-3xl">
            <DialogHeader>
               <DialogTitle>{draft ? `User bearbeiten – ${draft.email}` : 'User bearbeiten'}</DialogTitle>
            </DialogHeader>

            {draft && (
               <div className="grid gap-4 sm:grid-cols-2">
                  {field('Vorname', 'firstName')}
                  {field('Nachname', 'lastName')}
                  {field('E-Mail', 'email')}
                  {field('Telefon', 'phone')}

                  <div className="flex flex-col gap-2">
                     <Label>Rolle</Label>
                     <Select value={draft.role} onValueChange={(v) => handleFieldChange('role', v)}>
                        <SelectTrigger>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="customer">Kunde</SelectItem>
                           <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                     <Label>Status</Label>
                     <Select value={draft.accountStatus} onValueChange={(v) => handleFieldChange('accountStatus', v)}>
                        <SelectTrigger>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="active">Aktiv</SelectItem>
                           <SelectItem value="suspended">Gesperrt</SelectItem>
                           <SelectItem value="deleted">Gelöscht</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>

                  {field('Straße', 'street')}
                  {field('Hausnummer', 'houseNumber')}
                  {field('PLZ', 'postalCode')}
                  {field('Stadt', 'city')}
                  {field('Land', 'country')}

                  {field('Lieferstraße', 'shippingStreet')}
                  {field('Liefer-Hausnr.', 'shippingHouseNumber')}
                  {field('Liefer-PLZ', 'shippingPostalCode')}
                  {field('Lieferstadt', 'shippingCity')}
                  {field('Lieferland', 'shippingCountry')}

                  {field('Bevorzugte Zahlung', 'preferredPayment')}
                  {field('Geburtsdatum', 'dateOfBirth')}
                  {field('Geschlecht', 'gender')}

                  <div className="flex flex-col gap-2">
                     <Label htmlFor="loyaltyPoints">Treuepunkte</Label>
                     <Input
                        id="loyaltyPoints"
                        type="number"
                        value={draft.loyaltyPoints ?? 0}
                        onChange={(e) => handleFieldChange('loyaltyPoints', Number(e.target.value))}
                     />
                  </div>

                  <div className="flex items-center gap-2 sm:col-span-2">
                     <Checkbox
                        id="newsletter"
                        checked={!!draft.newsletterOptIn}
                        onCheckedChange={(c) => handleFieldChange('newsletterOptIn', c === true)}
                     />
                     <Label htmlFor="newsletter" className="font-normal text-muted-foreground">
                        Newsletter erhalten
                     </Label>
                  </div>
               </div>
            )}

            <DialogFooter>
               <Button variant="outline" onClick={onHide}>
                  Abbrechen
               </Button>
               <Button onClick={saveUser}>
                  <Save className="h-4 w-4" />
                  Speichern
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
};

export default UserEditDialog;
