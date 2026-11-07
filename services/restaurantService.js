import { apiGet, apiPut } from './apiClient';
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

const normalizeNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeBoolean = (value, fallback = null) => {
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

const resolveEndpoint = (endpoint, ...args) => {
  if (typeof endpoint === 'function') {
    return endpoint(...args);
  }

  if (typeof endpoint === 'string' && endpoint.trim()) {
    return endpoint;
  }

  return '';
};

const normalizeCoordinatesFromLocation = (location) => {
  const coordinates = Array.isArray(location?.coordinates)
    ? location.coordinates
    : [];

  const longitude =
    coordinates[0] !== undefined ? normalizeNumber(coordinates[0], null) : null;

  const latitude =
    coordinates[1] !== undefined ? normalizeNumber(coordinates[1], null) : null;

  return { latitude, longitude };
};

const normalizeRestaurant = (item) => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const locationCoordinates = normalizeCoordinatesFromLocation(item?.location);

  const latitude =
    item?.latitude !== undefined && item?.latitude !== null
      ? normalizeNumber(item.latitude, null)
      : item?.location?.latitude !== undefined && item?.location?.latitude !== null
      ? normalizeNumber(item.location.latitude, null)
      : item?.coords?.latitude !== undefined && item?.coords?.latitude !== null
      ? normalizeNumber(item.coords.latitude, null)
      : locationCoordinates.latitude;

  const longitude =
    item?.longitude !== undefined && item?.longitude !== null
      ? normalizeNumber(item.longitude, null)
      : item?.location?.longitude !== undefined && item?.location?.longitude !== null
      ? normalizeNumber(item.location.longitude, null)
      : item?.coords?.longitude !== undefined && item?.coords?.longitude !== null
      ? normalizeNumber(item.coords.longitude, null)
      : locationCoordinates.longitude;

  return {
    ...item,
    _id: item?._id || item?.id || null,
    id: item?.id || item?._id || null,
    name: normalizeText(item?.name || item?.title, 'Restaurant'),
    cuisine: normalizeText(item?.cuisine, 'Africaine'),
    address: normalizeText(item?.address),
    image: normalizeText(item?.image || item?.coverImage),
    coverImage: normalizeText(item?.coverImage || item?.image),
    rating: normalizeNumber(item?.rating, 0),
    deliveryTime:
      item?.deliveryTime !== undefined && item?.deliveryTime !== null
        ? item.deliveryTime
        : null,
    deliveryFee:
      item?.deliveryFee !== undefined && item?.deliveryFee !== null
        ? normalizeNumber(item.deliveryFee, null)
        : null,
    isOpen: normalizeBoolean(item?.isOpen, true) !== false,
    isFeatured: normalizeBoolean(item?.isFeatured, false) === true,
    owner: item?.owner || null,
    location: item?.location || null,
    city: normalizeText(item?.city),
    country: normalizeText(item?.country),
    currency: normalizeText(item?.currency, 'EUR'),
    phone: normalizeText(item?.phone),
    email: normalizeText(item?.email),
    description: normalizeText(item?.description),
    latitude,
    longitude,
    hasValidCoordinates:
      typeof latitude === 'number' && typeof longitude === 'number',
  };
};

const normalizeRestaurantListResponse = (data) => {
  if (Array.isArray(data)) {
    return data.map(normalizeRestaurant).filter(Boolean);
  }

  if (Array.isArray(data?.restaurants)) {
    return data.restaurants.map(normalizeRestaurant).filter(Boolean);
  }

  if (Array.isArray(data?.items)) {
    return data.items.map(normalizeRestaurant).filter(Boolean);
  }

  if (Array.isArray(data?.results)) {
    return data.results.map(normalizeRestaurant).filter(Boolean);
  }

  if (Array.isArray(data?.data?.restaurants)) {
    return data.data.restaurants.map(normalizeRestaurant).filter(Boolean);
  }

  if (Array.isArray(data?.data?.items)) {
    return data.data.items.map(normalizeRestaurant).filter(Boolean);
  }

  if (Array.isArray(data?.data?.results)) {
    return data.data.results.map(normalizeRestaurant).filter(Boolean);
  }

  if (Array.isArray(data?.data)) {
    return data.data.map(normalizeRestaurant).filter(Boolean);
  }

  return [];
};

