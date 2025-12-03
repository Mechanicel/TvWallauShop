// backend/src/utils/helpers.ts

import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wrap an async route handler and forward errors to next()
 */
export const catchAsync =
    (fn: RequestHandler): RequestHandler =>
        (req: Request, res: Response, next: NextFunction) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };

/**
 * Send a standardized error response
 */

// Helper zum User-Mapping
export function mapUser(r: any) {
    return {
        id: r.user_id,
        email: r.email,
        firstName: r.first_name,
        lastName: r.last_name,
        phone: r.phone,
        role: r.role,
        createdAt: r.user_created_at,
        isVerified: !!r.is_verified,

        // Rechnungsadresse
        street: r.street,
        houseNumber: r.house_number,
        postalCode: r.postal_code,
        city: r.city,
        state: r.state,
        country: r.country,

        // Lieferadresse
        shippingStreet: r.shipping_street,
        shippingHouseNumber: r.shipping_house_number,
        shippingPostalCode: r.shipping_postal_code,
        shippingCity: r.shipping_city,
        shippingState: r.shipping_state,
        shippingCountry: r.shipping_country,

        // Preferences / Marketing
        preferredPayment: r.preferred_payment,
        newsletterOptIn: !!r.newsletter_opt_in,
        dateOfBirth: r.date_of_birth,
        gender: r.gender
    };
}
export const sendError = (
    res: Response,
    statusCode: number,
    message: string
): void => {
    res.status(statusCode).json({ error: message });
};

/**
 * Simple email format validation
 */
export const isValidEmail = (email: string): boolean => {
    const re =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};
