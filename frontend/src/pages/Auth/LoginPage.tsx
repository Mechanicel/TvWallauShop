import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store';
import { login } from '../../store/slices/authSlice';
import { selectAuth } from '../../store/slices/authSlice';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Button } from 'primereact/button';
import { ROUTES } from '../../utils/constants';

export const LoginPage: React.FC = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { user } = useAppSelector(selectAuth);

    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState<string | null>(null);

    const handleLogin = async () => {
        setLoading(true);
        setError(null);

        try {
            const resultAction = await dispatch(login({ email, password }));
            if (login.fulfilled.match(resultAction)) {
                const loggedInUser = resultAction.payload.user;
                if (loggedInUser.role === 'admin') {
                    navigate(ROUTES.ADMIN_DASHBOARD);
                } else {
                    navigate(ROUTES.HOME);
                }
            } else {
                const msg = resultAction.payload as string;
                setError(msg || 'Login fehlgeschlagen');
            }
        } catch (err: any) {
            setError(err.message || 'Unerwarteter Fehler');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-d-flex p-jc-center p-ai-center" style={{ height: '100vh' }}>
            <div className="p-card p-p-4" style={{ width: '20rem' }}>
                <h2 className="p-text-center">Anmelden</h2>
                <div className="p-field">
                    <label htmlFor="email">E-Mail</label>
                    <InputText
                        id="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="admin@verein.de"
                    />
                </div>
                <div className="p-field">
                    <label htmlFor="password">Passwort</label>
                    <Password
                        id="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        feedback={false}
                    />
                </div>
                {error && <p className="p-text-danger">{error}</p>}
                <Button
                    label="Login"
                    icon="pi pi-sign-in"
                    className="p-mt-2"
                    onClick={handleLogin}
                    loading={loading}
                    disabled={loading}
                />

                {/* Link zur Registrieren-Seite */}
                <p className="p-text-center p-mt-3">
                    Noch keinen Account?{' '}
                    <Link to={ROUTES.SIGNUP}>Jetzt registrieren</Link>
                </p>
            </div>
        </div>
    );
};
