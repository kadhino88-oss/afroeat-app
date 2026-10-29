import { Platform } from 'react-native';

/**
 * =========================================================
 * ENV CONFIG
 * =========================================================
 */

/**
 * ⚠️ IMPORTANT — CONFIGURATION RÉSEAU
 * ====================================================
 * Remplace LOCAL_IP par l'adresse IP de ta machine.
 *
 * Pour la trouver :
 *   Windows : ipconfig → "Adresse IPv4"
 *   Mac/Linux : ifconfig → "inet"
 *
 * L'IP doit être sur le même réseau Wi-Fi que ton téléphone.
 * Exemple : 192.168.1.45, 192.168.0.12, 10.0.0.5
 *
 * NE PAS utiliser 'localhost' ou '127.0.0.1' sur téléphone physique.
 * ====================================================
 */
const LOCAL_IP = process.env.EXPO_PUBLIC_LOCAL_IP || '192.168.1.121';
const LOCAL_PORT = process.env.EXPO_PUBLIC_API_PORT || '5000';
const DEV_PROTOCOL = 'http';
const APP_ENV = String(process.env.EXPO_PUBLIC_APP_ENV || 'development')
  .trim()
  .toLowerCase();
const IS_PRODUCTION = APP_ENV === 'production';
const CONFIGURED_API_URL = String(process.env.EXPO_PUBLIC_API_URL || '').trim();

const isLocalhost = (value) => {
  const host = String(value ?? '').trim().toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
};

