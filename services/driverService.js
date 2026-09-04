import { apiGet, apiPut } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_STATUS = 'active';
const DEFAULT_SORT = 'recent';

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeString = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const normalizeDriverStatus = (value) => {
  const status = normalizeString(value).toLowerCase();

  if (!status) return DEFAULT_STATUS;
  if (status === 'all') return 'all';
  if (status === 'active') return 'active';
  if (status === 'inactive') return 'inactive';
  if (status === 'pending') return 'pending';

  return DEFAULT_STATUS;
};

const normalizeDriverSort = (value) => {
  const sort = normalizeString(value).toLowerCase();

  if (['recent', 'oldest', 'name'].includes(sort)) {
    return sort;
  }

  return DEFAULT_SORT;
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

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const resolveDriversEndpoint = ({ page, limit, status, sort, search }) => {
  const driversEndpoint = API_ENDPOINTS?.users?.drivers;

  if (typeof driversEndpoint === 'function') {
    return driversEndpoint({
      page,
      limit,
      status,
      sort,
      search,
    });
  }

  if (typeof driversEndpoint === 'string' && driversEndpoint.trim()) {
    const query = new URLSearchParams();

    query.append('page', String(page));
    query.append('limit', String(limit));
    query.append('status', String(status));
    query.append('sort', String(sort));

    if (search) {
      query.append('search', String(search));
    }

    return `${driversEndpoint}?${query.toString()}`;
  }

  throw new Error('Endpoint users.drivers introuvable dans API_ENDPOINTS.');
};

const resolveAssignDriverEndpoint = (orderId) => {
  const assignDriverEndpoint = API_ENDPOINTS?.orders?.assignDriver;

  if (typeof assignDriverEndpoint === 'function') {
    return assignDriverEndpoint(orderId);
  }

  if (typeof assignDriverEndpoint === 'string' && assignDriverEndpoint.trim()) {
    return assignDriverEndpoint.replace(':id', orderId).replace(':orderId', orderId);
  }

  throw new Error('Endpoint orders.assignDriver introuvable dans API_ENDPOINTS.');
};

const normalizeDriver = (driver = {}) => {
  const fullName = `${normalizeString(driver?.firstName)} ${normalizeString(
    driver?.lastName
  )}`.trim();

  return {
    ...driver,
    _id: driver?._id || driver?.id || '',
    id: driver?.id || driver?._id || '',
    name: normalizeString(driver?.name || fullName, 'Livreur Afroeat'),
    firstName: normalizeString(driver?.firstName),
    lastName: normalizeString(driver?.lastName),
    email: normalizeString(driver?.email),
    role: normalizeString(driver?.role, 'livreur'),
    phone: normalizeString(driver?.phone),
    city: normalizeString(driver?.city || driver?.addressCity),
    country: normalizeString(driver?.country),
    vehicleType: normalizeString(driver?.vehicleType || driver?.vehicle),
    accountStatus: normalizeString(driver?.accountStatus, 'pending_verification'),
    isIdentityVerified: normalizeBoolean(driver?.isIdentityVerified, false),
    isWorkAuthorized: normalizeBoolean(driver?.isWorkAuthorized, false),
    isAvailable: normalizeBoolean(driver?.isAvailable, false),
    currentOrderId:
      driver?.currentOrder?._id ||
      driver?.currentOrderId ||
      driver?.activeOrder?._id ||
      null,
    currentOrderStatus:
      driver?.currentOrder?.status || driver?.currentOrderStatus || '',
    completedDeliveries: normalizeNumber(
      driver?.completedDeliveries || driver?.deliveriesCompleted,
      0
    ),
    rating: normalizeNumber(driver?.rating, 0),
    earningsToday: normalizeNumber(driver?.earningsToday, 0),
    earningsWeek: normalizeNumber(driver?.earningsWeek, 0),
    acceptanceRate: normalizeNumber(driver?.acceptanceRate, 0),
    completionRate: normalizeNumber(driver?.completionRate, 0),
    createdAt: driver?.createdAt || null,
    updatedAt: driver?.updatedAt || null,
    lastSeenAt: driver?.lastSeenAt || driver?.updatedAt || null,
  };
};

const normalizeDriversResponse = (data) => {
  const rawDrivers = Array.isArray(data)
    ? data
    : Array.isArray(data?.drivers)
    ? data.drivers
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data?.drivers)
    ? data.data.drivers
    : Array.isArray(data?.data?.items)
    ? data.data.items
    : Array.isArray(data?.data)
    ? data.data
    : [];

  const normalizedDrivers = normalizeArray(rawDrivers)
    .map(normalizeDriver)
    .filter((driver) => driver._id);

  const total = Number.isFinite(Number(data?.total))
    ? Number(data.total)
    : Number.isFinite(Number(data?.data?.total))
    ? Number(data.data.total)
    : normalizedDrivers.length;

  const count = Number.isFinite(Number(data?.count))
    ? Number(data.count)
    : Number.isFinite(Number(data?.data?.count))
    ? Number(data.data.count)
    : normalizedDrivers.length;

  const page = Number.isFinite(Number(data?.page))
    ? Number(data.page)
    : Number.isFinite(Number(data?.data?.page))
    ? Number(data.data.page)
    : DEFAULT_PAGE;

  const pages = Number.isFinite(Number(data?.pages))
    ? Number(data.pages)
    : Number.isFinite(Number(data?.data?.pages))
    ? Number(data.data.pages)
    : 1;

  return {
    drivers: normalizedDrivers,
    total,
    count,
    page,
    pages,
  };
};

