import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Pressable,
  StatusBar,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import MapView, { Marker, Callout } from '../components/AppMapView';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../components/FadeInView';
import { getAllRestaurants } from '../services/restaurantService';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const DEFAULT_REGION = {
  latitude: 48.8566,
  longitude: 2.3522,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

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
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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
  if (Array.isArray(payload?.restaurants)) return payload.restaurants;
  if (Array.isArray(payload?.data?.restaurants)) return payload.data.restaurants;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

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

  const [location, setLocation] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * =========================================================
   * ROLE GATE
   * =========================================================
   */

  if (!authLoading && isAuthenticated) {
    const roleRedirect = getRoleRedirect(currentRole);

    if (roleRedirect) {
      return <Redirect href={roleRedirect} />;
    }
  }

  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Localisation refusée',
          'Active la localisation pour voir les restaurants autour de toi.'
        );
        return null;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = currentLocation?.coords
        ? {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          }
        : null;

      setLocation(coords);
      return coords;
    } catch (error) {
      console.log('Erreur GPS :', error);
      return null;
    }
  }, []);

  const fetchRestaurants = useCallback(async () => {
    try {
      const data = await getAllRestaurants();
      const extracted = extractRestaurantsFromResponse(data);
      const safeRestaurants = Array.isArray(extracted) ? extracted : [];

      setRestaurants(
        safeRestaurants.map(normalizeRestaurant).filter((item) => item?._id)
      );
    } catch (error) {
      console.log('Erreur restaurants :', error);
      setRestaurants([]);
    }
  }, []);

  const initializeMap = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([getUserLocation(), fetchRestaurants()]);
    } finally {
      setLoading(false);
    }
  }, [getUserLocation, fetchRestaurants]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([getUserLocation(), fetchRestaurants()]);
    } finally {
      setRefreshing(false);
    }
  }, [getUserLocation, fetchRestaurants]);

  useEffect(() => {
    initializeMap();
  }, [initializeMap]);

  const geoRestaurants = useMemo(() => {
    return restaurants.filter((restaurant) => restaurant?.hasValidCoordinates);
  }, [restaurants]);

  const mapRegion = useMemo(() => {
    if (
      typeof location?.latitude === 'number' &&
      typeof location?.longitude === 'number'
    ) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
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

    return DEFAULT_REGION;
  }, [location, geoRestaurants]);

  const openRestaurant = useCallback((restaurantId) => {
    const route = getRestaurantRoute(restaurantId);
    if (!route) return;

    router.push(route);
  }, []);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/explore');
  }, []);

  if (loading || authLoading) {
    return (
      <View style={styles.loaderContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#D4A017" />
        <Text style={styles.loaderText}>{t('map.loading')}</Text>
      </View>
    );
  }

  if (!location && geoRestaurants.length === 0) {
    return (
      <FadeInView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

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
            <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
          </Pressable>
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="location-outline" size={56} color="#C9B8A3" />
          <Text style={styles.emptyTitle}>{t('map.locationUnavailable')}</Text>
          <Text style={styles.emptyText}>
            {t('map.locationUnavailableText')}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('map.retryLoadingMap')}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleRefresh}
          >
            <Text style={styles.retryButtonText}>{t('restaurant.retry')}</Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

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
          <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
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
            <ActivityIndicator size="small" color="#1E1E1E" />
          ) : (
            <Ionicons name="refresh-outline" size={20} color="#1E1E1E" />
          )}
        </Pressable>
      </View>

      <View style={styles.headerCard}>
        <Text style={styles.title}>{t('map.title')}</Text>
        <Text style={styles.subtitle}>
          {t('map.subtitle')}
        </Text>
      </View>

      <View style={styles.mapWrapper}>
        <MapView
          style={styles.map}
          showsUserLocation={!!location}
          showsMyLocationButton
          initialRegion={mapRegion}
        >
          {geoRestaurants.map((restaurant) => (
            <Marker
              key={restaurant._id}
              coordinate={{
                latitude: restaurant.latitude,
                longitude: restaurant.longitude,
              }}
              pinColor="#D96C2D"
            >
              <Callout tooltip onPress={() => openRestaurant(restaurant._id)}>
                <View style={styles.calloutCard}>
                  <Text style={styles.calloutTitle}>{restaurant.name}</Text>
                  <Text style={styles.calloutSubtitle}>{restaurant.cuisine}</Text>
                  <Text style={styles.calloutAddress}>{restaurant.address}</Text>
                  <View style={styles.calloutButton}>
                    <Text style={styles.calloutButtonText}>{t('map.viewMenu')}</Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>

        {geoRestaurants.length === 0 && (
          <View style={styles.mapOverlayEmpty}>
            <Ionicons name="storefront-outline" size={42} color="#C9B8A3" />
            <Text style={styles.mapOverlayTitle}>{t('map.noGeoRestaurants')}</Text>
            <Text style={styles.mapOverlayText}>
              {t('map.noGeoRestaurantsText')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footerInfo}>
        <Text style={styles.footerTitle}>{t('map.detectedRestaurants')}</Text>
        <Text style={styles.footerValue}>{geoRestaurants.length}</Text>
      </View>
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
    backgroundColor: '#FFF8F0',
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
    color: '#1E1E1E',
    textAlign: 'center',
    marginBottom: 8,
  },

  subtitle: {
    textAlign: 'center',
    color: '#777777',
    fontSize: 14,
    lineHeight: 20,
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
    color: '#1E1E1E',
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
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  footerTitle: {
    fontSize: 15,
    color: '#666666',
    fontWeight: '700',
  },

  footerValue: {
    fontSize: 20,
    color: '#D96C2D',
    fontWeight: '900',
  },

  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
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
    color: '#1E1E1E',
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
    backgroundColor: '#D4A017',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },

  retryButtonText: {
    color: '#1E1E1E',
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
    color: '#1E1E1E',
    marginBottom: 4,
  },

  calloutSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D96C2D',
    marginBottom: 6,
  },

  calloutAddress: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 10,
    lineHeight: 18,
  },

  calloutButton: {
    backgroundColor: '#D4A017',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },

  calloutButtonText: {
    color: '#1E1E1E',
    fontWeight: '800',
    fontSize: 13,
  },

  buttonPressed: {
    opacity: 0.84,
  },
});