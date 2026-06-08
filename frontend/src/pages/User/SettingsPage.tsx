import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { logout } from '@/store/slices/authSlice';
import { useAppDispatch, useAppSelector } from '@/store';
import { getApiErrorMessage } from '@/utils/error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type PaymentValue = 'paypal' | 'invoice' | 'creditcard' | 'banktransfer';

const paymentOptions: Array<{ label: string; value: PaymentValue }> = [
   { label: 'PayPal', value: 'paypal' },
   { label: 'Rechnung', value: 'invoice' },
   { label: 'Kreditkarte', value: 'creditcard' },
   { label: 'Überweisung', value: 'banktransfer' },
];

export const SettingsPage: React.FC = () => {
   const dispatch = useAppDispatch();
   const navigate = useNavigate();

   const authUser = useAppSelector((s: any) => s?.auth?.user);

   const [oldPassword, setOldPassword] = useState('');
   const [newPassword, setNewPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');

   const [newsletter, setNewsletter] = useState(false);
   const [preferredPayment, setPreferredPayment] = useState<PaymentValue | null>(null);

   const [savingPassword, setSavingPassword] = useState(false);
   const [savingPrefs, setSavingPrefs] = useState(false);
   const [deleting, setDeleting] = useState(false);

   const [deleteOpen, setDeleteOpen] = useState(false);
   const [deleteConfirmText, setDeleteConfirmText] = useState('');

   useEffect(() => {
      if (authUser) {
         setNewsletter(!!authUser.newsletterOptIn);
         setPreferredPayment((authUser.preferredPayment as PaymentValue) ?? null);
      }
   }, [authUser?.id]);

   const passwordValid = useMemo(() => {
      if (!oldPassword || !newPassword || !confirmPassword) return false;
      if (newPassword.length < 8) return false;
      if (newPassword !== confirmPassword) return false;
      return true;
   }, [oldPassword, newPassword, confirmPassword]);

   const show = (severity: 'success' | 'info' | 'warn' | 'error', summary: string, detail: string) => {
      const fn =
         severity === 'success'
            ? toast.success
            : severity === 'error'
              ? toast.error
              : severity === 'warn'
                ? toast.warning
                : toast.info;
      fn(summary, { description: detail });
   };

   const handlePasswordChange = async () => {
      if (newPassword !== confirmPassword) {
         show('warn', 'Prüfen', 'Die Passwörter stimmen nicht überein.');
         return;
      }
      if (newPassword.length < 8) {
         show('warn', 'Zu kurz', 'Neues Passwort muss mindestens 8 Zeichen haben.');
         return;
      }

      setSavingPassword(true);
      try {
         await api.put('/users/me/password', { oldPassword, newPassword });
         show('success', 'Gespeichert', 'Passwort erfolgreich geändert.');
         setOldPassword('');
         setNewPassword('');
         setConfirmPassword('');
      } catch (err: any) {
         show('error', 'Fehler', getApiErrorMessage(err, 'Fehler beim Ändern des Passworts'));
      } finally {
         setSavingPassword(false);
      }
   };

   const handlePreferencesSave = async () => {
      setSavingPrefs(true);
      try {
         await api.put('/users/me/preferences', { newsletterOptIn: newsletter, preferredPayment });
         show('success', 'Gespeichert', 'Einstellungen gespeichert.');
      } catch (err: any) {
         show('error', 'Fehler', getApiErrorMessage(err, 'Fehler beim Speichern der Einstellungen'));
      } finally {
         setSavingPrefs(false);
      }
   };

   const handleDeleteAccount = async () => {
      setDeleting(true);
      try {
         await api.delete('/users/me');
         dispatch(logout());
         show('success', 'Gelöscht', 'Account gelöscht.');
         navigate('/login', { replace: true });
      } catch (err: any) {
         show('error', 'Fehler', getApiErrorMessage(err, 'Account konnte nicht gelöscht werden'));
      } finally {
         setDeleting(false);
         setDeleteOpen(false);
      }
   };

   const anyBusy = savingPassword || savingPrefs || deleting;

   return (
      <div className="mx-auto max-w-3xl px-4 py-8">
         <div className="rounded-lg border border-solid border-border bg-surface p-6">
            <div className="mb-6 flex items-center justify-between">
               <h1 className="text-2xl font-semibold text-foreground">Einstellungen</h1>
               <Button variant="outline" onClick={() => navigate('/user/account')} disabled={anyBusy}>
                  <ArrowLeft className="h-4 w-4" />
                  Zurück
               </Button>
            </div>

            {/* Passwort */}
            <section className="mb-8">
               <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Passwort ändern</h2>
               <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-2">
                     <Label htmlFor="oldPassword">Altes Passwort</Label>
                     <Input
                        id="oldPassword"
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        disabled={anyBusy}
                        autoComplete="current-password"
                     />
                  </div>
                  <div className="flex flex-col gap-2">
                     <Label htmlFor="newPassword">Neues Passwort</Label>
                     <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={anyBusy}
                        autoComplete="new-password"
                     />
                     <span className="text-xs text-muted-foreground">Mindestens 8 Zeichen.</span>
                  </div>
                  <div className="flex flex-col gap-2">
                     <Label htmlFor="confirmPassword">Neues Passwort bestätigen</Label>
                     <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={anyBusy}
                        autoComplete="new-password"
                     />
                     {confirmPassword && newPassword !== confirmPassword && (
                        <span className="text-xs text-destructive">Passwörter stimmen nicht überein.</span>
                     )}
                  </div>
               </div>
               <div className="mt-4">
                  <Button onClick={handlePasswordChange} disabled={savingPassword || !passwordValid}>
                     <Lock className="h-4 w-4" />
                     Passwort speichern
                  </Button>
               </div>
            </section>

            {/* Präferenzen */}
            <section className="mb-8">
               <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Präferenzen</h2>
               <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                     <Label>Newsletter</Label>
                     <div className="flex h-10 items-center gap-2">
                        <Checkbox
                           id="newsletter"
                           checked={newsletter}
                           disabled={anyBusy}
                           onCheckedChange={(c) => setNewsletter(c === true)}
                        />
                        <Label htmlFor="newsletter" className="font-normal text-muted-foreground">
                           Newsletter abonnieren
                        </Label>
                     </div>
                  </div>
                  <div className="flex flex-col gap-2">
                     <Label>Bevorzugte Zahlungsmethode</Label>
                     <Select
                        value={preferredPayment ?? undefined}
                        onValueChange={(v) => setPreferredPayment(v as PaymentValue)}
                        disabled={anyBusy}
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
                  </div>
               </div>
               <div className="mt-4">
                  <Button onClick={handlePreferencesSave} disabled={savingPrefs}>
                     <Save className="h-4 w-4" />
                     Einstellungen speichern
                  </Button>
               </div>
            </section>

            {/* Account löschen */}
            <section className="rounded-lg border border-solid border-red-200 p-4">
               <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-destructive">Account</h2>
               <Button
                  className="bg-destructive text-destructive-foreground hover:opacity-90"
                  onClick={() => {
                     setDeleteConfirmText('');
                     setDeleteOpen(true);
                  }}
                  disabled={anyBusy}
               >
                  <Trash2 className="h-4 w-4" />
                  Account löschen
               </Button>
            </section>
         </div>

         <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>Account löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                     Das löscht deinen Account dauerhaft. Dieser Schritt kann nicht rückgängig gemacht werden. Tippe{' '}
                     <strong>LÖSCHEN</strong>, um zu bestätigen.
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="LÖSCHEN"
                  autoFocus
               />
               <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                     className="bg-destructive text-destructive-foreground hover:opacity-90"
                     disabled={deleting || deleteConfirmText.trim().toUpperCase() !== 'LÖSCHEN'}
                     onClick={(e) => {
                        e.preventDefault();
                        handleDeleteAccount();
                     }}
                  >
                     Account löschen
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </div>
   );
};
