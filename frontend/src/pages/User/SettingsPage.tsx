import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '@/services/api';
import { Button } from 'primereact/button';
import { Password } from 'primereact/password';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { InputText } from 'primereact/inputtext';
import { useNavigate } from 'react-router-dom';
import './SettingsPage.css';
import { logout } from '@/store/slices/authSlice';
import { useAppDispatch, useAppSelector } from '@/store';

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
   const toast = useRef<Toast>(null);

   // Wir lesen Prefs (wenn vorhanden) aus auth.user, damit initial nichts "überschrieben" wird
   const authUser = useAppSelector((s: any) => s?.auth?.user);

   const [oldPassword, setOldPassword] = useState('');
   const [newPassword, setNewPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');

   const [newsletter, setNewsletter] = useState(false);
   const [preferredPayment, setPreferredPayment] = useState<PaymentValue | null>(null);

   const [savingPassword, setSavingPassword] = useState(false);
   const [savingPrefs, setSavingPrefs] = useState(false);
   const [deleting, setDeleting] = useState(false);

   const [deleteConfirmText, setDeleteConfirmText] = useState('');

   useEffect(() => {
      // Initialwerte aus Store setzen (falls user schon geladen)
      if (authUser) {
         setNewsletter(!!authUser.newsletterOptIn);
         setPreferredPayment((authUser.preferredPayment as PaymentValue) ?? null);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [authUser?.id]); // nur wenn user wechselt

   const passwordValid = useMemo(() => {
      if (!oldPassword || !newPassword || !confirmPassword) return false;
      if (newPassword.length < 8) return false;
      if (newPassword !== confirmPassword) return false;
      return true;
   }, [oldPassword, newPassword, confirmPassword]);

   const show = (severity: 'success' | 'info' | 'warn' | 'error', summary: string, detail: string) => {
      toast.current?.show({ severity, summary, detail, life: 3200 });
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
         show('error', 'Fehler', err?.response?.data?.error || 'Fehler beim Ändern des Passworts');
      } finally {
         setSavingPassword(false);
      }
   };

   const handlePreferencesSave = async () => {
      setSavingPrefs(true);
      try {
         await api.put('/users/me/preferences', {
            newsletterOptIn: newsletter,
            preferredPayment,
         });

         show('success', 'Gespeichert', 'Einstellungen gespeichert.');
      } catch (err: any) {
         show('error', 'Fehler', err?.response?.data?.error || 'Fehler beim Speichern der Einstellungen');
      } finally {
         setSavingPrefs(false);
      }
   };

   const handleDeleteAccount = () => {
      setDeleteConfirmText('');

      confirmDialog({
         header: 'Account löschen?',
         message: (
            <div className="settings-confirm">
               <p className="settings-confirm-text">
                  Das löscht deinen Account dauerhaft. Dieser Schritt kann nicht rückgängig gemacht werden.
               </p>
               <p className="settings-confirm-text">
                  Tippe <strong>LÖSCHEN</strong>, um zu bestätigen.
               </p>
               <InputText
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="LÖSCHEN"
                  className="settings-confirm-input"
               />
            </div>
         ),
         icon: 'pi pi-exclamation-triangle',
         acceptLabel: 'Account löschen',
         rejectLabel: 'Abbrechen',
         acceptClassName: 'p-button-danger',
         accept: async () => {
            // ConfirmDialog "message" rendert React – aber state update ist async.
            // Deshalb: nochmal im nächsten Tick prüfen:
            setDeleting(true);
            try {
               const ok = deleteConfirmText.trim().toUpperCase() === 'LÖSCHEN';
               if (!ok) {
                  show('warn', 'Nicht bestätigt', 'Bitte LÖSCHEN eintippen, um fortzufahren.');
                  return;
               }

               await api.delete('/users/me');

               dispatch(logout());
               show('success', 'Gelöscht', 'Account gelöscht.');
               navigate('/login', { replace: true });
            } catch (err: any) {
               show('error', 'Fehler', err?.response?.data?.error || 'Account konnte nicht gelöscht werden');
            } finally {
               setDeleting(false);
            }
         },
         reject: () => {},
      });
   };

   const anyBusy = savingPassword || savingPrefs || deleting;

   return (
      <div className="settings-page">
         <Toast ref={toast} />
         <ConfirmDialog />

         <div className="settings-card">
            <div className="settings-header">
               <h2>Einstellungen</h2>

               <div className="settings-header-actions">
                  <Button
                     label="Zurück"
                     icon="pi pi-arrow-left"
                     className="p-button-outlined"
                     onClick={() => navigate('/user/account')}
                     disabled={anyBusy}
                  />
               </div>
            </div>

            <section className="settings-section">
               <h4>Passwort ändern</h4>

               <div className="settings-grid">
                  <div className="settings-field">
                     <label>Altes Passwort</label>
                     <Password
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        feedback={false}
                        toggleMask
                        disabled={anyBusy}
                     />
                  </div>

                  <div className="settings-field">
                     <label>Neues Passwort</label>
                     <Password
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        feedback
                        toggleMask
                        disabled={anyBusy}
                     />
                     <small className="settings-hint">Mindestens 8 Zeichen.</small>
                  </div>

                  <div className="settings-field">
                     <label>Neues Passwort bestätigen</label>
                     <Password
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        feedback={false}
                        toggleMask
                        disabled={anyBusy}
                     />
                     {confirmPassword && newPassword !== confirmPassword && (
                        <small className="settings-hint warn">Passwörter stimmen nicht überein.</small>
                     )}
                  </div>
               </div>

               <div className="settings-actions">
                  <Button
                     label="Passwort speichern"
                     icon="pi pi-lock"
                     onClick={handlePasswordChange}
                     disabled={savingPassword || !passwordValid}
                     loading={savingPassword}
                  />
               </div>
            </section>

            <section className="settings-section">
               <h4>Präferenzen</h4>

               <div className="settings-grid">
                  <div className="settings-field settings-checkbox-field">
                     <label>Newsletter</label>
                     <div className="settings-checkbox-row">
                        <Checkbox
                           inputId="newsletter"
                           checked={newsletter}
                           onChange={(e) => setNewsletter(!!e.checked)}
                           disabled={anyBusy}
                        />
                        <label htmlFor="newsletter" className="settings-checkbox-label">
                           Newsletter abonnieren
                        </label>
                     </div>
                  </div>

                  <div className="settings-field">
                     <label>Bevorzugte Zahlungsmethode</label>
                     <Dropdown
                        value={preferredPayment}
                        options={paymentOptions}
                        optionLabel="label"
                        optionValue="value"
                        onChange={(e) => setPreferredPayment(e.value)}
                        placeholder="Bitte auswählen"
                        disabled={anyBusy}
                     />
                  </div>
               </div>

               <div className="settings-actions">
                  <Button
                     label="Einstellungen speichern"
                     icon="pi pi-save"
                     onClick={handlePreferencesSave}
                     disabled={savingPrefs}
                     loading={savingPrefs}
                  />
               </div>
            </section>

            <section className="settings-section danger">
               <h4>Account</h4>

               <div className="settings-actions">
                  <Button
                     label="Account löschen"
                     icon="pi pi-trash"
                     className="p-button-danger"
                     onClick={handleDeleteAccount}
                     disabled={anyBusy}
                  />
               </div>
            </section>
         </div>
      </div>
   );
};
