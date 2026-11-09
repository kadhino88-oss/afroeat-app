import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  StatusBar,
  Linking,
  Platform,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../components/FadeInView';
import {
  getAllRestaurants,
  getNearbyRestaurants,
} from '../services/restaurantService';
import { getNearbyPlaces } from '../services/placeService';
import {
  DEFAULT_NEARBY_CENTER,
  DEFAULT_NEARBY_RADIUS,
  NEARBY_RADIUS_OPTIONS,
  loadNearbyRadius,
  normalizeNearbyRadius,
  saveNearbyRadius,
} from '../services/nearbySearchSettings';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

const mapComponents = Platform.OS === 'web'
  ? require('../components/AppMapView.web')
  : require('../components/AppMapView');
const MapView = mapComponents.default;
const { Marker, Callout } = mapComponents;

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const DEFAULT_REGION = {
  // AFROEAT's first public directory is focused on Annemasse and its nearby
  // towns. Keep this as a useful browsing area when a browser blocks GPS.
  latitude: DEFAULT_NEARBY_CENTER.latitude,
  longitude: DEFAULT_NEARBY_CENTER.longitude,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const withTimeout = (promise, timeoutMs, message) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isPublicDirectoryPlace = (place) =>
  place?.source === 'openstreetmap' || place?.source === 'public-directory';

const normalizeRole = (value) => {
  const normalized = String(value ?? 'client').trim().toLowerCase();

  if (normalized === 'restaurant' || normalized === 'resto') {
    return 'restaurant';
  }

  if (
    normalized === 'livreur' ||
    normalized === 'driver' ||
    normalized === 'delivery' ||
    normalized === 'courier'
  ) {
    return 'livreur';
  }

  if (
    normalized === 'admin' ||
    normalized === 'administrator' ||
    normalized === 'superadmin'
  ) {
    return 'admin';
  }

  return 'client';
};

const getRoleRedirect = (role) => {
  const normalized = normalizeRole(role);

  if (normalized === 'restaurant') {
    return '/restaurant/RestaurantDashboard';
  }

  if (normalized === 'livreur') {
    return '/livraison';
  }

  if (normalized === 'admin') {
    return '/admin';
  }

  return null;
};

const extractRestaurantsFromResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.restaurants) || Array.isArray(payload?.fastFoods)) {
    return [
      ...(Array.isArray(payload?.restaurants) ? payload.restaurants : []),
      ...(Array.isArray(payload?.fastFoods) ? payload.fastFoods : []),
    ];
  }
  if (Array.isArray(payload?.data?.restaurants)) return payload.data.restaurants;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const extractGroceriesFromResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.groceries)) return payload.groceries;
  if (Array.isArray(payload?.data?.groceries)) return payload.data.groceries;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const extractBusinessesFromResponse = (payload) => {
  if (Array.isArray(payload?.businesses)) return payload.businesses;
  if (Array.isArray(payload?.data?.businesses)) return payload.data.businesses;
  return [];
};

const getPublicPlaceRouteParams = (place) => ({
  id: place?.id || place?._id,
  source: place?.source,
  name: place?.name,
  category: place?.category,
  address: place?.address,
  cuisine: place?.cuisine,
  origin: place?.origin,
  city: place?.city,
  country: place?.country,
  distanceKm: place?.distanceKm == null ? '' : String(place.distanceKm),
  phone: place?.phone,
  email: place?.email,
  website: place?.website,
  menuUrl: place?.menuUrl,
  logoUrl: place?.logoUrl,
  imageUrl: place?.imageUrl,
  openingHours: place?.openingHours,
  description: place?.description,
  brand: place?.brand,
  operator: place?.operator,
  osmType: place?.osmType,
  osmId: place?.osmId,
  osmUrl: place?.osmUrl,
});

const normalizeRestaurant = (restaurant = {}) => {
  const latitude = normalizeNumber(
    restaurant?.latitude ??
      restaurant?.location?.latitude ??
      restaurant?.coords?.latitude
  );

  const longitude = normalizeNumber(
    restaurant?.longitude ??
      restaurant?.location?.longitude ??
      restaurant?.coords?.longitude
  );

  return {
    ...restaurant,
    _id: restaurant?._id || restaurant?.id || null,
    id: restaurant?.id || restaurant?._id || null,
    name: normalizeText(restaurant?.name, 'Restaurant africain'),
    cuisine: normalizeText(restaurant?.cuisine, 'Cuisine africaine'),
    address: normalizeText(restaurant?.address, 'Adresse non disponible'),
    latitude,
    longitude,
    hasValidCoordinates:
      typeof latitude === 'number' && typeof longitude === 'number',
  };
};

