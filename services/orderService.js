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

const normalizeOrderItem = (item = {}) => {
  return {
    ...item,
    _id: item?._id || item?.id || item?.menuItem || '',
    id: item?.id || item?._id || item?.menuItem || '',
    menuItem: item?.menuItem || item?._id || item?.id || null,
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

export const createOrder = async (payload, token) => {
  const endpoint = ensureEndpoint(API_ENDPOINTS?.orders?.create, 'orders.create');
  const response = await apiPost(endpoint, payload, token);

  const order = normalizeOrderPayload(response);

  if (order?._id) {
    return {
      ...normalizeObject(response),
      order,
    };
  }

  return response;
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