const sanitizeHost = (value) => {
  return String(value ?? '')
    .trim()
    .replace(/^https?:\\/\\//i, '')
    .replace(/\\/+$/, '');
};

const getHostFromApiUrl = (value) =>
  String(value || '')
    .replace(/^https?:\\/\\//i, '')
    .split('/')[0]
    .split(':')[0]
    .trim()
    .toLowerCase();

const isPrivateOrLocalHost = (host) =>
  isLocalhost(host) ||
  host.endsWith('.localhost') ||
  /^10\\./.test(host) ||
  /^127\\./.test(host) ||
  /^192\\.168\\./.test(host) ||
  /^172\\.(1[6-9]|2[0-9]|3[01])\\./.test(host) ||
  host === '10.0.2.2';

const isPlaceholderApiUrl = (value) =>
  /(?:example\\.(?:com|org|net|invalid)|your[-_. ]?(?:api|backend|domain)|placeholder|changeme|<|>)/i.test(
    String(value || '')
  );

const validateConfiguredApiUrl = (value) => {
  const normalized = String(value || '').trim().replace(/\\/+$/, '');
  if (!normalized) return '';

  if (!/^https?:\\/\\/[^/?#]+\\/api$/i.test(normalized)) {
    throw new Error(
      'EXPO_PUBLIC_API_URL doit être une URL HTTP(S) complète terminant par /api.'
    );
  }

  if (IS_PRODUCTION) {
    if (!/^https:\\/\\//i.test(normalized)) {
      throw new Error('Une URL HTTPS est obligatoire pour AFROEAT en production.');
    }

    const host = getHostFromApiUrl(normalized);
    if (
      !host ||
      !host.includes('.') ||
      isPrivateOrLocalHost(host) ||
      isPlaceholderApiUrl(normalized)
    ) {
      throw new Error(
        'EXPO_PUBLIC_API_URL doit désigner un domaine public HTTPS configuré pour AFROEAT.'
      );
    }
  }

  return normalized;
};

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const isLocalhost = (value) => {
  const host = String(value ?? '').trim().toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
};

const sanitizeHost = (value) => {
  return String(value ?? '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
};

export const safePathParam = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error('Paramètre API manquant.');
  return encodeURIComponent(normalized);
};

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === null || item === undefined || item === '') return;
        searchParams.append(key, String(item));
      });
      return;
    }
    searchParams.append(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const getDevHost = () => {
  const host = sanitizeHost(LOCAL_IP);
  if (!host) throw new Error('EXPO_PUBLIC_LOCAL_IP est vide dans constants/api.js');
  if (Platform.OS === 'android' && isLocalhost(host)) return '10.0.2.2';
  return host;
};

const getBaseUrl = () => {
  if (CONFIGURED_API_URL) {
    return validateConfiguredApiUrl(CONFIGURED_API_URL);
  }

  if (IS_PRODUCTION) {
    throw new Error(
      'EXPO_PUBLIC_API_URL est obligatoire pour une build AFROEAT de production.'
    );
  }

  const host = getDevHost();
  return `${DEV_PROTOCOL}://${host}:${LOCAL_PORT}/api`;
};

/**
 * =========================================================
 * BASE URL / CONFIG
 * =========================================================
 */

export const API_BASE_URL = getBaseUrl();
export const API_URL = API_BASE_URL;

const API_URL_AUTHORITY = API_BASE_URL
  .replace(/^https?:\\/\\//i, '')
  .split('/')[0];
const API_URL_HOST = API_URL_AUTHORITY.split(':')[0];
const API_URL_PORT = API_URL_AUTHORITY.includes(':')
  ? API_URL_AUTHORITY.slice(API_URL_AUTHORITY.lastIndexOf(':') + 1)
  : null;

export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  timeout: 15000,
  isProduction: IS_PRODUCTION,
  protocol: API_BASE_URL.startsWith('https://') ? 'https' : 'http',
  host: API_URL_HOST,
  port: API_URL_PORT,
};

/**
 * =========================================================
 * ENDPOINTS
 * =========================================================
 */

export const API_ENDPOINTS = {

  // ─── Auth ───────────────────────────────────────────────
  auth: {
    login:          '/users/login',
    register:       '/users/register',
    me:             '/users/me',
    refreshToken:   '/users/refresh-token',
    logout:         '/users/logout',
    forgotPassword: '/users/forgot-password',
    resetPassword:  '/users/reset-password',
    verifyIdentity: '/users/verify-identity',
    updateProfile:  '/users/me',
    profile:        '/users/me',
  },

  // ─── Users ──────────────────────────────────────────────
  users: {
    byId:       (id)       => `/users/${safePathParam(id)}`,
    updateById: (id)       => `/users/${safePathParam(id)}`,
    drivers:    (params = {}) => `/users/drivers${buildQueryString(params)}`,
  },

  // ─── Restaurants ────────────────────────────────────────
  restaurants: {
    all:     '/restaurants',
    my:      '/restaurants/my',
    me:      '/restaurants/my',
    mine:    '/restaurants/my',
    profile: '/restaurants/my',
    byId:    (id) => `/restaurants/${safePathParam(id)}`,
    nearby:  (params = {}) => `/restaurants/nearby${buildQueryString(params)}`,
    menu:    (restaurantId) => `/restaurants/${safePathParam(restaurantId)}/menu`,
    orders:  (restaurantId) => `/restaurants/${safePathParam(restaurantId)}/orders`,
  },

  // ─── Menu ───────────────────────────────────────────────
  menu: {
    all:          '/menu',
    byRestaurant: (restaurantId) => `/menu/restaurant/${safePathParam(restaurantId)}`,
    byId:         (id) => `/menu/${safePathParam(id)}`,
    create:       '/menu',
    update:       (id) => `/menu/${safePathParam(id)}`,
    delete:       (id) => `/menu/${safePathParam(id)}`,
  },

  // ─── Orders ─────────────────────────────────────────────
  orders: {
    all:             '/orders',
    create:          '/orders',
    myOrders:        '/orders',
    mine:            '/orders',
    byId:            (id) => `/orders/${safePathParam(id)}`,
    restaurantOrders:(restaurantId) => `/orders/restaurant/${safePathParam(restaurantId)}`,
    deliveryOrders:  '/orders/delivery',
    updateStatus:    (id) => `/orders/${safePathParam(id)}/status`,
    assignDriver:    (id) => `/orders/${safePathParam(id)}/assign-driver`,
    track:           (id) => `/orders/${safePathParam(id)}/tracking`,
    trackingByOrder: (id) => `/orders/${safePathParam(id)}/tracking`,
    updateLocation:  (id) => `/orders/${safePathParam(id)}/driver-location`,
    driverLocation:  (id) => `/orders/${safePathParam(id)}/driver-location`,
  },

  // ─── Admin ──────────────────────────────────────────────
  admin: {
    dashboard:        '/admin/dashboard',
    ops:              '/admin/ops',
    users:            '/admin/users',
    userById:         (id) => `/admin/users/${safePathParam(id)}`,
    userStatus:       (id) => `/admin/users/${safePathParam(id)}/status`,
    restaurants:      '/admin/restaurants',
    restaurantById:   (id) => `/admin/restaurants/${safePathParam(id)}`,
    restaurantStatus: (id) => `/admin/restaurants/${safePathParam(id)}/status`,
    drivers:          '/admin/drivers',
    driverById:       (id) => `/admin/drivers/${safePathParam(id)}`,
    driverStatus:     (id) => `/admin/drivers/${safePathParam(id)}/status`,
    orders:           '/admin/orders',
    orderById:        (id) => `/admin/orders/${safePathParam(id)}`,
    liveOrders:       '/admin/orders/live',
    liveDrivers:      '/admin/drivers/live',
    fleetMap:         '/admin/fleet/map',
    auditLogs:        '/admin/audit-logs',
    auditLogById:     (id) => `/admin/audit-logs/${safePathParam(id)}`,
  },

  // ─── Cart ───────────────────────────────────────────────
  cart: {
    mine:       '/cart',
    addItem:    '/cart/items',
    updateItem: (id) => `/cart/items/${safePathParam(id)}`,
    removeItem: (id) => `/cart/items/${safePathParam(id)}`,
    clear:      '/cart/clear',
  },

  // ─── Payments ───────────────────────────────────────────
  payments: {
    // ✅ Créer un PaymentIntent Stripe
    createIntent:       '/payments/create-payment-intent',
    // ✅ Confirmer un paiement après succès Stripe
    confirm:            '/payments/confirm',
    // Vérification paiement
    verify:             '/payments/verify',
    // Méthodes disponibles
    methods:            '/payments/methods',
    selectCash:         '/payments/select-cash',
    // Historique
    history:            '/payments/history',
    // Payment Sheet (Stripe natif)
    createPaymentSheet: '/payments/create-payment-sheet',
    // Confirmation par commande
    confirmOrderPayment: (orderId) => `/payments/orders/${safePathParam(orderId)}/confirm`,
    // Remboursement admin
    refund:             '/payments/refund',
    refundOrderPayment: (orderId) => `/payments/orders/${safePathParam(orderId)}/refund`,
    // Webhook Stripe (backend uniquement)
    webhook:            '/payments/webhook',
  },

  // ─── Delivery ───────────────────────────────────────────
  delivery: {
    profile:        '/delivery/profile',
    overview:       '/delivery/overview',
    stats:          '/delivery/stats',
    earnings:       '/delivery/earnings',
    availability:   '/delivery/availability',
    currentOrder:   '/delivery/current-order',
    assignedOrders: '/delivery/orders',
    byOrderId:      (id) => `/delivery/orders/${safePathParam(id)}`,
    orderStatus:    (id) => `/delivery/orders/${safePathParam(id)}/status`,
    updateLocation: '/delivery/location',
    tracking:       (orderId) => `/orders/${safePathParam(orderId)}/tracking`,
    updateMissionStatus: (orderId) => `/delivery/orders/${safePathParam(orderId)}/status`,
    markPickedUp:   (orderId) => `/delivery/orders/${safePathParam(orderId)}/status`,
    markDelivered:  (orderId) => `/delivery/orders/${safePathParam(orderId)}/status`,
  },

  // ─── Uploads ────────────────────────────────────────────
  uploads: {
    image:          '/uploads/image',
    identity:       '/uploads/identity',
    workPermit:     '/uploads/work-permit',
    selfie:         '/uploads/selfie',
    restaurantLogo: '/uploads/restaurant-logo',
  },

  // ─── Support ────────────────────────────────────────────
  support: {
    tickets: '/support/tickets',
    create:  '/support/tickets',
    byId:    (id) => `/support/tickets/${safePathParam(id)}`,
  },
};

export { buildQueryString };
