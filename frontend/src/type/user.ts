// frontend/src/types/user.ts
export interface User {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
    role: 'customer' | 'admin';
    isVerified: boolean;
    createdAt: string;

    // Rechnungsadresse
    street?: string | null;
    house_number?: string | null;
    postal_code?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;

    // Lieferadresse
    shippingStreet?: string | null;
    shippingHouseNumber?: string | null;
    shippingPostalCode?: string | null;
    shippingCity?: string | null;
    shippingState?: string | null;
    shippingCountry?: string | null;

    // Zahlungsinfo
    preferred_payment?: 'invoice' | 'paypal' | 'creditcard' | 'banktransfer';

    // Marketing
    newsletter_opt_in?: boolean;
    dateOfBirth?: string | null;
    gender?: 'male' | 'female' | 'other' | null;

    // Shop-spezifisch
    loyaltyPoints?: number;
    lastLogin?: string | null;
    accountStatus?: 'active' | 'suspended' | 'deleted';
}
