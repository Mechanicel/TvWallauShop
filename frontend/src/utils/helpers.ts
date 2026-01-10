import type { User } from '@/type/user';

/**
 * Normalisiert die API-User-Objekte auf unseren Frontend-User-Typ.
 * -> fängt sowohl snake_case als auch camelCase ab.
 * -> Defaults konsistent, um UI-Bugs zu vermeiden
 */
export const mapApiUserToUser = (raw: any): User => {
   if (!raw) throw new Error('Empty user from API');

   const pick = <T>(...values: T[]): T | null => {
      for (const v of values) {
         if (v !== undefined && v !== null) return v;
      }
      return null;
   };

   return {
      id: raw.id,
      email: raw.email,
      role: raw.role,
      isVerified: raw.isVerified ?? raw.is_verified ?? false,
      createdAt: raw.createdAt ?? raw.created_at ?? '',

      // Name
      firstName: raw.firstName ?? raw.first_name ?? '',
      lastName: raw.lastName ?? raw.last_name ?? '',

      // Kontakt
      phone: pick(raw.phone),

      // Rechnungsadresse (konsistent null)
      street: pick(raw.street),
      houseNumber: pick(raw.houseNumber, raw.house_number),
      postalCode: pick(raw.postalCode, raw.postal_code),
      city: pick(raw.city),
      state: pick(raw.state),
      country: pick(raw.country),

      // Lieferadresse (konsistent null)
      shippingStreet: pick(raw.shippingStreet, raw.shipping_street),
      shippingHouseNumber: pick(raw.shippingHouseNumber, raw.shipping_house_number),
      shippingPostalCode: pick(raw.shippingPostalCode, raw.shipping_postal_code),
      shippingCity: pick(raw.shippingCity, raw.shipping_city),
      shippingState: pick(raw.shippingState, raw.shipping_state),
      shippingCountry: pick(raw.shippingCountry, raw.shipping_country),

      // Zahlungsinfo (konsistent null statt undefined)
      preferredPayment: pick(raw.preferredPayment, raw.preferred_payment) as any,

      // Marketing
      newsletterOptIn: raw.newsletterOptIn ?? raw.newsletter_opt_in ?? false,
      dateOfBirth: pick(raw.dateOfBirth, raw.date_of_birth),
      gender: pick(raw.gender),

      // Shop-spezifisch
      loyaltyPoints: raw.loyaltyPoints ?? raw.loyalty_points ?? 0,
      lastLogin: pick(raw.lastLogin, raw.last_login),
      accountStatus: raw.accountStatus ?? raw.account_status ?? 'active',
   };
};
