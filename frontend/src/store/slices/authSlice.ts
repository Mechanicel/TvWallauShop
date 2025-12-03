// frontend/src/store/slices/authSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../services/api';
import type { RootState } from '../index';
import authService from '../../services/authService';
import { User } from "../../type/user";

// Payload jetzt erweitert, passend zum Backend
interface SignupPayload {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
    // Billing (Pflicht)
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
    country: string;
    state?: string | null;
    // Shipping (optional)
    shippingStreet?: string | null;
    shippingHouseNumber?: string | null;
    shippingPostalCode?: string | null;
    shippingCity?: string | null;
    shippingState?: string | null;
    shippingCountry?: string | null;
    // Payment / Marketing / Misc
    preferredPayment?: string | null;
    newsletterOptIn?: boolean;
    dateOfBirth?: Date | null;
    gender?: string | null;
}

interface AuthState {
    accessToken: string | null;
    user: User | null;
    loading: boolean;
    error: string | null;
}

const initialAccessToken = localStorage.getItem('accessToken');
const initialUser = localStorage.getItem('user');

const initialState: AuthState = {
    accessToken: initialAccessToken,
    user: initialUser ? JSON.parse(initialUser) : null,
    loading: false,
    error: null
};

// Thunk: Signup
export const signup = createAsyncThunk<
    { accessToken: string; user: User },
    SignupPayload,
    { rejectValue: string }
>(
    'auth/signup',
    async (credentials, thunkAPI) => {
        try {
            // Date-Objekt in ISO-String konvertieren, wenn nötig
            const payload = {
                ...credentials,
                dateOfBirth: credentials.dateOfBirth
                    ? new Date(credentials.dateOfBirth).toISOString().split('T')[0] // yyyy-mm-dd
                    : null
            };

            const response = await api.post<{ accessToken: string; user: User }>(
                '/auth/signup',
                payload
            );
            return response.data;
        } catch (err: any) {
            return thunkAPI.rejectWithValue(
                err.response?.data?.message || 'Signup fehlgeschlagen'
            );
        }
    }
);


// === Deine Cookie-Utils & login/logout bleiben unverändert ===
// (ich lasse die bestehenden Funktionen wie in deiner Datei)

type SameSiteOpt = 'Lax' | 'Strict' | 'None';

function setCookie(name: string, value: string, opts?: {
    maxAgeSeconds?: number;
    path?: string;
    sameSite?: SameSiteOpt;
    secure?: boolean;
}) {
    let str = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    if (typeof opts?.maxAgeSeconds === 'number')
        str += `; Max-Age=${Math.max(0, Math.floor(opts.maxAgeSeconds))}`;
    str += `; Path=${opts?.path ?? '/'}`;
    str += `; SameSite=${opts?.sameSite ?? 'Lax'}`;
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    if ((opts?.secure ?? isHttps)) str += `; Secure`;
    document.cookie = str;
}

export function clearCookie(name: string, path: string = '/') {
    document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=${path}`;
}

function jwtSecondsUntilExp(token: string): number | undefined {
    try {
        const [, payloadB64] = token.split('.');
        if (!payloadB64) return undefined;
        const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
        const json = atob(b64);
        const payload = JSON.parse(json);
        if (typeof payload?.exp !== 'number') return undefined;
        const now = Math.floor(Date.now() / 1000);
        return Math.max(0, payload.exp - now);
    } catch {
        return undefined;
    }
}

function deleteCookieEverywhere(name: string) {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const paths = ['/', '/auth', '/api', window.location.pathname];
    for (const p of paths) {
        document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=${p}; SameSite=Lax${isHttps ? '; Secure' : ''}`;
    }
}

function setAuthCookies(accessToken: string, refreshToken: string) {
    deleteCookieEverywhere('accessToken');
    deleteCookieEverywhere('refreshToken');

    const accessAge = jwtSecondsUntilExp(accessToken);
    const refreshAge = jwtSecondsUntilExp(refreshToken);
    setCookie('accessToken', accessToken, { maxAgeSeconds: accessAge, sameSite: 'Lax' });
    setCookie('refreshToken', refreshToken, { maxAgeSeconds: refreshAge, sameSite: 'Lax' });
}

// Dein bestehender login/logout + Slice bleiben, keine Änderungen außer SignupPayload

export const login = createAsyncThunk<
    { accessToken: string; user: User },
    { email: string; password: string },
    { rejectValue: string }
>(
    'auth/login',
    async (credentials, thunkAPI) => {
        try {
            const response = await api.post<{
                accessToken: string;
                refreshToken: string;
                user: User;
            }>('/auth/login', credentials);

            const { accessToken, refreshToken, user } = response.data;
            setAuthCookies(accessToken, refreshToken);
            return { accessToken, user };
        } catch (err: any) {
            return thunkAPI.rejectWithValue(
                err?.response?.data?.message || 'Login fehlgeschlagen'
            );
        }
    }
);

export const logout = createAsyncThunk<void, void, { state: RootState }>(
    'auth/logout',
    async (_, { dispatch }) => {
        console.log('[auth/logout thunk] gestartet');
        try {
            await authService.logout();
            console.log('[auth/logout thunk] api.logout erfolgreich');
        } catch (err) {
            console.error('[auth/logout thunk] api.logout Fehler', err);
        } finally {
            dispatch(clearAuth());
            console.log('[auth/logout thunk] clearAuth dispatched');
        }
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setAccessToken(state, action: PayloadAction<string>) {
            state.accessToken = action.payload;
            localStorage.setItem('accessToken', action.payload);
        },
        clearAuth(state) {
            state.accessToken = null;
            state.user = null;
            state.error = null;
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
        }
    },
    extraReducers: builder => {
        builder
            // Signup
            .addCase(signup.pending, state => {
                state.loading = true;
                state.error = null;
            })
            .addCase(
                signup.fulfilled,
                (state, action: PayloadAction<{ accessToken: string; user: User }>) => {
                    state.loading = false;
                    state.accessToken = action.payload.accessToken;
                    state.user = action.payload.user;
                    localStorage.setItem('accessToken', action.payload.accessToken);
                    localStorage.setItem('user', JSON.stringify(action.payload.user));
                }
            )
            .addCase(signup.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? 'Signup fehlgeschlagen';
            })

            // Login
            .addCase(login.pending, state => {
                state.loading = true;
                state.error = null;
            })
            .addCase(
                login.fulfilled,
                (state, action: PayloadAction<{ accessToken: string; user: User }>) => {
                    state.loading = false;
                    state.accessToken = action.payload.accessToken;
                    state.user = action.payload.user;
                    localStorage.setItem('accessToken', action.payload.accessToken);
                    localStorage.setItem('user', JSON.stringify(action.payload.user));
                }
            )
            .addCase(login.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? 'Login fehlgeschlagen';
            })
            // Logout
            .addCase(logout.fulfilled, state => {
                state.accessToken = null;
                state.user = null;
                localStorage.removeItem('accessToken');
                localStorage.removeItem('user');
                localStorage.removeItem('refreshToken');
            });
    }
});

export const { setAccessToken, clearAuth } = authSlice.actions;
export const selectAuth = (state: RootState) => state.auth;
export default authSlice.reducer;