const normalizeSingleRestaurantResponse = (data) => {
  const rawRestaurant =
    data?.restaurant ||
    data?.data?.restaurant ||
    data?.data ||
    data ||
    null;

  return normalizeRestaurant(rawRestaurant);
};

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }

    searchParams.append(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const getRestaurantsAllEndpoint = () => {
  const endpoint = resolveEndpoint(API_ENDPOINTS?.restaurants?.all);

  if (!endpoint) {
    throw new Error(
      'Endpoint restaurants.all introuvable dans API_ENDPOINTS.restaurants'
    );
  }

  return endpoint;
};

const getRestaurantByIdEndpoint = (id) => {
  const endpoint = resolveEndpoint(API_ENDPOINTS?.restaurants?.byId, id);

  if (!endpoint) {
    throw new Error(
      'Endpoint restaurants.byId introuvable dans API_ENDPOINTS.restaurants'
    );
  }

  return endpoint;
};

const getNearbyRestaurantsEndpoint = ({ lat, lng, maxDistance }) => {
  const nearbyEndpoint = API_ENDPOINTS?.restaurants?.nearby;

  if (!nearbyEndpoint) {
    throw new Error(
      'Endpoint nearby introuvable dans API_ENDPOINTS.restaurants'
    );
  }

  if (typeof nearbyEndpoint === 'function') {
    const resolved = nearbyEndpoint({ lat, lng, maxDistance });

    if (resolved) return resolved;

    const fallbackResolved = nearbyEndpoint(lat, lng, maxDistance);
    if (fallbackResolved) return fallbackResolved;
  }

  if (typeof nearbyEndpoint === 'string') {
    const queryString = buildQueryString({
      lat,
      lng,
      maxDistance,
    });

    return `${nearbyEndpoint}${queryString}`;
  }

  throw new Error(
    'Endpoint nearby invalide dans API_ENDPOINTS.restaurants'
  );
};

const getMyRestaurantEndpoint = () => {
  const endpoint =
    resolveEndpoint(API_ENDPOINTS?.restaurants?.my) ||
    resolveEndpoint(API_ENDPOINTS?.restaurants?.me) ||
    resolveEndpoint(API_ENDPOINTS?.restaurants?.mine) ||
    resolveEndpoint(API_ENDPOINTS?.restaurants?.profile);

  if (!endpoint) {
    throw new Error(
      'Endpoint getMyRestaurant introuvable dans API_ENDPOINTS.restaurants'
    );
  }

  return endpoint;
};

/**
 * =========================================================
 * PUBLIC API
 * =========================================================
 */

export const getAllRestaurants = async (token = null) => {
  const endpoint = getRestaurantsAllEndpoint();
  const data = await apiGet(endpoint, token);
  return normalizeRestaurantListResponse(data);
};

export const searchRestaurants = async ({
  cuisine = '',
  city = '',
  country = '',
  isOpen = null,
  featured = null,
  token = null,
} = {}) => {
  const endpoint = getRestaurantsAllEndpoint();

  const queryString = buildQueryString({
    cuisine: normalizeText(cuisine),
    city: normalizeText(city),
    country: normalizeText(country),
    open: normalizeBoolean(isOpen, null),
    featured: normalizeBoolean(featured, null),
  });

  const data = await apiGet(`${endpoint}${queryString}`, token);
  return normalizeRestaurantListResponse(data);
};

export const getNearbyRestaurants = async ({
  latitude,
  longitude,
  maxDistance = 10,
  token = null,
}) => {
  const lat = normalizeNumber(latitude, null);
  const lng = normalizeNumber(longitude, null);
  const distance = normalizeNumber(maxDistance, null);

  if (lat === null || lng === null) {
    throw new Error('Coordonnées invalides pour la recherche à proximité.');
  }

  if (distance === null || distance <= 0) {
    throw new Error('La distance maximale est invalide.');
  }

  const endpoint = getNearbyRestaurantsEndpoint({
    lat,
    lng,
    maxDistance: distance,
  });

  const data = await apiGet(endpoint, token);
  return normalizeRestaurantListResponse(data);
};

export const getRestaurantById = async (id, token = null) => {
  const normalizedId = normalizeText(id);

  if (!normalizedId) {
    throw new Error('Identifiant restaurant manquant.');
  }

  const endpoint = getRestaurantByIdEndpoint(normalizedId);
  const data = await apiGet(endpoint, token);
  const restaurant = normalizeSingleRestaurantResponse(data);

  if (!restaurant?._id) {
    throw new Error('Restaurant introuvable.');
  }

  return restaurant;
};

export const getMyRestaurant = async (token) => {
  if (!normalizeText(token)) {
    throw new Error('Token requis pour récupérer le restaurant.');
  }

  const endpoint = getMyRestaurantEndpoint();
  const data = await apiGet(endpoint, token);
  const restaurant = normalizeSingleRestaurantResponse(data);

  if (!restaurant?._id) {
    throw new Error('Aucun restaurant partenaire trouvé pour ce compte.');
  }

  return restaurant;
};

export const updateMyRestaurant = async (id, payload, token) => {
  const normalizedId = normalizeText(id);
  if (!normalizedId || !normalizeText(token)) {
    throw new Error('Identifiant restaurant et session requis.');
  }

  const endpoint = getRestaurantByIdEndpoint(normalizedId);
  const data = await apiPut(endpoint, payload, token);
  const restaurant = normalizeSingleRestaurantResponse(data);

  if (!restaurant?._id) {
    throw new Error('Impossible de mettre à jour le restaurant.');
  }

  return restaurant;
};

/**
 * =========================================================
 * OPTIONAL HELPERS FOR SCREENS
 * =========================================================
 */

export const normalizeRestaurantList = (data) => {
  return normalizeRestaurantListResponse(data);
};

export const normalizeRestaurantItem = (data) => {
  return normalizeRestaurant(data);
};

export const normalizeRestaurantDetails = (data) => {
  return normalizeSingleRestaurantResponse(data);
};

export const hasRestaurantCoordinates = (restaurant) => {
  return Boolean(
    restaurant &&
      typeof restaurant?.latitude === 'number' &&
      typeof restaurant?.longitude === 'number'
  );
};

export const getRestaurantDisplayName = (restaurant) => {
  return normalizeText(restaurant?.name, 'Restaurant');
};
