import { apiGet } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

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

const normalizeMenuItem = (item) => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const restaurantId =
    item?.restaurant?._id ||
    item?.restaurantId ||
    item?.restaurant ||
    null;

  return {
    ...item,
    _id: item?._id || item?.id || null,
    id: item?.id || item?._id || null,
    restaurant: item?.restaurant || restaurantId || null,
    restaurantId,
    name: normalizeText(item?.name, 'Plat'),
    description: normalizeText(item?.description, 'Aucune description'),
    image: normalizeText(item?.image),
    category: normalizeText(item?.category, 'Plats principaux'),
    cuisine: normalizeText(item?.cuisine, 'Africaine'),
    price: normalizeNumber(item?.price, 0),
    available:
      item?.available !== undefined
        ? normalizeBoolean(item.available, true)
        : normalizeBoolean(item?.isAvailable, true),
    isAvailable:
      item?.isAvailable !== undefined
        ? normalizeBoolean(item.isAvailable, true)
        : normalizeBoolean(item?.available, true),
    isPopular: normalizeBoolean(item?.isPopular, false),
    isRecommended: normalizeBoolean(item?.isRecommended, false),
    createdAt: item?.createdAt || null,
    updatedAt: item?.updatedAt || null,
  };
};

const normalizeMenuListResponse = (data) => {
  const rawItems = Array.isArray(data)
    ? data
    : Array.isArray(data?.menuItems)
    ? data.menuItems
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data)
    ? data.data
    : [];

  return rawItems.map(normalizeMenuItem).filter(Boolean);
};

const normalizeSingleMenuResponse = (data) => {
  const rawItem = data?.menuItem || data?.item || data?.data || data || null;
  return normalizeMenuItem(rawItem);
};

export const getAllMenuItems = async (token = null) => {
  const response = await apiGet(API_ENDPOINTS.menu.all, token);
  return normalizeMenuListResponse(response);
};

export const getMenuByRestaurant = async (restaurantId, token = null) => {
  const response = await apiGet(
    API_ENDPOINTS.menu.byRestaurant(restaurantId),
    token
  );
  return normalizeMenuListResponse(response);
};

export const getMenuItemById = async (id, token = null) => {
  const response = await apiGet(API_ENDPOINTS.menu.byId(id), token);
  const item = normalizeSingleMenuResponse(response);

  if (!item?._id) {
    throw new Error('Plat introuvable.');
  }

  return item;
};
