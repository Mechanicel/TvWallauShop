// frontend/src/services/authService.ts

import api from './api';

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface SignupCredentials {
    firstName: string;
    lastName:  string;
    email:     string;
    password:  string;
    phone?:    string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
}

export interface SignupResponse {
    accessToken: string;
    user: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        role: 'customer' | 'admin';
        phone?: string;
    };
}

const authService = {
    /**
     * Meldet einen Benutzer an und liefert Access- & Refresh-Token.
     */
    login: async (
        credentials: LoginCredentials
    ): Promise<AuthResponse> => {
        console.log('[authService.login] aufruf mit:', credentials);
        const response = await api.post<AuthResponse>(
            '/auth/login',
            credentials
        );

        console.log('[authService.login] Antwort:', response.data);
        return response.data;
    },

    /**
     * Registriert einen neuen Benutzer.
     */
    signup: async (
        credentials: SignupCredentials
    ): Promise<SignupResponse> => {
        const response = await api.post<SignupResponse>('/auth/signup', credentials);
        return response.data;
    },

    /**
     * Tauscht ein gültiges Refresh-Token gegen neue Tokens.
     */
    refresh: async (
        refreshToken: string
    ): Promise<AuthResponse> => {
        console.log('[authService.refresh] aufruf mit Token:', refreshToken);
        const response = await api.post<AuthResponse>(
            '/auth/refresh',
            { refreshToken }
        );
        console.log('[authService.refresh] neue Tokens:', response.data);
        return response.data;
    },

    /**
     * Invalidiert das übergebene Refresh-Token (Logout).
     */
    logout: async (): Promise<void> => {
        console.log('[authService.logout] Aufruf');
        try {
            await api.post('/auth/logout');

            // Lokale Cookies manuell löschen (falls Browser sie noch hält)
            document.cookie = "accessToken=; Max-Age=0; Path=/; SameSite=Lax";
            document.cookie = "refreshToken=; Max-Age=0; Path=/; SameSite=Lax";

            // Falls du den AccessToken im Axios-Header gesetzt hast -> löschen
            delete api.defaults.headers.common['Authorization'];

            console.log('[authService.logout] abgeschlossen');
        } catch (err) {
            console.error('[authService.logout] Fehler:', err);
        }
    }
    ,
};

export default authService;
