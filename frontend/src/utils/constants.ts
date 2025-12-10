// Centralized application constants

// API Base URL (falls back to VITE_API_BASE_URL in environment)
// @ts-ignore
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Route paths
export const ROUTES = {
  HOME: '/',
  PRODUCTS: '/products',
  PRODUCT_DETAIL: (id: number | string) => `/products/${id}`,
  CART: '/cart',
  CHECKOUT: '/cart/checkout',
  LOGIN: '/auth/login',
  SIGNUP: '/auth/signup',
  ORDER_CONFIRMATION: '/order-confirmation',
  ADMIN_DASHBOARD: '/admin/dashboard',
  MANAGE_PRODUCTS: '/admin/products',
  MANAGE_ORDERS: '/admin/orders',
  MANAGE_USERS: '/admin/users',
  USER_DETAIL: '/admin/users/:id',
  IMPRESSUM: '/impressum',
  DATENSCHUTZ: '/datenschutz',
  USER_ACCOUNT: '/user/account',
  USER_PROFILE: '/user/profile',
  USER_ORDERS: '/user/orders',
  USER_ORDER_DETAIL: (id: string | number) => `/user/orders/${id}`,
  USER_SETTINGS: '/user/settings',
};

// Local storage keys
export const STORAGE_KEYS = {
  CART: 'shop_cart',
  AUTH_TOKENS: 'auth_tokens',
};

// UI constants
export const UI = {
  DEFAULT_PAGE_SIZE: 10,
  TOAST_LIFETIME_MS: 3000,
};

// Supported sizes
export const AVAILABLE_SIZES: string[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

// Currency formatting
export const CURRENCY = {
  LOCALE: 'de-DE',
  CURRENCY_CODE: 'EUR',
  FORMAT_OPTIONS: { style: 'currency', currency: 'EUR' as const },
};
