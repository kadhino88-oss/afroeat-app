import { apiGet } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

const getNearbyPlacesRequest = async ({
  latitude,
  longitude,
  radius = 10,
  token = null,
}) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const distance = Number(radius);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Coordonnées invalides pour les épiceries à proximité.');
  }

  if (!Number.isFinite(distance) || distance <= 0 || distance > 100) {
    throw new Error('Le rayon de recherche doit être compris entre 0 et 100 km.');
  }

  const endpoint = API_ENDPOINTS?.places?.nearby;
  if (typeof endpoint !== 'function') {
    throw new Error('Endpoint des lieux à proximité introuvable.');
  }

  return apiGet(
    endpoint({ lat, lng, radius: distance }),
    token,
    { timeout: 27000, retries: 0 }
  );
};

export const getNearbyPlaces = getNearbyPlacesRequest;

export const getNearbyGroceries = async (params) => {
  const nearby = await getNearbyPlacesRequest(params);
  return {
    ...nearby,
    groceries: Array.isArray(nearby?.groceries) ? nearby.groceries : [],
  };
};
