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

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const isLocalhost = (value) => {
  const host = String(value ?? '').trim().toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
};

const stripHttpScheme = (value) => {
  const normalized = String(value ?? '').trim();
  if (normalized.toLowerCase().startsWith('https://')) return normalized.slice(8);
  if (normalized.toLowerCase().startsWith('http://')) return normalized.slice(7);
  return normalized;
};

const sanitizeHost = (value) =>
  stripHttpScheme(value).replace(/[/]+$/, '');

const getHostFromApiUrl = (value) =>
  stripHttpScheme(value).split('/')[0].split(':')[0].trim().toLowerCase();

const isIpAddress = (host) => {
  const parts = String(host || '').split('.');
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const number = Number(part);
    return number >= 0 && number <= 255;
  });
};

const isPrivateOrLocalHost = (host) => {
  const normalized = String(host || '').trim().toLowerCase();
  const parts = normalized.split('.');
  const private172 =
    parts.length === 4 &&
    parts[0] === '172' &&
    Number(parts[1]) >= 16 &&
    Number(parts[1]) <= 31;

  return (
    isLocalhost(normalized) ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized === '10.0.2.2' ||
    normalized.startsWith('10.') ||
    normalized.startsWith('127.') ||
    normalized.startsWith('192.168.') ||
    private172 ||
    isIpAddress(normalized)
  );
};

const isPlaceholderApiUrl = (value) => {
  const normalized = String(value || '').toLowerCase();
  return (
    normalized.includes('example.com') ||
    normalized.includes('example.org') ||
    normalized.includes('example.net') ||
    normalized.includes('example.invalid') ||
    normalized.includes('your-api') ||
    normalized.includes('your-backend') ||
    normalized.includes('your-domain') ||
    normalized.includes('placeholder') ||
    normalized.includes('changeme') ||
    normalized.includes('<') ||
    normalized.includes('>')
  );
};

const validateConfiguredApiUrl = (value) => {
  const normalized = String(value || '').trim().replace(/[/]+$/, '');
  const isHttps = normalized.toLowerCase().startsWith('https://');
  const isHttp = normalized.toLowerCase().startsWith('http://');

  if (!isHttps && !isHttp) {
    throw new Error('EXPO_PUBLIC_API_URL doit commencer par http:// ou https://.');
  }

  const remainder = stripHttpScheme(normalized);
  const slashIndex = remainder.indexOf('/');
  const authority = slashIndex >= 0 ? remainder.slice(0, slashIndex) : remainder;
  const path = slashIndex >= 0 ? remainder.slice(slashIndex) : '';

  if (
    !authority ||
    path !== '/api' ||
    authority.includes('?') ||
    authority.includes('#') ||
    authority.includes('@')
  ) {
    throw new Error(
      'EXPO_PUBLIC_API_URL doit être une URL HTTP(S) complète terminant par /api.'
    );
  }

  if (IS_PRODUCTION) {
    if (!isHttps) {
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

  if (APP_ENV !== 'development') {
    throw new Error(
      'EXPO_PUBLIC_API_URL est obligatoire pour les builds AFROEAT preview et production.'
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
  .slice(API_BASE_URL.indexOf('://') + 3)
  .split('/')[0];
const API_URL_HOST = API_URL_AUTHORITY.split(':')[0];
const API_URL_PORT = API_URL_AUTHORITY.includes(':')
  ? API_URL_AUTHORITY.slice(API_URL_AUTHORITY.lastIndexOf(':') + 1)
  : null;

export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  timeout: 15000,
  isProduction: IS_PRODUCTION,
  protocol: API_BASE_URL.toLowerCase().startsWith('https://') ? 'https' : 'http',
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
