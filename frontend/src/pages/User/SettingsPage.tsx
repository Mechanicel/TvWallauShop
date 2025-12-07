import React, {useState} from 'react';
import api from '../../services/api';
import {Card} from 'primereact/card';
import {Password} from 'primereact/password';
import {Checkbox} from 'primereact/checkbox';
import {Dropdown} from 'primereact/dropdown';
import {Button} from 'primereact/button';
import './SettingsPage.css';
import { logout} from "../../store/slices/authSlice";
import {useAppDispatch} from "../../store";


export const SettingsPage: React.FC = () => {
    const dispatch = useAppDispatch();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newsletter, setNewsletter] = useState(false);
    const [preferredPayment, setPreferredPayment] = useState<string | null>(null);

    const paymentOptions = [
        {label: 'PayPal', value: 'paypal'},
        {label: 'Rechnung', value: 'invoice'},
        {label: 'Kreditkarte', value: 'creditcard'},
        {label: 'Überweißung', value: 'banktransfer'},
    ];

    const handlePasswordChange = async () => {
        if (newPassword !== confirmPassword) {
            alert('Die Passwörter stimmen nicht überein!');
            return;
        }
        try {
            await api.put('/users/me/password', {oldPassword, newPassword});
            alert('Passwort erfolgreich geändert.');
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Fehler beim Ändern des Passworts');
        }
    };

    const handlePreferencesSave = async () => {
        try {
            await api.put('/users/me/preferences', {
                newsletterOptIn: newsletter,
                preferredPayment,
            });
            alert('Einstellungen gespeichert.');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Fehler beim Speichern der Einstellungen');
        }
    };

    const handleDeleteAccount = async () => {
        await api.delete('/users/me');

        // Redux reset
        dispatch(logout());

        alert('Account gelöscht.');
        window.location.href = '/login';
    };

    return (
        <div className="settings-page">
            <Card className="settings-card">
                <h2>Einstellungen</h2>

                <section className="settings-section">
                    <h3>Passwort ändern</h3>
                    <div className="settings-field">
                        <label>Altes Passwort</label>
                        <Password value={oldPassword} onChange={(e) => setOldPassword(e.target.value)}
                                  feedback={false}/>
                    </div>
                    <div className="settings-field">
                        <label>Neues Passwort</label>
                        <Password value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                                  feedback={false}/>
                    </div>
                    <div className="settings-field">
                        <label>Neues Passwort bestätigen</label>
                        <Password value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                  feedback={false}/>
                    </div>
                    <Button label="Passwort speichern" icon="pi pi-lock" onClick={handlePasswordChange}
                            className="settings-btn"/>
                </section>

                <section className="settings-section">
                    <h3>Präferenzen</h3>
                    <div className="settings-field">
                        <Checkbox inputId="newsletter" checked={newsletter}
                                  onChange={(e) => setNewsletter(e.checked!)}/>
                        <label htmlFor="newsletter">Newsletter abonnieren</label>
                    </div>
                    <div className="settings-field">
                        <label>Bevorzugte Zahlungsmethode</label>
                        <Dropdown
                            value={preferredPayment}
                            options={paymentOptions}
                            onChange={(e) => setPreferredPayment(e.value)}
                            placeholder="Bitte auswählen"
                        />
                    </div>
                    <Button label="Präferenzen speichern" icon="pi pi-save" onClick={handlePreferencesSave}
                            className="settings-btn"/>
                </section>

                <section className="settings-section danger">
                    <h3>Account</h3>
                    <Button
                        label="Account löschen"
                        icon="pi pi-trash"
                        className="p-button-danger settings-btn"
                        onClick={handleDeleteAccount}
                    />
                </section>
            </Card>
        </div>
    );
};
