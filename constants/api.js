import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

const LOCAL_PORT = '5000';
const getExpoDevelopmentHost = () => {
  // Expo Go / development builds expose the Metro host. On a physical phone,
  // this is the computer's reachable LAN address, unlike localhost (the phone).
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost ||
    '';

  if (!hostUri) return '';

  try {
    const normalizedUri = /^https?:\/\//i.test(hostUri)
      ? hostUri
      : `http://${hostUri}`;
    return new URL(normalizedUri).hostname;
  } catch {
    return String(hostUri).split(':')[0].trim();
  }
};

// Expo's host URI is the preferred source on a physical device. If Expo
// cannot expose it (for example after a deep link/reload), use the LAN address
// configured for this development setup rather than silently falling back to
// localhost, which points back to the phone and causes Network request failed.
// Override this fallback with EXPO_PUBLIC_API_HOST on another Wi-Fi network.
const DEV_HOST = String(
  process.env.EXPO_PUBLIC_API_HOST ||
    (Platform.OS === 'android' && !Device.isDevice
      ? '10.0.2.2'
      : getExpoDevelopmentHost()) ||
    (Device.isDevice ? '192.168.1.22' : 'localhost')
).trim();
const DEV_PROTOCOL = String(process.env.EXPO_PUBLIC_API_PROTOCOL || 'http').trim();
const ENV_API_URL = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
const IS_PRODUCTION = !__DEV__;

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

const normalizeApiBaseUrl = (value) => {
  const normalized = String(value || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error('EXPO_PUBLIC_API_URL doit commencer par http:// ou https://');
  }
  return /\/api$/i.test(normalized) ? normalized : `${normalized}/api`;
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
  const host = sanitizeHost(DEV_HOST);
  if (!host) throw new Error('EXPO_PUBLIC_API_HOST est vide.');
  if (Platform.OS === 'android' && isLocalhost(host)) return '10.0.2.2';
  return host;
};

const getBaseUrl = () => {
  if (ENV_API_URL) {
    const baseUrl = normalizeApiBaseUrl(ENV_API_URL);
    if (IS_PRODUCTION && !baseUrl.toLowerCase().startsWith('https://')) {
      throw new Error('La production Afroeat doit utiliser une URL API HTTPS.');
    }
    return baseUrl;
  }

  if (IS_PRODUCTION) {
    throw new Error(
      'EXPO_PUBLIC_API_URL doit être configurée pour chaque build de préproduction et de production.'
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
export const API_URL      = API_BASE_URL;
const parsedBaseUrl = new URL(API_BASE_URL);

export const API_CONFIG = {
  baseUrl:      API_BASE_URL,
  timeout:      15000,
  isProduction: IS_PRODUCTION,
  protocol:     parsedBaseUrl.protocol.replace(':', ''),
  host:         parsedBaseUrl.hostname,
  port:         parsedBaseUrl.port || null,
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
    deleteAccount:  '/users/me/account',
    accountDeletionPage: '/users/account-deletion',
  },

  // ─── Users ──────────────────────────────────────────────
  users: {
    byId:       (id)       => `/users/${safePathParam(id)}`,
    updateById: (id)       => `/users/${safePathParam(id)}`,
    drivers:    (params = {}) => `/users/drivers${buildQueryString(params)}`,
    favoriteRestaurants: '/users/me/favorites',
    addFavoriteRestaurant: (id) => `/users/me/favorites/${safePathParam(id)}`,
    removeFavoriteRestaurant: (id) => `/users/me/favorites/${safePathParam(id)}`,
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

  // ─── Nearby places ─────────────────────────────────────
  places: {
    nearby: (params = {}) =>
      `/places/nearby${buildQueryString(params)}`,
    groceriesNearby: (params = {}) =>
      `/places/groceries/nearby${buildQueryString(params)}`,
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
    quote:            '/orders/quote',
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
    userVerification: (id) => `/admin/users/${safePathParam(id)}/verification`,
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
    // Paiement natif par PaymentIntent et paiement web hébergé par Stripe Checkout.
    createIntent:       '/payments/create-payment-intent',
    checkout:           '/payments/checkout',
    cash:               '/payments/cash',
    // ✅ Confirmer un paiement après succès Stripe
    confirm:            '/payments/confirm',
    // Vérification paiement
    verify:             '/payments/verify',
    // Méthodes disponibles
    methods:            '/payments/methods',
    // Historique
    history:            '/payments/history',
    // Payment Sheet (Stripe natif)
    createPaymentSheet: '/payments/create-payment-sheet',
    // Gestion des cartes enregistrées du compte client.
    cards: '/payments/cards',
    createCardSetupIntent: '/payments/cards/setup-intent',
    setDefaultCard: (paymentMethodId) =>
      `/payments/cards/${safePathParam(paymentMethodId)}/default`,
    removeCard: (paymentMethodId) =>
      `/payments/cards/${safePathParam(paymentMethodId)}`,
    // Confirmation par commande
    confirmOrderPayment: (orderId) => `/payments/orders/${safePathParam(orderId)}/confirm`,
    // Remboursement admin
    refund:             '/payments/refund',
    refundOrderPayment: (orderId) => `/payments/orders/${safePathParam(orderId)}/refund`,
    connectStatus:      '/payments/connect/status',
    connectOnboardingLink: '/payments/connect/onboarding-link',
    connectDashboardLink: '/payments/connect/dashboard-link',
    connectReconciliation: '/payments/connect/reconciliation',
    connectResolveReconciliation: (orderId) => `/payments/connect/reconciliation/${safePathParam(orderId)}/resolve`,
    connectReconcile:   (orderId) => `/payments/connect/reconcile/${safePathParam(orderId)}`,
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
