import { apiGet, apiPut } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const normalizeText = (value, fallback = '') => {
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

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePage = (value) =>
  Math.max(normalizePositiveInteger(value, DEFAULT_PAGE), DEFAULT_PAGE);

const normalizeLimit = (value) =>
  Math.min(
    Math.max(normalizePositiveInteger(value, DEFAULT_LIMIT), 1),
    MAX_LIMIT
  );

const normalizeSort = (value, allowed = []) => {
  const normalized = normalizeText(value).toLowerCase();

  if (!normalized) {
    return '';
  }

  if (allowed.length === 0 || allowed.includes(normalized)) {
    return normalized;
  }

  return '';
};

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
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

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeArrayResponse = (data, key) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizeObjectResponse = (data, key) => {
  if (isPlainObject(data?.[key])) {
    return data[key];
  }

  if (isPlainObject(data?.data)) {
    return data.data;
  }

  if (isPlainObject(data)) {
    return data;
  }

  return null;
};

const normalizePaginationMeta = (
  data,
  items = [],
  requestedLimit = DEFAULT_LIMIT
) => {
  const totalFromPagination = Number(data?.pagination?.total);
  const countFromPagination = Number(data?.pagination?.count);
  const pageFromPagination = Number(data?.pagination?.page);
  const pagesFromPagination = Number(data?.pagination?.pages);
  const limitFromPagination = Number(data?.pagination?.limit);

  const totalLegacy = Number(data?.total);
  const countLegacy = Number(data?.count);
  const pageLegacy = Number(data?.page);
  const pagesLegacy = Number(data?.pages);
  const limitLegacy = Number(data?.limit);

  const resolvedLimit = Number.isFinite(limitFromPagination)
    ? limitFromPagination
    : Number.isFinite(limitLegacy)
      ? limitLegacy
      : requestedLimit;

  const total = Number.isFinite(totalFromPagination)
    ? totalFromPagination
    : Number.isFinite(totalLegacy)
      ? totalLegacy
      : items.length;

  const count = Number.isFinite(countFromPagination)
    ? countFromPagination
    : Number.isFinite(countLegacy)
      ? countLegacy
      : items.length;

  const page = Number.isFinite(pageFromPagination)
    ? pageFromPagination
    : Number.isFinite(pageLegacy)
      ? pageLegacy
      : DEFAULT_PAGE;

  const pages = Number.isFinite(pagesFromPagination)
    ? pagesFromPagination
    : Number.isFinite(pagesLegacy)
      ? pagesLegacy
      : Math.max(Math.ceil(total / Math.max(resolvedLimit, 1)), 1);

  const hasPrevPage =
    typeof data?.pagination?.hasPrevPage === 'boolean'
      ? data.pagination.hasPrevPage
      : page > 1;

  const hasNextPage =
    typeof data?.pagination?.hasNextPage === 'boolean'
      ? data.pagination.hasNextPage
      : page < pages;

  return {
    total,
    count,
    page,
    pages,
    limit: resolvedLimit,
    hasPrevPage,
    hasNextPage,
  };
};

const normalizePagedResponse = (data, key, requestedLimit = DEFAULT_LIMIT) => {
  const items = normalizeArrayResponse(data, key);
  const pagination = normalizePaginationMeta(data, items, requestedLimit);

  return {
    items,
    total: pagination.total,
    count: pagination.count,
    page: pagination.page,
    pages: pagination.pages,
    limit: pagination.limit,
    hasPrevPage: pagination.hasPrevPage,
    hasNextPage: pagination.hasNextPage,
    pagination,
    filters: isPlainObject(data?.filters) ? data.filters : {},
  };
};

const ensureToken = (token) => {
  if (!normalizeText(token)) {
    throw new Error('Session admin invalide.');
  }
};

const ensureEntityId = (value, message) => {
  if (!normalizeText(value)) {
    throw new Error(message);
  }
};

const extractMessage = (data, fallback = '') => {
  const message = normalizeText(data?.message);
  return message || fallback;
};

const buildAdminListParams = (base = {}, options = {}) => {
  const page = normalizePage(options?.page);
  const limit = normalizeLimit(options?.limit);

  return {
    ...base,
    page,
    limit,
  };
};

const buildAdminListResult = (data, key, options = {}) => {
  const requestedLimit = normalizeLimit(options?.limit);
  return normalizePagedResponse(data, key, requestedLimit);
};

const normalizeAdminDriver = (driver) => {
  if (!isPlainObject(driver)) {
    return null;
  }

  const fullName = `${normalizeText(driver?.firstName)} ${normalizeText(
    driver?.lastName
  )}`.trim();

  return {
    ...driver,
    _id: driver?._id || driver?.id || null,
    id: driver?.id || driver?._id || null,
    name: normalizeText(driver?.name || fullName, 'Livreur Afroeat'),
    email: normalizeText(driver?.email),
    phone: normalizeText(driver?.phone),
    city: normalizeText(driver?.city || driver?.addressCity),
    country: normalizeText(driver?.country),
    vehicleType: normalizeText(driver?.vehicleType || driver?.vehicle),
    accountStatus: normalizeText(driver?.accountStatus, 'unknown'),
    isIdentityVerified: Boolean(driver?.isIdentityVerified),
    isWorkAuthorized: Boolean(driver?.isWorkAuthorized),
    isAvailable: Boolean(driver?.isAvailable),
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

export const getAdminDashboard = async (token) => {
  ensureToken(token);

  const data = await apiGet(API_ENDPOINTS.admin.dashboard, token);
  const dashboard = normalizeObjectResponse(data, 'dashboard');

  if (!dashboard) {
    throw new Error('Impossible de charger le tableau de bord admin.');
  }

  return dashboard;
};

export const getAdminOpsOverview = async (token) => {
  ensureToken(token);

  const data = await apiGet(API_ENDPOINTS.admin.ops, token);
  const ops = normalizeObjectResponse(data, 'ops');

  if (!ops) {
    throw new Error('Impossible de charger les opérations admin.');
  }

  return ops;
};

export const getAdminUsers = async (token, options = {}) => {
  ensureToken(token);

  const endpoint = `${API_ENDPOINTS.admin.users}${buildQueryString(
    buildAdminListParams(
      {
        role: normalizeText(options?.role),
        status: normalizeText(options?.status),
        search: normalizeText(options?.search),
        sort: normalizeSort(options?.sort, ['recent', 'oldest', 'name']),
        from: normalizeText(options?.from),
        to: normalizeText(options?.to),
      },
      options
    )
  )}`;

  const data = await apiGet(endpoint, token);
  return buildAdminListResult(data, 'users', options);
};

export const getAdminUserById = async (userId, token) => {
  ensureToken(token);
  ensureEntityId(userId, 'Utilisateur invalide.');

  const data = await apiGet(API_ENDPOINTS.admin.userById(userId), token);
  const user = normalizeObjectResponse(data, 'user');

  if (!user?._id) {
    throw new Error('Utilisateur introuvable.');
  }

  return user;
};

export const updateAdminUserStatus = async (userId, accountStatus, token) => {
  ensureToken(token);
  ensureEntityId(userId, 'Utilisateur invalide.');
  ensureEntityId(accountStatus, 'Statut utilisateur invalide.');

  const data = await apiPut(
    API_ENDPOINTS.admin.userStatus(userId),
    { accountStatus: normalizeText(accountStatus).toLowerCase() },
    token
  );

  const user = normalizeObjectResponse(data, 'user');

  if (!user?._id) {
    throw new Error(
      extractMessage(data, 'Échec de la mise à jour du statut utilisateur.')
    );
  }

  return {
    user,
    message: extractMessage(data, 'Statut utilisateur mis à jour avec succès.'),
    success: data?.success !== false,
  };
};

export const updateAdminUserVerification = async (userId, token) => {
  ensureToken(token);
  ensureEntityId(userId, 'Utilisateur invalide.');

  const data = await apiPut(
    API_ENDPOINTS.admin.userVerification(userId),
    { isIdentityVerified: true, isWorkAuthorized: true },
    token
  );
  const user = normalizeObjectResponse(data, 'user');

  if (!user?._id) {
    throw new Error(
      extractMessage(data, 'Échec de la vérification du partenaire.')
    );
  }

  return {
    user,
    message: extractMessage(data, 'Vérification partenaire enregistrée.'),
    success: data?.success !== false,
  };
};

export const getAdminRestaurants = async (token, options = {}) => {
  ensureToken(token);

  const endpoint = `${API_ENDPOINTS.admin.restaurants}${buildQueryString(
    buildAdminListParams(
      {
        cuisine: normalizeText(options?.cuisine),
        city: normalizeText(options?.city),
        country: normalizeText(options?.country),
        ownerId: normalizeText(options?.ownerId),
        search: normalizeText(options?.search),
        sort: normalizeSort(options?.sort, ['recent', 'oldest', 'name']),
        from: normalizeText(options?.from),
        to: normalizeText(options?.to),
      },
      options
    )
  )}`;

  const data = await apiGet(endpoint, token);
  return buildAdminListResult(data, 'restaurants', options);
};

export const getAdminRestaurantById = async (restaurantId, token) => {
  ensureToken(token);
  ensureEntityId(restaurantId, 'Restaurant invalide.');

  const data = await apiGet(API_ENDPOINTS.admin.restaurantById(restaurantId), token);
  const restaurant = normalizeObjectResponse(data, 'restaurant');

  if (!restaurant?._id) {
    throw new Error('Restaurant introuvable.');
  }

  return restaurant;
};

export const getAdminDrivers = async (token, options = {}) => {
  ensureToken(token);

  const endpoint = `${API_ENDPOINTS.admin.drivers}${buildQueryString(
    buildAdminListParams(
      {
        status: normalizeText(options?.status),
        search: normalizeText(options?.search),
        sort: normalizeSort(options?.sort, ['recent', 'oldest', 'name']),
        from: normalizeText(options?.from),
        to: normalizeText(options?.to),
      },
      options
    )
  )}`;

  const data = await apiGet(endpoint, token);
  const result = buildAdminListResult(data, 'drivers', options);

  return {
    ...result,
    items: result.items.map(normalizeAdminDriver).filter(Boolean),
  };
};

export const getAdminDriverById = async (driverId, token) => {
  ensureToken(token);
  ensureEntityId(driverId, 'Livreur invalide.');

  const driversResult = await getAdminDrivers(token, {
    page: 1,
    limit: MAX_LIMIT,
    sort: 'recent',
  });

  const driver =
    driversResult.items.find(
      (item) => normalizeText(item?._id) === normalizeText(driverId)
    ) || null;

  if (!driver?._id) {
    throw new Error('Livreur introuvable.');
  }

  return driver;
};

export const getAdminOrders = async (token, options = {}) => {
  ensureToken(token);

  const endpoint = `${API_ENDPOINTS.admin.orders}${buildQueryString(
    buildAdminListParams(
      {
        status: normalizeText(options?.status),
        paymentStatus: normalizeText(options?.paymentStatus),
        restaurantId: normalizeText(options?.restaurantId),
        userId: normalizeText(options?.userId),
        deliveryPersonId: normalizeText(options?.deliveryPersonId),
        search: normalizeText(options?.search),
        sort: normalizeSort(options?.sort, ['recent', 'oldest']),
        from: normalizeText(options?.from),
        to: normalizeText(options?.to),
      },
      options
    )
  )}`;

  const data = await apiGet(endpoint, token);
  return buildAdminListResult(data, 'orders', options);
};

export const getAdminOrderById = async (orderId, token) => {
  ensureToken(token);
  ensureEntityId(orderId, 'Commande invalide.');

  const data = await apiGet(API_ENDPOINTS.admin.orderById(orderId), token);
  const order = normalizeObjectResponse(data, 'order');

  if (!order?._id) {
    throw new Error('Commande introuvable.');
  }

  return order;
};

export const getAdminAuditLogs = async (token, options = {}) => {
  ensureToken(token);

  const endpoint = `${API_ENDPOINTS.admin.auditLogs}${buildQueryString(
    buildAdminListParams(
      {
        action: normalizeText(options?.action),
        targetType: normalizeText(options?.targetType),
        adminId: normalizeText(options?.adminId),
        search: normalizeText(options?.search),
        sort: normalizeSort(options?.sort, ['recent', 'oldest']),
        from: normalizeText(options?.from),
        to: normalizeText(options?.to),
      },
      options
    )
  )}`;

  const data = await apiGet(endpoint, token);
  return buildAdminListResult(data, 'logs', options);
};

export const getAdminAuditLogById = async (logId, token) => {
  ensureToken(token);
  ensureEntityId(logId, 'Journal invalide.');

  const data = await apiGet(API_ENDPOINTS.admin.auditLogById(logId), token);
  const log = normalizeObjectResponse(data, 'log');

  if (!log?._id) {
    throw new Error('Journal introuvable.');
  }

  return log;
};
