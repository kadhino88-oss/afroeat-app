import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiGet, apiPost, apiPut } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeText = (value, fallback = '') => {
  const normalized = String(value || '').trim();
  return normalized || fallback;
};

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  return fallback;
};

const normalizeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const normalizeObject = (value) => {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

const resolveEndpoint = (endpoint, ...args) => {
  if (typeof endpoint === 'function') {
    return endpoint(...args);
  }

  if (typeof endpoint === 'string' && endpoint.trim()) {
    return endpoint;
  }

  return '';
};

const ensureEndpoint = (endpoint, label) => {
  const resolved = resolveEndpoint(endpoint);

  if (!resolved) {
    throw new Error(`Endpoint ${label} introuvable dans API_ENDPOINTS.orders`);
  }

  return resolved;
};

const ensureEndpointWithId = (endpoint, id, label) => {
  const normalizedId = normalizeText(id);

  if (!normalizedId) {
    throw new Error(`${label} : identifiant manquant.`);
  }

  const resolved = resolveEndpoint(endpoint, normalizedId);

  if (!resolved) {
    throw new Error(`Endpoint ${label} introuvable dans API_ENDPOINTS.orders`);
  }

  return resolved;
};

const resolveReferenceId = (value) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const nestedId = value._id ?? value.id;
    if (typeof nestedId === 'string' || typeof nestedId === 'number') {
      return String(nestedId).trim();
    }
  }

  return '';
};

const normalizeOrderItem = (item = {}) => {
  const itemId =
    resolveReferenceId(item?._id) ||
    resolveReferenceId(item?.id) ||
    resolveReferenceId(item?.menuItem);
  const menuItemId =
    resolveReferenceId(item?.menuItem) ||
    resolveReferenceId(item?._id) ||
    resolveReferenceId(item?.id);

  return {
    ...item,
    _id: itemId,
    id: itemId,
    menuItem: menuItemId || null,
    name: normalizeText(item?.name || item?.title || item?.nom, 'Article'),
    description: normalizeText(item?.description),
    image: normalizeText(item?.image),
    quantity: normalizeNumber(item?.quantity, 0),
    price: normalizeNumber(item?.price, 0),
  };
};

const normalizeOrder = (order = {}) => {
  const normalizedItemsSource = normalizeArray(
    order?.items || order?.orderItems || order?.products
  );

  return {
    ...order,
    _id: order?._id || order?.id || '',
    id: order?.id || order?._id || '',
    user: order?.user || null,
    restaurant: order?.restaurant || null,
    deliveryPerson: order?.deliveryPerson || order?.driver || null,
    items: normalizedItemsSource.map(normalizeOrderItem),
    totalPrice: normalizeNumber(order?.totalPrice, 0),
    subtotal: normalizeNumber(order?.subtotal, 0),
    deliveryFee: normalizeNumber(order?.deliveryFee, 0),
    currency: normalizeText(order?.currency, 'EUR'),
    status: normalizeText(order?.status, 'En attente'),
    paymentStatus: normalizeText(order?.paymentStatus, ''),
    deliveryAddress: normalizeText(order?.deliveryAddress),
    note: normalizeText(order?.note || order?.notes),
    tracking: normalizeObject(order?.tracking),
    createdAt: order?.createdAt || null,
    updatedAt: order?.updatedAt || null,
    estimatedDeliveryTime:
      order?.estimatedDeliveryTime || order?.eta || null,
    isPaid: normalizeBoolean(order?.isPaid, false),
  };
};

const extractOrders = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.orders)) return response.orders;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data?.orders)) return response.data.orders;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const extractOrder = (response) => {
  if (response?.order && typeof response.order === 'object') {
    return response.order;
  }

  if (response?.data?.order && typeof response.data.order === 'object') {
    return response.data.order;
  }

  if (response?.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
    return response.data;
  }

  if (response && typeof response === 'object' && !Array.isArray(response)) {
    return response;
  }

  return null;
};

const normalizeOrdersPayload = (response) => {
  return {
    ...normalizeObject(response),
    orders: extractOrders(response).map(normalizeOrder).filter((order) => order?._id),
  };
};

const normalizeOrderPayload = (response) => {
  const order = extractOrder(response);

  if (!order) {
    return null;
  }

  return normalizeOrder(order);
};

/**
 * =========================================================
 * PUBLIC API
 * =========================================================
 */

export const getMyOrders = async (token) => {
  const endpoint = ensureEndpoint(API_ENDPOINTS?.orders?.myOrders, 'orders.myOrders');
  const response = await apiGet(endpoint, token);
  return normalizeOrdersPayload(response);
};

export const getRestaurantOrders = async (restaurantId, token) => {
  const endpoint = ensureEndpointWithId(
    API_ENDPOINTS?.orders?.restaurantOrders,
    restaurantId,
    'orders.restaurantOrders'
  );

  const response = await apiGet(endpoint, token);
  return normalizeOrdersPayload(response);
};

export const getOrderById = async (orderId, token) => {
  const endpoint = ensureEndpointWithId(
    API_ENDPOINTS?.orders?.byId,
    orderId,
    'orders.byId'
  );

  const response = await apiGet(endpoint, token);
  const order = normalizeOrderPayload(response);

  if (!order?._id) {
    throw new Error('Commande introuvable.');
  }

  return order;
};

