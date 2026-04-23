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
const LOCAL_IP = '192.168.1.22'; // ← CHANGE CETTE IP
const LOCAL_PORT = '5000';       // ← Port de ton backend Node.js

const DEV_PROTOCOL = 'http';
const PROD_PROTOCOL = 'https';

/**
 * Domaine backend production
 * Exemple :
 * api.afroeat.com
 */
const PROD_DOMAIN = 'api.afroeat.com';

/**
 * Passe à true uniquement en production réelle
 */
const IS_PRODUCTION = false;

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

  if (!normalized) {
    throw new Error('Paramètre API manquant.');
  }

  return encodeURIComponent(normalized);
};

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === null || item === undefined || item === '') {
          return;
        }

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

  if (!host) {
    throw new Error('LOCAL_IP est vide dans constants/api.js');
  }

  if (Platform.OS === 'android' && isLocalhost(host)) {
    return '10.0.2.2';
  }

  return host;
};

const getBaseUrl = () => {
  if (IS_PRODUCTION) {
    const prodHost = sanitizeHost(PROD_DOMAIN);

    if (!prodHost) {
      throw new Error('PROD_DOMAIN est vide dans constants/api.js');
    }

    return `${PROD_PROTOCOL}://${prodHost}/api`;
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

export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  timeout: 15000,
  isProduction: IS_PRODUCTION,
  protocol: IS_PRODUCTION ? PROD_PROTOCOL : DEV_PROTOCOL,
  host: IS_PRODUCTION ? sanitizeHost(PROD_DOMAIN) : getDevHost(),
  port: IS_PRODUCTION ? null : LOCAL_PORT,
};

/**
 * =========================================================
 * ENDPOINTS
 * =========================================================
 */

export const API_ENDPOINTS = {
  auth: {
    login: '/users/login',
    register: '/users/register',
    me: '/users/me',
    refreshToken: '/users/refresh-token',
    logout: '/users/logout',
    forgotPassword: '/users/forgot-password',
    resetPassword: '/users/reset-password',
    verifyIdentity: '/users/verify-identity',
    updateProfile: '/users/me',
    profile: '/users/me',
  },

  users: {
    byId: (id) => `/users/${safePathParam(id)}`,
    updateById: (id) => `/users/${safePathParam(id)}`,
    drivers: (params = {}) => {
      const query = buildQueryString(params);
      return `/users/drivers${query}`;
    },
  },

  restaurants: {
    all: '/restaurants',
    my: '/restaurants/my',
    me: '/restaurants/my',
    mine: '/restaurants/my',
    profile: '/restaurants/my',
    byId: (id) => `/restaurants/${safePathParam(id)}`,
    nearby: (params = {}) => {
      const query = buildQueryString(params);
      return `/restaurants/nearby${query}`;
    },
    menu: (restaurantId) => `/restaurants/${safePathParam(restaurantId)}/menu`,
    orders: (restaurantId) =>
      `/restaurants/${safePathParam(restaurantId)}/orders`,
  },

  menu: {
    all: '/menu',
    byRestaurant: (restaurantId) =>
      `/menu/restaurant/${safePathParam(restaurantId)}`,
    byId: (id) => `/menu/${safePathParam(id)}`,
    create: '/menu',
    update: (id) => `/menu/${safePathParam(id)}`,
    delete: (id) => `/menu/${safePathParam(id)}`,
  },

  orders: {
    all: '/orders',
    create: '/orders',
    myOrders: '/orders',
    mine: '/orders',
    byId: (id) => `/orders/${safePathParam(id)}`,
    restaurantOrders: (restaurantId) =>
      `/orders/restaurant/${safePathParam(restaurantId)}`,
    deliveryOrders: '/orders/delivery',
    updateStatus: (id) => `/orders/${safePathParam(id)}/status`,
    assignDriver: (id) => `/orders/${safePathParam(id)}/assign-driver`,
    track: (id) => `/orders/${safePathParam(id)}/tracking`,
    trackingByOrder: (id) => `/orders/${safePathParam(id)}/tracking`,
    updateLocation: (id) => `/orders/${safePathParam(id)}/driver-location`,
    driverLocation: (id) => `/orders/${safePathParam(id)}/driver-location`,
  },

  admin: {
    dashboard: '/admin/dashboard',
    ops: '/admin/ops',

    users: '/admin/users',
    userById: (id) => `/admin/users/${safePathParam(id)}`,
    userStatus: (id) => `/admin/users/${safePathParam(id)}/status`,

    restaurants: '/admin/restaurants',
    restaurantById: (id) => `/admin/restaurants/${safePathParam(id)}`,
    restaurantStatus: (id) =>
      `/admin/restaurants/${safePathParam(id)}/status`,

    drivers: '/admin/drivers',
    driverById: (id) => `/admin/drivers/${safePathParam(id)}`,
    driverStatus: (id) => `/admin/drivers/${safePathParam(id)}/status`,

    orders: '/admin/orders',
    orderById: (id) => `/admin/orders/${safePathParam(id)}`,

    liveOrders: '/admin/orders/live',
    liveDrivers: '/admin/drivers/live',
    fleetMap: '/admin/fleet/map',

    auditLogs: '/admin/audit-logs',
    auditLogById: (id) => `/admin/audit-logs/${safePathParam(id)}`,
  },

  cart: {
    mine: '/cart',
    addItem: '/cart/items',
    updateItem: (id) => `/cart/items/${safePathParam(id)}`,
    removeItem: (id) => `/cart/items/${safePathParam(id)}`,
    clear: '/cart/clear',
  },

  payments: {
    createIntent: '/payments/create-intent',
    verify: '/payments/verify',
    methods: '/payments/methods',
    history: '/payments/history',
    createPaymentSheet: '/payments/create-payment-sheet',
    confirmOrderPayment: (orderId) =>
      `/payments/orders/${safePathParam(orderId)}/confirm`,
    refundOrderPayment: (orderId) =>
      `/payments/orders/${safePathParam(orderId)}/refund`,
    webhook: '/payments/webhook',
  },

  delivery: {
    profile: '/delivery/profile',
    overview: '/delivery/overview',
    stats: '/delivery/stats',
    earnings: '/delivery/earnings',
    availability: '/delivery/availability',
    currentOrder: '/delivery/current-order',

    assignedOrders: '/delivery/orders',
    byOrderId: (id) => `/delivery/orders/${safePathParam(id)}`,
    orderStatus: (id) => `/delivery/orders/${safePathParam(id)}/status`,

    updateLocation: '/delivery/location',

    tracking: (orderId) => `/orders/${safePathParam(orderId)}/tracking`,

    updateMissionStatus: (orderId) =>
      `/delivery/orders/${safePathParam(orderId)}/status`,
    markPickedUp: (orderId) =>
      `/delivery/orders/${safePathParam(orderId)}/status`,
    markDelivered: (orderId) =>
      `/delivery/orders/${safePathParam(orderId)}/status`,
  },

  uploads: {
    image: '/uploads/image',
    identity: '/uploads/identity',
    workPermit: '/uploads/work-permit',
    selfie: '/uploads/selfie',
    restaurantLogo: '/uploads/restaurant-logo',
  },

  support: {
    tickets: '/support/tickets',
    byId: (id) => `/support/tickets/${safePathParam(id)}`,
  },
};

export { buildQueryString };