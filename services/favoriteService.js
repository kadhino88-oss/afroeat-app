import { apiDelete, apiGet, apiPut } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

const requireToken = (token) => {
  if (!String(token || '').trim()) {
    throw new Error('Session expirée. Connecte-toi pour gérer tes favoris.');
  }
};

export const getFavoriteRestaurants = async (token) => {
  requireToken(token);
  const response = await apiGet(API_ENDPOINTS.users.favoriteRestaurants, token);
  return Array.isArray(response?.restaurants) ? response.restaurants : [];
};

export const addFavoriteRestaurant = async (restaurantId, token) => {
  requireToken(token);
  if (!restaurantId) throw new Error('Restaurant invalide.');
  return apiPut(
    API_ENDPOINTS.users.addFavoriteRestaurant(restaurantId),
    {},
    token
  );
};

export const removeFavoriteRestaurant = async (restaurantId, token) => {
  requireToken(token);
  if (!restaurantId) throw new Error('Restaurant invalide.');
  return apiDelete(
    API_ENDPOINTS.users.removeFavoriteRestaurant(restaurantId),
    token
  );
};