const fingerprintPayload = (payload) => {
  // Keep the canonical payload aligned with the backend fingerprint. Do not
  // sort the items: order and per-item notes are part of the submitted request.
  const canonical = JSON.stringify({
    restaurant: String(payload?.restaurant || ''),
    items: normalizeArray(payload?.items).map((item) => ({
      menuItem: String(item?.menuItem || ''),
      quantity: Number(item?.quantity || 0),
      notes: normalizeText(item?.notes),
    })),
    deliveryAddress: normalizeText(payload?.deliveryAddress),
    notes: normalizeText(payload?.notes).slice(0, 500),
  });

  let hash = 2166136261;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const getOrCreateIdempotencyKey = async (payload) => {
  const storageKey = `@afroeat/pending-order:${fingerprintPayload(payload)}`;
  let key = null;
  try {
    key = await AsyncStorage.getItem(storageKey);
    if (!key) {
      key = `afroeat-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
      await AsyncStorage.setItem(storageKey, key);
    }
  } catch {
    // If local persistence is unavailable, the in-flight request guard below
    // still prevents duplicate requests during the current app session.
    key = `afroeat-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  }
  return { key, storageKey };
};

// Prevent two rapid taps from racing through AsyncStorage and receiving two
// different idempotency keys for the same checkout payload.
const inFlightOrderRequests = new Map();

export const createOrder = async (payload, token) => {
  const endpoint = ensureEndpoint(API_ENDPOINTS?.orders?.create, 'orders.create');
  const storageKey = `@afroeat/pending-order:${fingerprintPayload(payload)}`;

  if (inFlightOrderRequests.has(storageKey)) {
    return inFlightOrderRequests.get(storageKey);
  }

  const requestPromise = (async () => {
    const { key } = await getOrCreateIdempotencyKey(payload);

    // Keep the key if the request fails or the response cannot be identified.
    // A retry can then recover the original order instead of creating a duplicate.
    const response = await apiPost(
      endpoint,
      { ...payload, idempotencyKey: key },
      token,
      { headers: { 'Idempotency-Key': key } }
    );

    const order = normalizeOrderPayload(response);
    if (!order?._id) {
      throw new Error(
        'Réponse de création de commande invalide : identifiant introuvable. Réessaie pour récupérer la commande existante.'
      );
    }

    // Keep the idempotency key until the payment/order flow is completed.
    // If the app loses the response or the user returns to checkout, a second
    // submit with the same cart must recover the original order, not create a
    // second payable order. The key is cleared after the server confirms the
    // selected payment method.

    return {
      ...normalizeObject(response),
      order,
    };
  })();

  inFlightOrderRequests.set(storageKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    if (inFlightOrderRequests.get(storageKey) === requestPromise) {
      inFlightOrderRequests.delete(storageKey);
    }
  }
};

/**
 * Clear local idempotency keys only after the server has accepted the order's
 * payment method (Stripe confirmation or cash-on-delivery acceptance). This
 * allows a later, intentional purchase with the same cart to create a new order.
 */
export const clearPendingOrderKeys = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const pendingKeys = normalizeArray(keys).filter((key) =>
      String(key).startsWith('@afroeat/pending-order:')
    );
    if (pendingKeys.length) await AsyncStorage.multiRemove(pendingKeys);
    return pendingKeys.length;
  } catch {
    // Cleanup failure must not turn a confirmed payment into a reported failure.
    return 0;
  }
};

export const getOrderQuote = async (payload, token) => {
  const endpoint = ensureEndpoint(API_ENDPOINTS?.orders?.quote, 'orders.quote');
  return apiPost(endpoint, payload, token);
};

export const updateOrderStatus = async (orderId, status, token) => {
  const normalizedStatus = normalizeText(status);

  if (!normalizedStatus) {
    throw new Error('Statut de commande manquant.');
  }

  const endpoint = ensureEndpointWithId(
    API_ENDPOINTS?.orders?.updateStatus,
    orderId,
    'orders.updateStatus'
  );

  const response = await apiPut(
    endpoint,
    { status: normalizedStatus },
    token
  );

  return normalizeOrderPayload(response) || response;
};

export const assignDeliveryPerson = async (orderId, deliveryPerson, token) => {
  const normalizedDriverId = normalizeText(deliveryPerson);

  if (!normalizedDriverId) {
    throw new Error('Livreur manquant pour l’assignation.');
  }

  const endpoint = ensureEndpointWithId(
    API_ENDPOINTS?.orders?.assignDriver,
    orderId,
    'orders.assignDriver'
  );

  const response = await apiPut(
    endpoint,
    { deliveryPerson: normalizedDriverId },
    token
  );

  return normalizeOrderPayload(response) || response;
};

export const getOrderTracking = async (orderId, token) => {
  const endpoint = ensureEndpointWithId(
    API_ENDPOINTS?.orders?.track,
    orderId,
    'orders.track'
  );

  const response = await apiGet(endpoint, token);
  const normalizedResponse = normalizeObject(response);
  const order = normalizeOrderPayload(response);

  return {
    ...normalizedResponse,
    order,
    tracking:
      normalizeObject(normalizedResponse?.tracking) ||
      normalizeObject(order?.tracking) ||
      null,
  };
};

export const updateOrderDriverLocation = async (orderId, coords, token) => {
  const payload = normalizeObject(coords);

  if (
    !Number.isFinite(Number(payload?.latitude)) ||
    !Number.isFinite(Number(payload?.longitude))
  ) {
    throw new Error('Coordonnées livreur invalides.');
  }

  const endpoint = ensureEndpointWithId(
    API_ENDPOINTS?.orders?.driverLocation,
    orderId,
    'orders.driverLocation'
  );

  const response = await apiPut(endpoint, payload, token);

  return normalizeOrderPayload(response) || response;
};

/**
 * =========================================================
 * OPTIONAL HELPERS
 * =========================================================
 */

export const normalizeOrderItemData = (item) => {
  return normalizeOrderItem(item);
};

export const normalizeOrderData = (order) => {
  return normalizeOrder(order);
};

export const normalizeOrdersData = (response) => {
  return normalizeOrdersPayload(response);
};
