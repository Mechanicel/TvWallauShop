// Utility helper functions for the Vereins-Shop Frontend

/**
 * Format a number as currency according to locale and currency code
 * @param amount number to format
 * @returns formatted currency string
 */
import { User } from '@/type/user';

/**
 * Normalisiert die API-User-Objekte auf unseren Frontend-User-Typ.
 * -> fängt sowohl snake_case als auch camelCase ab.
 */
export const mapApiUserToUser = (raw: any): User => {
  if (!raw) {
    throw new Error('Empty user from API');
  }

  return {
    id: raw.id,
    email: raw.email,
    role: raw.role,
    isVerified: raw.isVerified ?? raw.is_verified ?? false,
    createdAt: raw.createdAt ?? raw.created_at ?? '',

    // Name
    first_name: raw.first_name ?? raw.firstName ?? '',
    last_name: raw.last_name ?? raw.lastName ?? '',

    // Kontakt
    phone: raw.phone ?? null,

    // Rechnungsadresse
    street: raw.street ?? null,
    house_number: raw.house_number ?? raw.houseNumber ?? null,
    postal_code: raw.postal_code ?? raw.postalCode ?? null,
    city: raw.city ?? null,
    country: raw.country ?? null,

    // Lieferadresse
    shippingStreet: raw.shippingStreet ?? raw.shipping_street ?? '',
    shippingHouseNumber:
      raw.shippingHouseNumber ?? raw.shipping_house_number ?? '',
    shippingPostalCode:
      raw.shippingPostalCode ?? raw.shipping_postal_code ?? '',
    shippingCity: raw.shippingCity ?? raw.shipping_city ?? '',
    shippingState: raw.shippingState ?? raw.shipping_state ?? '',
    shippingCountry: raw.shippingCountry ?? raw.shipping_country ?? '',

    // Zahlungsinfo
    preferred_payment:
      raw.preferred_payment ?? raw.preferredPayment ?? undefined,

    // Marketing
    newsletter_opt_in: raw.newsletter_opt_in ?? raw.newsletterOptIn ?? false,
    dateOfBirth: raw.dateOfBirth ?? raw.date_of_birth ?? null,
    gender: raw.gender ?? null,

    // Shop-spezifisch
    loyaltyPoints: raw.loyaltyPoints ?? raw.loyalty_points ?? 0,
    lastLogin: raw.lastLogin ?? raw.last_login ?? null,
    accountStatus: raw.accountStatus ?? raw.account_status ?? 'active',
  };
};
