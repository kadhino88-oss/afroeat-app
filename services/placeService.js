import { apiGet } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';
import { NEARBY_RADIUS_OPTIONS } from './nearbySearchSettings';

export const MAX_NEARBY_PLACES = 2000;

const validateParams = ({ latitude, longitude, radius = 10 }) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const distance = Number(radius);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Coordonnées invalides pour les lieux à proximité.');
  }

  if (!Number.isFinite(distance) || distance <= 0 || distance > 100) {
    throw new Error('Le rayon de recherche doit être compris entre 0 et 100 km.');
  }

  return { lat, lng, distance };
};

const request = (endpointName, { latitude, longitude, radius = 10, token = null }) => {
  const { lat, lng, distance } = validateParams({ latitude, longitude, radius });
  const endpoint = API_ENDPOINTS?.places?.[endpointName];
  if (typeof endpoint !== 'function') {
    throw new Error('Endpoint des lieux à proximité introuvable.');
  }

  return apiGet(
    endpoint({ lat, lng, radius: distance, limit: MAX_NEARBY_PLACES }),
    token,
    { timeout: 27000, retries: 0 }
  );
};

const list = (value) => (Array.isArray(value) ? value : []);

// Restaurants, fast-foods ET épiceries/commerces africains autour de soi, quel que soit le rayon.
export const getNearbyPlaces = async (params) => {
  validateParams(params);

  const [placesResult, groceriesResult] = await Promise.allSettled([
    request('nearby', params),
    request('groceriesNearby', params),
  ]);

  if (placesResult.status === 'rejected' && groceriesResult.status === 'rejected') {
    throw placesResult.reason;
  }

  const places = placesResult.status === 'fulfilled' ? placesResult.value : {};
  const groceries = groceriesResult.status === 'fulfilled' ? groceriesResult.value : {};

  return {
    ...places,
    restaurants: list(places?.restaurants),
    fastFoods: list(places?.fastFoods),
    groceries: list(groceries?.groceries).length
      ? list(groceries.groceries)
      : list(places?.groceries),
    businesses: list(places?.businesses),
    total: Number(places?.total || 0) + Number(groceries?.total || 0),
    hasMore: Boolean(places?.hasMore || groceries?.hasMore),
  };
};

export const getNearbyGroceries = async (params) => {
  const payload = await request('groceriesNearby', params);
  return { ...payload, groceries: list(payload?.groceries) };
};

export const MIN_ADAPTIVE_RESULTS = 10;

const countPlaces = (payload) =>
  list(payload?.restaurants).length +
  list(payload?.fastFoods).length +
  list(payload?.groceries).length +
  list(payload?.businesses).length;

// Façon « Uber Eats » : si la zone choisie compte trop peu de résultats,
// on élargit automatiquement au rayon suivant (jusqu'à 100 km).
export const getNearbyPlacesAdaptive = async (params, minResults = MIN_ADAPTIVE_RESULTS) => {
  const requested = Number(params?.radius) || 10;
  const radii = NEARBY_RADIUS_OPTIONS.filter((km) => km >= requested);
  if (radii.length === 0) radii.push(requested);

  let payload = null;
  let usedRadius = radii[0];

  for (const radius of radii) {
    payload = await getNearbyPlaces({ ...params, radius });
    usedRadius = radius;
    if (countPlaces(payload) >= minResults) break;
  }

  return { ...payload, effectiveRadius: usedRadius, expanded: usedRadius > requested };
};