const normalizeGrocery = (grocery = {}, fallbackName = 'Épicerie') => {
  const latitude = normalizeNumber(
    grocery?.latitude ?? grocery?.location?.latitude
  );
  const longitude = normalizeNumber(
    grocery?.longitude ?? grocery?.location?.longitude
  );

  return {
    ...grocery,
    id: normalizeText(grocery?.id || grocery?._id),
    name: normalizeText(grocery?.name || grocery?.brand, fallbackName),
    address: normalizeText(grocery?.address),
    latitude,
    longitude,
    distanceKm: normalizeNumber(grocery?.distanceKm, null),
    hasValidCoordinates:
      typeof latitude === 'number' && typeof longitude === 'number',
  };
};

const getRestaurantRoute = (restaurantId) => {
  const safeId = normalizeText(restaurantId);
  return safeId ? `/restaurant/${safeId}` : null;
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 * Carte publique du bloc client / visiteur.
 * Les autres rôles authentifiés ne doivent pas rester ici.
 */

export default function MapScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);
  const user = auth.user ?? null;
  const currentRole = normalizeRole(auth.role || user?.role);
  const roleRedirect = !authLoading && isAuthenticated
    ? getRoleRedirect(currentRole)
    : null;

  const [location, setLocation] = useState(null);
  const [searchCenter, setSearchCenter] = useState({
    ...DEFAULT_NEARBY_CENTER,
  });
  const [usingDefaultArea, setUsingDefaultArea] = useState(false);
  const [selectedDistance, setSelectedDistance] = useState(DEFAULT_NEARBY_RADIUS);
  const [restaurants, setRestaurants] = useState([]);
  const [discoveredRestaurants, setDiscoveredRestaurants] = useState([]);
  const [groceries, setGroceries] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [nearbyPlacesLoading, setNearbyPlacesLoading] = useState(false);
  const [nearbyPlacesLoadFailed, setNearbyPlacesLoadFailed] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const nearbyPlacesRequestIdRef = useRef(0);

  const getUserLocation = useCallback(async () => {
    const fallBackToDefaultArea = () => {
      const fallback = {
        ...DEFAULT_NEARBY_CENTER,
      };
      setLocation(null);
      setSearchCenter(fallback);
      setUsingDefaultArea(true);
      return fallback;
    };

    try {
      const { status } = await withTimeout(
        Location.requestForegroundPermissionsAsync(),
        8000,
        'La demande de localisation a expiré.'
      );

      if (status !== 'granted') {
        return fallBackToDefaultArea();
      }

      const currentLocation = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        8000,
        'La position GPS n’a pas répondu à temps.'
      );

      const coords = currentLocation?.coords
        ? {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          }
        : null;

      if (!coords) return fallBackToDefaultArea();
      setLocation(coords);
      setSearchCenter(coords);
      setUsingDefaultArea(false);
      return coords;
    } catch (error) {
      console.log('Erreur GPS :', error);
      return fallBackToDefaultArea();
    }
  }, []);

  const fetchNearbyPlaces = useCallback(async (coords, radiusKm) => {
    const requestId = ++nearbyPlacesRequestIdRef.current;

    if (!coords) {
      setNearbyPlacesLoading(false);
      setDiscoveredRestaurants([]);
      setGroceries([]);
      setBusinesses([]);
      setNearbyPlacesLoadFailed(false);
      try {
        // Keep the saved restaurant locations visible if GPS permission is off.
        const data = await getAllRestaurants();
        setRestaurants(
          extractRestaurantsFromResponse(data)
            .map(normalizeRestaurant)
            .filter((item) => item?._id && item.hasValidCoordinates)
        );
      } catch (error) {
        console.log('Erreur restaurants sans position GPS :', error);
        setRestaurants([]);
      }
      return;
    }

    setNearbyPlacesLoading(true);
    setNearbyPlacesLoadFailed(false);
    setRestaurants([]);
    setDiscoveredRestaurants([]);
    setGroceries([]);
    setBusinesses([]);

    const partnerRestaurantsPromise = getNearbyRestaurants({
        latitude: coords.latitude,
        longitude: coords.longitude,
        maxDistance: radiusKm,
      });

    // The map is shown as soon as the AFROEAT directory returns. Public
    // OpenStreetMap discovery continues in the background so an overloaded
    // upstream service cannot hold the whole screen behind a spinner.
    getNearbyPlaces({
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius: radiusKm,
      })
      .then((payload) => {
        if (nearbyPlacesRequestIdRef.current !== requestId) return;

        setDiscoveredRestaurants(
          extractRestaurantsFromResponse(payload)
            .map((restaurant) => ({
              ...normalizeRestaurant(restaurant),
              source: restaurant?.source || 'openstreetmap',
            }))
            .filter((item) => item?.id && item.hasValidCoordinates)
        );
        setGroceries(
          extractGroceriesFromResponse(payload)
            .map((grocery) => normalizeGrocery(grocery, t('map.groceryLabel')))
            .filter((item) => item?.id && item.hasValidCoordinates)
        );
        setBusinesses(
          extractBusinessesFromResponse(payload)
            .map((business) => normalizeGrocery(business, t('map.africanBusinessLabel')))
            .filter((item) => item?.id && item.hasValidCoordinates)
        );
        setNearbyPlacesLoadFailed(false);
      })
      .catch((error) => {
        if (nearbyPlacesRequestIdRef.current !== requestId) return;
        console.log('Erreur lieux à proximité :', error);
        setNearbyPlacesLoadFailed(true);
      })
      .finally(() => {
        if (nearbyPlacesRequestIdRef.current === requestId) {
          setNearbyPlacesLoading(false);
        }
      });

    try {
      const partnerRestaurants = await partnerRestaurantsPromise;
      if (nearbyPlacesRequestIdRef.current !== requestId) return;
      setRestaurants(
        extractRestaurantsFromResponse(partnerRestaurants)
          .map(normalizeRestaurant)
          .filter((item) => item?._id && item.hasValidCoordinates)
      );
    } catch (error) {
      if (nearbyPlacesRequestIdRef.current !== requestId) return;
      console.log('Erreur restaurants AFROEAT à proximité :', error);
      setRestaurants([]);
    }
  }, [t]);

  const initializeMap = useCallback(async () => {
    try {
      setLoading(true);
      const radiusKm = await loadNearbyRadius();
      setSelectedDistance(radiusKm);
      const coords = await getUserLocation();
      await fetchNearbyPlaces(coords, radiusKm);
    } finally {
      setLoading(false);
    }
  }, [getUserLocation, fetchNearbyPlaces]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const coords = await getUserLocation();
      await fetchNearbyPlaces(coords, selectedDistance);
    } finally {
      setRefreshing(false);
    }
  }, [getUserLocation, fetchNearbyPlaces, selectedDistance]);

  const handleDistanceChange = useCallback(async (radiusKm) => {
    if (radiusKm === selectedDistance) return;

    const safeRadius = normalizeNearbyRadius(radiusKm);
    setSelectedDistance(safeRadius);
    saveNearbyRadius(safeRadius);
    setRefreshing(true);
    try {
      await fetchNearbyPlaces(searchCenter, safeRadius);
    } finally {
      setRefreshing(false);
    }
  }, [fetchNearbyPlaces, searchCenter, selectedDistance]);

  useEffect(() => {
    if (roleRedirect) return undefined;

    initializeMap();
    return () => {
      nearbyPlacesRequestIdRef.current += 1;
    };
  }, [initializeMap, roleRedirect]);

  const geoRestaurants = useMemo(() => {
    return [...restaurants, ...discoveredRestaurants].filter(
      (restaurant) => restaurant?.hasValidCoordinates
    );
  }, [restaurants, discoveredRestaurants]);

  const geoGroceries = useMemo(() => {
    return groceries.filter((grocery) => grocery?.hasValidCoordinates);
  }, [groceries]);

  const geoBusinesses = useMemo(() => {
    return businesses.filter((business) => business?.hasValidCoordinates);
  }, [businesses]);

  const visibleRestaurants =
    activeFilter === 'all' || activeFilter === 'restaurants'
      ? geoRestaurants
      : [];
  const visibleGroceries =
    activeFilter === 'all' || activeFilter === 'groceries'
      ? geoGroceries
      : [];
  const visibleBusinesses =
    activeFilter === 'all' || activeFilter === 'businesses'
      ? geoBusinesses
      : [];

  const mapRegion = useMemo(() => {
    if (
      typeof searchCenter?.latitude === 'number' &&
      typeof searchCenter?.longitude === 'number'
    ) {
      const latitudeDelta = (selectedDistance * 2.4) / 111;
      const longitudeDelta = latitudeDelta / Math.max(
        Math.cos((searchCenter.latitude * Math.PI) / 180),
        0.25
      );
      return {
        latitude: searchCenter.latitude,
        longitude: searchCenter.longitude,
        latitudeDelta,
        longitudeDelta,
      };
    }

    if (geoRestaurants.length > 0) {
      return {
        latitude: geoRestaurants[0].latitude,
        longitude: geoRestaurants[0].longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }

    if (geoGroceries.length > 0) {
      return {
        latitude: geoGroceries[0].latitude,
        longitude: geoGroceries[0].longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }

    if (geoBusinesses.length > 0) {
      return {
        latitude: geoBusinesses[0].latitude,
        longitude: geoBusinesses[0].longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }

    return DEFAULT_REGION;
  }, [searchCenter, selectedDistance, geoRestaurants, geoGroceries, geoBusinesses]);

  const openDirectoryPlace = useCallback((place) => {
    router.push({
      pathname: '/place/[id]',
      params: getPublicPlaceRouteParams(place),
    });
  }, []);

  const openGrocery = useCallback((grocery) => {
    if (['openstreetmap', 'public-directory'].includes(grocery?.source)) {
      openDirectoryPlace(grocery);
      return;
    }
    const osmType = String(grocery?.osmType || '').trim();
    const osmId = String(grocery?.osmId || '').trim();
    if (!['node', 'way', 'relation'].includes(osmType) || !osmId) return;

    Linking.openURL(
      `https://www.openstreetmap.org/${osmType}/${encodeURIComponent(osmId)}`
    ).catch((error) => console.log('Impossible d’ouvrir OpenStreetMap :', error));
  }, [openDirectoryPlace]);

  const openRestaurant = useCallback((restaurant) => {
    if (['openstreetmap', 'public-directory'].includes(restaurant?.source)) {
      openDirectoryPlace(restaurant);
      return;
    }

    const restaurantId = restaurant?._id || restaurant?.id;
    const route = getRestaurantRoute(restaurantId);
    if (!route) return;

    router.push(route);
  }, [openDirectoryPlace]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/explore');
  }, []);

  if (roleRedirect) {
    return <Redirect href={roleRedirect} />;
  }

  if (loading || authLoading) {
    return (
      <View style={styles.loaderContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <ActivityIndicator size="large" color="#EAB02F" />
        <Text style={styles.loaderText}>{t('map.loading')}</Text>
      </View>
    );
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('checkout.back')}
          style={({ pressed }) => [
            styles.topButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleBack}
        >
          <Ionicons name="arrow-back" size={20} color="#0D1C11" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.refreshMap')}
          style={({ pressed }) => [
            styles.topButton,
            pressed && !refreshing && styles.buttonPressed,
          ]}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#0D1C11" />
          ) : (
            <Ionicons name="refresh-outline" size={20} color="#0D1C11" />
          )}
        </Pressable>
      </View>

      <View style={styles.headerCard}>
        <Text style={styles.title}>{t('map.title')}</Text>
        <Text style={styles.subtitle}>
          {t(usingDefaultArea ? 'map.defaultAreaSubtitle' : 'map.subtitle', {
            distance: selectedDistance,
          })}
        </Text>
      </View>

      <View style={styles.filterBar}>
        {[
          { id: 'all', label: t('map.allPlaces') },
          { id: 'restaurants', label: t('map.restaurants') },
          { id: 'groceries', label: t('map.groceries') },
          { id: 'businesses', label: t('map.africanBusinesses') },
        ].map((filter) => (
          <Pressable
            key={filter.id}
            accessibilityRole="button"
            accessibilityState={{ selected: activeFilter === filter.id }}
            onPress={() => setActiveFilter(filter.id)}
            style={({ pressed }) => [
              styles.filterChip,
              activeFilter === filter.id && styles.filterChipActive,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === filter.id && styles.filterTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.distanceBar}>
        <Text style={styles.distanceLabel}>{t('map.distance')}</Text>
        <View style={styles.distanceOptions}>
          {NEARBY_RADIUS_OPTIONS.map((distance) => (
            <Pressable
              key={distance}
              accessibilityRole="button"
              accessibilityLabel={t('map.distanceOption', { distance })}
              accessibilityState={{ selected: selectedDistance === distance }}
              onPress={() => handleDistanceChange(distance)}
              style={({ pressed }) => [
                styles.distanceChip,
                selectedDistance === distance && styles.distanceChipActive,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text
                style={[
                  styles.distanceText,
                  selectedDistance === distance && styles.distanceTextActive,
                ]}
              >
                {distance} km
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.mapWrapper}>
        <MapView
          key={`${selectedDistance}:${searchCenter.latitude.toFixed(3)}:${searchCenter.longitude.toFixed(3)}`}
          style={styles.map}
          showsUserLocation={!!location}
          showsMyLocationButton
          initialRegion={mapRegion}
        >
          {visibleRestaurants.map((restaurant) => (
            <Marker
              key={restaurant._id}
              coordinate={{
                latitude: restaurant.latitude,
                longitude: restaurant.longitude,
              }}
              pinColor="#C8331A"
            >
              <Callout tooltip onPress={() => openRestaurant(restaurant)}>
                <View style={styles.calloutCard}>
                  <Text style={styles.calloutTitle}>{restaurant.name}</Text>
                  <Text style={styles.calloutSubtitle}>
                    {restaurant.source === 'openstreetmap'
                      ? normalizeText(restaurant.cuisine, t('map.restaurantDirectoryLabel'))
                      : restaurant.cuisine}
                  </Text>
                  <Text style={styles.calloutAddress}>{restaurant.address}</Text>
                  <View style={styles.calloutButton}>
                    <Text style={styles.calloutButtonText}>
                      {isPublicDirectoryPlace(restaurant)
                        ? t('publicPlace.openDetails')
                        : t('map.viewMenu')}
                    </Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          ))}

          {visibleGroceries.map((grocery) => (
            <Marker
              key={grocery.id}
              coordinate={{
                latitude: grocery.latitude,
                longitude: grocery.longitude,
              }}
              pinColor="#32855A"
            >
              <Callout tooltip onPress={() => openGrocery(grocery)}>
                <View style={styles.calloutCard}>
                  <Text style={styles.calloutTitle}>{grocery.name}</Text>
                  <Text style={styles.groceryCalloutSubtitle}>
                    {t('map.groceryLabel')}
                    {grocery.distanceKm !== null
                      ? ` · ${grocery.distanceKm.toFixed(1)} km`
                      : ''}
                  </Text>
                  {grocery.address ? (
                    <Text style={styles.calloutAddress}>{grocery.address}</Text>
                  ) : null}
                  <View style={styles.groceryCalloutButton}>
                    <Text style={styles.calloutButtonText}>
                      {t('publicPlace.openDetails')}
                    </Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          ))}

          {visibleBusinesses.map((business) => (
            <Marker
              key={business.id}
              coordinate={{
                latitude: business.latitude,
                longitude: business.longitude,
              }}
              pinColor="#7651A8"
            >
              <Callout tooltip onPress={() => openGrocery(business)}>
                <View style={styles.calloutCard}>
                  <Text style={styles.calloutTitle}>{business.name}</Text>
                  <Text style={styles.groceryCalloutSubtitle}>
                    {t('map.africanBusinessLabel')}
                    {business.distanceKm !== null
                      ? ` · ${business.distanceKm.toFixed(1)} km`
                      : ''}
                  </Text>
                  {business.address ? (
                    <Text style={styles.calloutAddress}>{business.address}</Text>
                  ) : null}
                  <View style={styles.groceryCalloutButton}>
                    <Text style={styles.calloutButtonText}>
                      {t('publicPlace.openDetails')}
                    </Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>

        {visibleRestaurants.length === 0 &&
          visibleGroceries.length === 0 &&
          visibleBusinesses.length === 0 && (
          <View style={styles.mapOverlayEmpty}>
            {nearbyPlacesLoading ? (
              <ActivityIndicator size="large" color="#EAB02F" />
            ) : (
              <Ionicons name="storefront-outline" size={42} color="#C9B8A3" />
            )}
            <Text style={styles.mapOverlayTitle}>
              {nearbyPlacesLoading ? t('map.loading') : t('map.noNearbyPlaces')}
            </Text>
            {!nearbyPlacesLoading ? (
              <Text style={styles.mapOverlayText}>
                {t('map.noNearbyPlacesText', { distance: selectedDistance })}
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.footerInfo}>
        <View style={styles.footerCount}>
          <View style={[styles.legendDot, styles.restaurantDot]} />
          <Text style={styles.footerTitle}>{t('map.restaurants')}</Text>
          <Text style={styles.footerValue}>{geoRestaurants.length}</Text>
        </View>
        <View style={styles.footerCount}>
          <View style={[styles.legendDot, styles.groceryDot]} />
          <Text style={styles.footerTitle}>{t('map.groceries')}</Text>
          <Text style={[styles.footerValue, styles.groceryCount]}>
            {geoGroceries.length}
          </Text>
        </View>
        <View style={styles.footerCount}>
          <View style={[styles.legendDot, styles.businessDot]} />
          <Text style={styles.footerTitle}>{t('map.africanBusinesses')}</Text>
          <Text style={[styles.footerValue, styles.businessCount]}>
            {geoBusinesses.length}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="link"
        onPress={() =>
          Linking.openURL('https://www.openstreetmap.org/copyright').catch(
            (error) => console.log('Impossible d’ouvrir l’attribution OSM :', error)
          )
        }
      >
        <Text style={styles.attribution}>{t('map.osmAttribution')}</Text>
      </Pressable>
      {nearbyPlacesLoadFailed ? (
        <Text style={styles.groceryError}>{t('map.nearbyLoadError')}</Text>
      ) : null}
    </FadeInView>
  );
}

/**
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF6EC',
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    alignItems: 'center',
  },

  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0D1C11',
    textAlign: 'center',
    marginBottom: 8,
  },

  subtitle: {
    textAlign: 'center',
    color: '#777777',
    fontSize: 14,
    lineHeight: 20,
  },

  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },

  distanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },

  distanceLabel: {
    color: '#555555',
    fontSize: 12,
    fontWeight: '800',
  },

  distanceOptions: {
    flexDirection: 'row',
    gap: 7,
  },

  distanceChip: {
    minWidth: 53,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DED2',
  },

  distanceChipActive: {
    backgroundColor: '#EAB02F',
    borderColor: '#EAB02F',
  },

  distanceText: {
    color: '#555555',
    fontSize: 12,
    fontWeight: '800',
  },

  distanceTextActive: {
    color: '#FFFFFF',
  },

  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DED2',
  },

  filterChipActive: {
    backgroundColor: '#0D1C11',
    borderColor: '#0D1C11',
  },

  filterText: {
    color: '#555555',
    fontSize: 12,
    fontWeight: '700',
  },

  filterTextActive: {
    color: '#FFFFFF',
  },

  mapWrapper: {
    flex: 1,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#EDE7DD',
    position: 'relative',
  },

  map: {
    flex: 1,
  },

  mapOverlayEmpty: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
  },

  mapOverlayTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '800',
    color: '#0D1C11',
    textAlign: 'center',
  },

  mapOverlayText: {
    marginTop: 8,
    fontSize: 14,
    color: '#777777',
    lineHeight: 20,
    textAlign: 'center',
  },

  footerInfo: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  footerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    justifyContent: 'center',
  },

  footerTitle: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '700',
    flexShrink: 1,
  },

  footerValue: {
    fontSize: 15,
    color: '#C8331A',
    fontWeight: '900',
  },

  groceryCount: {
    color: '#32855A',
  },

  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },

  restaurantDot: {
    backgroundColor: '#084424',
  },

  groceryDot: {
    backgroundColor: '#32855A',
  },

  businessDot: {
    backgroundColor: '#7651A8',
  },

  businessCount: {
    color: '#7651A8',
  },

  attribution: {
    color: '#777777',
    fontSize: 10,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginTop: 5,
  },

  groceryError: {
    color: '#8A5146',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 3,
  },

  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBF6EC',
  },

  loaderText: {
    marginTop: 12,
    color: '#666666',
    fontSize: 15,
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0D1C11',
    marginTop: 16,
    marginBottom: 8,
  },

  emptyText: {
    textAlign: 'center',
    color: '#777777',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },

  retryButton: {
    backgroundColor: '#EAB02F',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },

  retryButtonText: {
    color: '#0D1C11',
    fontWeight: '800',
    fontSize: 15,
  },

  calloutCard: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },

  calloutTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D1C11',
    marginBottom: 4,
  },

  calloutSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C8331A',
    marginBottom: 6,
  },

  groceryCalloutSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#32855A',
    marginBottom: 6,
  },

  groceryCalloutButton: {
    backgroundColor: '#DCEEE3',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },

  calloutAddress: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 10,
    lineHeight: 18,
  },

  calloutButton: {
    backgroundColor: '#EAB02F',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },

  calloutButtonText: {
    color: '#0D1C11',
    fontWeight: '800',
    fontSize: 13,
  },

  buttonPressed: {
    opacity: 0.84,
  },
});
