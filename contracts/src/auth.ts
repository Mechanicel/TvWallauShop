import type { Gender, PaymentMethod, User } from './user';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string | null;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  state?: string | null;
  shippingStreet?: string | null;
  shippingHouseNumber?: string | null;
  shippingPostalCode?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingCountry?: string | null;
  preferredPayment?: PaymentMethod | null;
  newsletterOptIn?: boolean | null;
  dateOfBirth?: string | null;
  gender?: Gender | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
}
