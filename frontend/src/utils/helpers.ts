import { User } from '@/type/user';

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
      first_name: raw.first_name ?? raw.firstName ?? '',
      last_name: raw.last_name ?? raw.lastName ?? '',

      // Kontakt
      phone: pick(raw.phone),

      // Rechnungsadresse (konsistent null)
      street: pick(raw.street),
      house_number: pick(raw.house_number, raw.houseNumber),
      postal_code: pick(raw.postal_code, raw.postalCode),
      city: pick(raw.city),
      state: pick(raw.state), // ✅ war bei dir der fehlende Teil
      country: pick(raw.country),

      // Lieferadresse (konsistent null)
      shippingStreet: pick(raw.shippingStreet, raw.shipping_street),
      shippingHouseNumber: pick(raw.shippingHouseNumber, raw.shipping_house_number),
      shippingPostalCode: pick(raw.shippingPostalCode, raw.shipping_postal_code),
      shippingCity: pick(raw.shippingCity, raw.shipping_city),
      shippingState: pick(raw.shippingState, raw.shipping_state),
      shippingCountry: pick(raw.shippingCountry, raw.shipping_country),

      // Zahlungsinfo (konsistent null statt undefined)
      preferred_payment: pick(raw.preferred_payment, raw.preferredPayment) as any,

      // Marketing
      newsletter_opt_in: raw.newsletter_opt_in ?? raw.newsletterOptIn ?? false,
      dateOfBirth: pick(raw.dateOfBirth, raw.date_of_birth),
      gender: pick(raw.gender),

      // Shop-spezifisch
      loyaltyPoints: raw.loyaltyPoints ?? raw.loyalty_points ?? 0,
      lastLogin: pick(raw.lastLogin, raw.last_login),
      accountStatus: raw.accountStatus ?? raw.account_status ?? 'active',
   };
};