const normalizeAssignedOrderResponse = (data, fallback = {}) => {
  const order =
    (data?.order && typeof data.order === 'object' && !Array.isArray(data.order)
      ? data.order
      : null) ||
    (data?.data?.order &&
    typeof data.data.order === 'object' &&
    !Array.isArray(data.data.order)
      ? data.data.order
      : null) ||
    (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)
      ? data.data
      : null) ||
    (data && typeof data === 'object' && !Array.isArray(data) ? data : null);

  if (!order) {
    return {
      _id: fallback?.orderId || '',
      deliveryPerson: fallback?.deliveryPerson || null,
    };
  }

  return {
    ...order,
    _id: order?._id || order?.id || fallback?.orderId || '',
    deliveryPerson:
      order?.deliveryPerson || order?.driver || fallback?.deliveryPerson || null,
  };
};

/**
 * =========================================================
 * PUBLIC API
 * =========================================================
 */

export const getDrivers = async (token, options = {}) => {
  if (!normalizeString(token)) {
    throw new Error('Session invalide. Reconnecte-toi.');
  }

  const page = normalizePositiveInteger(options?.page, DEFAULT_PAGE);
  const limit = Math.min(
    normalizePositiveInteger(options?.limit, DEFAULT_LIMIT),
    MAX_LIMIT
  );
  const status = normalizeDriverStatus(options?.status);
  const sort = normalizeDriverSort(options?.sort);
  const search = normalizeString(options?.search);

  const endpoint = resolveDriversEndpoint({
    page,
    limit,
    status,
    sort,
    search,
  });

  const data = await apiGet(endpoint, token);
  return normalizeDriversResponse(data);
};

export const getActiveDrivers = async (token, options = {}) => {
  return getDrivers(token, {
    ...options,
    status: 'active',
  });
};

export const assignDriverToOrder = async (orderId, deliveryPerson, token) => {
  if (!normalizeString(token)) {
    throw new Error('Session invalide. Reconnecte-toi.');
  }

  const normalizedOrderId = normalizeString(orderId);
  const normalizedDriverId = normalizeString(deliveryPerson);

  if (!normalizedOrderId) {
    throw new Error('Commande invalide.');
  }

  if (!normalizedDriverId) {
    throw new Error('Livreur invalide.');
  }

  const endpoint = resolveAssignDriverEndpoint(normalizedOrderId);

  const data = await apiPut(
    endpoint,
    { deliveryPerson: normalizedDriverId },
    token
  );

  return normalizeAssignedOrderResponse(data, {
    orderId: normalizedOrderId,
    deliveryPerson: normalizedDriverId,
  });
};

export const getDriverDisplayName = (driver) => {
  if (!driver || typeof driver !== 'object') {
    return 'Livreur non assigné';
  }

  const name = normalizeString(driver?.name);
  if (name) return name;

  const fullName = `${normalizeString(driver?.firstName)} ${normalizeString(
    driver?.lastName
  )}`.trim();
  if (fullName) return fullName;

  const email = normalizeString(driver?.email);
  if (email) return email;

  return 'Livreur Afroeat';
};

export const isOrderAssignedToDriver = (order) => {
  return Boolean(
    order?.deliveryPerson?._id ||
      order?.deliveryPerson ||
      order?.driver?._id ||
      order?.driver
  );
};

export const normalizeDriverItem = (driver) => {
  return normalizeDriver(driver);
};

export const normalizeDriversList = (data) => {
  return normalizeDriversResponse(data);
};