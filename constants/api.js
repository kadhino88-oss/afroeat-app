import { Platform } from 'react-native';
import apiConfig from './apiConfig';

const APP_ENV = String(process.env.EXPO_PUBLIC_APP_ENV || 'development')
  .trim()
  .toLowerCase();

const apiConfiguration = apiConfig.resolveApiConfig({
  appEnv: APP_ENV,
  configuredApiUrl: process.env.EXPO_PUBLIC_API_URL || '',
  localIp: process.env.EXPO_PUBLIC_LOCAL_IP || '192.168.1.121',
  localPort: process.env.EXPO_PUBLIC_API_PORT || '5000',
  platform: Platform.OS,
});

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

export const API_BASE_URL = apiConfiguration.baseUrl;
export const API_URL = API_BASE_URL;

export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  timeout: 15000,
  isProduction: apiConfiguration.isProduction,
  protocol: apiConfiguration.protocol,
  host: apiConfiguration.host,
  port: apiConfiguration.port,
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
    // Stripe Connect / versements partenaires
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
