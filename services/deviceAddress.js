import * as Location from 'expo-location';

/** Met en forme une adresse issue du géocodage inverse : « Rue du Rhône 42, Genève ». */
export const formatDeviceAddress = (place) => {
  if (!place) return '';
  const street = [place.street || place.name, place.streetNumber]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
  const city = String(place.city || place.subregion || place.region || '').trim();
  return [street, city].filter(Boolean).join(', ');
};

/**
 * Adresse approximative de l'appareil (sans jamais demander la permission ici :
 * on ne l'utilise que si la localisation a déjà été autorisée).
 * Retourne '' si indisponible (web, refus, erreur).
 */
export const getDeviceAddress = async () => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return '';

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const places = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    return formatDeviceAddress(places?.[0]);
  } catch {
    return '';
  }
};
