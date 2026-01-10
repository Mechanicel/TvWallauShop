export type UserRole = 'customer' | 'admin';

export type PaymentMethod = 'invoice' | 'paypal' | 'creditcard' | 'banktransfer';

export type Gender = 'male' | 'female' | 'other';

export type AccountStatus = 'active' | 'suspended' | 'deleted';

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  isVerified: boolean;
  createdAt: string;

  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
  country: string | null;

  shippingStreet: string | null;
  shippingHouseNumber: string | null;
  shippingPostalCode: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingCountry: string | null;

  preferredPayment: PaymentMethod;
  newsletterOptIn: boolean;
  dateOfBirth: string | null;
  gender: Gender | null;

  loyaltyPoints: number;
  lastLogin: string | null;
  accountStatus: AccountStatus;
}
