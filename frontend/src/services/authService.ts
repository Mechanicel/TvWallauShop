// frontend/src/services/authService.ts

import api from './api';
import type { AuthResponse, LoginCredentials, RefreshResponse, SignupPayload } from '@tvwallaushop/contracts';

/**
 * AuthService kümmert sich nur um die Kommunikation mit dem Backend.
 * Tokens werden nicht mehr geloggt und der Refresh-Token wird nicht mehr im Frontend verwendet.
 */
const authService = {
   /**
    * Login mit E-Mail & Passwort.
    * Erwartet vom Backend: { accessToken, user } im Body
    * plus Setzen des httpOnly-Refresh-Cookies.
    */
   async login(credentials: LoginCredentials): Promise<AuthResponse> {
      // Wichtig: kein Logging von Passwort!
      // console.log('[authService.login] email:', credentials.email);

      const response = await api.post<AuthResponse>('/auth/login', credentials, {
         withCredentials: true, // schickt Cookies (z.B. refreshToken) mit
      });

      return response.data;
   },

   /**
    * Signup mit den kompletten Registrierungsdaten.
    * Hier erwarten wir bisher kein direktes Login danach, sondern nur eine Bestätigung.
    * (Wenn dein Backend später auch accessToken zurückgibt, kannst du AuthResponse als Rückgabewert verwenden.)
    */
   async signup(payload: SignupPayload): Promise<void> {
      await api.post('/auth/signup', payload, {
         withCredentials: true,
      });
   },

   /**
    * Holt mit Hilfe des httpOnly-Refresh-Cookies einen neuen Access-Token.
    * Der Refresh-Token wird NICHT im Body gesendet.
    */
   async refresh(): Promise<RefreshResponse> {
      const response = await api.post<RefreshResponse>('/auth/refresh', undefined, {
         withCredentials: true,
      });
      return response.data;
   },

   /**
    * Logout: invalidiert den Refresh-Token auf dem Server und löscht die Auth-Cookies.
    */
   async logout(): Promise<void> {
      await api.post('/auth/logout', undefined, {
         withCredentials: true,
      });
   },
};

export default authService;
