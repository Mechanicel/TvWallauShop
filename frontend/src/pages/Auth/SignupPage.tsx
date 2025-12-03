import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../store';
import { signup } from '../../store/slices/authSlice';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Checkbox } from 'primereact/checkbox';

import './SignupPage.css';

export const SignupPage: React.FC = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    // Basis
    const [firstName, setFirstName] = useState('');
    const [lastName,  setLastName]  = useState('');
    const [email,     setEmail]     = useState('');
    const [phone,     setPhone]     = useState('');
    const [password,  setPassword]  = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Rechnungsadresse (Pflicht)
    const [street, setStreet] = useState('');
    const [houseNumber, setHouseNumber] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('');
    const [state, setState] = useState('');

    // Lieferadresse (optional)
    const [shippingStreet, setShippingStreet] = useState('');
    const [shippingHouseNumber, setShippingHouseNumber] = useState('');
    const [shippingPostalCode, setShippingPostalCode] = useState('');
    const [shippingCity, setShippingCity] = useState('');
    const [shippingCountry, setShippingCountry] = useState('');
    const [shippingState, setShippingState] = useState('');

    // Payment / Misc
    const [preferredPayment, setPreferredPayment] = useState('');
    const [newsletterOptIn, setNewsletterOptIn] = useState(false);
    const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
    const [gender, setGender] = useState('');

    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState<string | null>(null);

    // Pflichtfelder prüfen
    const isFormValid = () => {
        return (
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
            preferredPayment.trim()
        );
    };

    const handleSignup = async () => {
        if (password !== confirmPassword) {
            setError('Passwörter stimmen nicht überein');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await dispatch(signup({
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
                preferredPayment,
                newsletterOptIn,
                dateOfBirth,
                gender
            })).unwrap();
            navigate('/auth/login');
        } catch (err: any) {
            setError(err || 'Fehler bei der Registrierung');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signup-page">
            <div className="signup-card">
                <h2>Registrieren</h2>

                {/* Basis */}
                <div className="p-field">
                    <label>Vorname <span className="required">*</span></label>
                    <InputText value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div className="p-field">
                    <label>Nachname <span className="required">*</span></label>
                    <InputText value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
                <div className="p-field">
                    <label>E-Mail <span className="required">*</span></label>
                    <InputText value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="p-field">
                    <label>Telefon</label>
                    <InputText value={phone} onChange={e => setPhone(e.target.value)} />
                </div>

                {/* Rechnungsadresse */}
                <h4>Rechnungsadresse</h4>
                <div className="signup-grid">
                    <div className="p-field">
                        <label>Straße <span className="required">*</span></label>
                        <InputText value={street} onChange={e => setStreet(e.target.value)} />
                    </div>
                    <div className="p-field">
                        <label>Hausnummer <span className="required">*</span></label>
                        <InputText value={houseNumber} onChange={e => setHouseNumber(e.target.value)} />
                    </div>
                    <div className="p-field">
                        <label>PLZ <span className="required">*</span></label>
                        <InputText value={postalCode} onChange={e => setPostalCode(e.target.value)} />
                    </div>
                    <div className="p-field">
                        <label>Stadt <span className="required">*</span></label>
                        <InputText value={city} onChange={e => setCity(e.target.value)} />
                    </div>
                    <div className="p-field">
                        <label>Land <span className="required">*</span></label>
                        <InputText value={country} onChange={e => setCountry(e.target.value)} />
                    </div>
                    <div className="p-field">
                        <label>Bundesland</label>
                        <InputText value={state} onChange={e => setState(e.target.value)} />
                    </div>
                </div>

                {/* Lieferadresse */}
                <h4>Lieferadresse (optional)</h4>
                <div className="signup-grid">
                    <div className="p-field">
                        <label>Straße</label>
                        <InputText value={shippingStreet} onChange={e => setShippingStreet(e.target.value)} />
                    </div>
                    <div className="p-field">
                        <label>Hausnummer</label>
                        <InputText value={shippingHouseNumber} onChange={e => setShippingHouseNumber(e.target.value)} />
                    </div>
                    <div className="p-field">
                        <label>PLZ</label>
                        <InputText value={shippingPostalCode} onChange={e => setShippingPostalCode(e.target.value)} />
                    </div>
                    <div className="p-field">
                        <label>Stadt</label>
                        <InputText value={shippingCity} onChange={e => setShippingCity(e.target.value)} />
                    </div>
                    <div className="p-field">
                        <label>Land</label>
                        <InputText value={shippingCountry} onChange={e => setShippingCountry(e.target.value)} />
                    </div>
                    <div className="p-field">
                        <label>Bundesland</label>
                        <InputText value={shippingState} onChange={e => setShippingState(e.target.value)} />
                    </div>
                </div>

                {/* Weitere Angaben */}
                <h4>Weitere Angaben</h4>
                <div className="p-field">
                    <label>Bevorzugte Zahlung<span className="required">*</span></label>
                    <Dropdown value={preferredPayment} onChange={e => setPreferredPayment(e.value)} options={['invoice','paypal','creditcard','banktransfer']} placeholder="Auswählen" />
                </div>
                <div className="p-field-checkbox">
                    <Checkbox inputId="newsletter" checked={newsletterOptIn} onChange={e => setNewsletterOptIn(e.checked!)} />
                    <label htmlFor="newsletter">Newsletter abonnieren</label>
                </div>
                <div className="p-field">
                    <label>Geburtsdatum</label>
                    <Calendar value={dateOfBirth} onChange={e => setDateOfBirth(e.value as Date)} showIcon dateFormat="dd.mm.yy" />
                </div>
                <div className="p-field">
                    <label>Geschlecht</label>
                    <Dropdown value={gender} onChange={e => setGender(e.value)} options={['male', 'female', 'other']} placeholder="Auswählen" />
                </div>

                {/* Passwort */}
                <div className="p-field">
                    <label>Passwort <span className="required">*</span></label>
                    <Password value={password} onChange={e => setPassword(e.target.value)} feedback={false} />
                </div>
                <div className="p-field">
                    <label>Passwort bestätigen <span className="required">*</span></label>
                    <Password value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} feedback={false} />
                </div>

                {error && <p className="p-text-danger">{error}</p>}
                <Button
                    label="Registrieren"
                    icon="pi pi-user-plus"
                    className="p-mt-2"
                    onClick={handleSignup}
                    loading={loading}
                    disabled={!isFormValid()}
                />
            </div>
        </div>
    );
};
