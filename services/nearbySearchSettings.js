import AsyncStorage from '@react-native-async-storage/async-storage';

export const NEARBY_RADIUS_OPTIONS = [5, 10, 20, 30, 50, 100];
export const DEFAULT_NEARBY_RADIUS = 10;
export const DEFAULT_NEARBY_CENTER = {
  latitude: 46.195,
  longitude: 6.235,
};

const RADIUS_STORAGE_KEY = 'afroeat.nearby-search-radius-km';

export const normalizeNearbyRadius = (value, fallback = DEFAULT_NEARBY_RADIUS) => {
  const radius = Number(value);
  return NEARBY_RADIUS_OPTIONS.includes(radius) ? radius : fallback;
};

export const loadNearbyRadius = async () => {
  try {
    return normalizeNearbyRadius(await AsyncStorage.getItem(RADIUS_STORAGE_KEY));
  } catch (error) {
    console.log('Distance de recherche indisponible :', error);
    return DEFAULT_NEARBY_RADIUS;
  }
};

export const saveNearbyRadius = async (value) => {
  const radius = normalizeNearbyRadius(value);
  try {
    await AsyncStorage.setItem(RADIUS_STORAGE_KEY, String(radius));
  } catch (error) {
    console.log('Impossible de mémoriser la distance de recherche :', error);
  }
  return radius;
};
