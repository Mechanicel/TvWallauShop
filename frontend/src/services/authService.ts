// frontend/src/services/authService.ts

import api from './api';
import { User } from '@/type/user';

export interface LoginCredentials {
   email: string;
   password: string;
}

export interface SignupPayload {
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
   // Shipping (optional)
   state?: string;
   shippingStreet?: string;
   shippingHouseNumber?: string;
   shippingPostalCode?: string;
   shippingCity?: string;
   shippingState?: string;
   shippingCountry?: string;
   // Payment / Marketing
   preferredPayment?: string;
   newsletterOptIn?: boolean;
   // Optional Profile
   dateOfBirth?: Date | null;
   gender?: string;
}

export interface AuthResponse {
   accessToken: string;
   user: User;
   // Falls dein Backend zusätzlich refreshToken zurückgibt, ist das kein Problem:
   // refreshToken?: string;
}

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
   async refresh(): Promise<AuthResponse> {
      const response = await api.post<AuthResponse>('/auth/refresh', undefined, {
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
