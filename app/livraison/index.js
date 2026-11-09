import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  StatusBar,
  Linking,
} from 'react-native';
import { router, useFocusEffect, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { useTranslation } from 'react-i18next';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import {
  getAssignedOrders,
  updateDeliveryStatus,
  getNextDeliveryStatus,
  canDriverUpdateStatus,
  updateDriverLocation,
} from '../../services/deliveryService';

/**
 * CONSTANTS
 */

const LIVE_REFRESH_MS = 12000;
const LOCATION_PUSH_MS = 15000;
const EMPTY_AUTH = Object.freeze({});
const EMPTY_ORDERS = Object.freeze([]);

/**
 * HELPERS
 */

const normalizeRole = (v) => String(v || '').trim().toLowerCase();

const normalizeStatus = (v) => String(v || '').trim().toLowerCase();

const isDriverRole = (role) =>
  role === 'livreur' || role === 'driver' || role === 'delivery';

const getDriverStatus = (user, auth) =>
  normalizeStatus(
    user?.status ||
      user?.approvalStatus ||
      user?.driverStatus ||
      auth?.status ||
      ''
  );

const normalizeNumber = (v, f = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : f;
};

const formatPrice = (v, c = 'EUR', locale = 'fr') => {
  const amount = normalizeNumber(v);
  const currency = String(c || 'EUR').toUpperCase();

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
    }).format(amount)} ${currency}`;
  }
};

const getItemsCount = (items = []) =>
  items.reduce((sum, i) => sum + normalizeNumber(i?.quantity), 0);

const DELIVERY_STATUS_SLUG = {
  'Confirmée': 'confirmed',
  'En préparation': 'preparing',
  'En livraison': 'delivering',
  'Livrée': 'delivered',
};

/**
 * SCREEN
 */

export default function LivreurDashboardScreen() {
  const { t, i18n } = useTranslation();
  const auth = useAuth() || EMPTY_AUTH;

  const user = auth.user ?? null;
  const role = auth.role;
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);

  const currentRole = useMemo(
    () => normalizeRole(role || user?.role),
    [role, user]
  );

  const currentStatus = useMemo(
    () => getDriverStatus(user, auth),
    [user, auth]
  );

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [locationPermissionNeeded, setLocationPermissionNeeded] = useState(false);

  const liveTimer = useRef(null);
  const gpsTimer = useRef(null);
  const requestIdRef = useRef(0);
  const hasLoadedOrdersRef = useRef(false);
  const locationPermissionRequestedRef = useRef(false);
  const locationUpdateInFlightRef = useRef(false);

  const safeOrders = Array.isArray(orders) ? orders : EMPTY_ORDERS;

  const activeOrder = useMemo(() => {
    return safeOrders.find((o) => o.status === 'En livraison') || null;
  }, [safeOrders]);

  /**
   * FETCH
   */

  const fetchOrders = useCallback(async (manual = false) => {
    const requestId = ++requestIdRef.current;

    if (!isAuthenticated || !token || !isDriverRole(currentRole)) {
      setOrders([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (manual || hasLoadedOrdersRef.current) setRefreshing(true);
      else setLoading(true);
      setLoadError('');

      const data = await getAssignedOrders(token);
      if (requestId === requestIdRef.current) {
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.log(e);
      if (requestId === requestIdRef.current) {
        setLoadError(t('livraison.loadErrorBody'));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
        hasLoadedOrdersRef.current = true;
      }
    }
  }, [token, currentRole, isAuthenticated, t]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders(false);

      if (!liveTimer.current) {
        liveTimer.current = setInterval(() => fetchOrders(true), LIVE_REFRESH_MS);
      }

      return () => {
        clearInterval(liveTimer.current);
        liveTimer.current = null;
      };
    }, [fetchOrders])
  );

  /**
   * GPS
   */

  const syncLocation = useCallback(async () => {
    if (
      !activeOrder?._id ||
      !token ||
      locationUpdateInFlightRef.current
    ) {
      return;
    }

    locationUpdateInFlightRef.current = true;

    try {
      let permission = await Location.getForegroundPermissionsAsync();

      if (permission.status !== 'granted' && permission.canAskAgain) {
        if (!locationPermissionRequestedRef.current) {
          locationPermissionRequestedRef.current = true;
          permission = await Location.requestForegroundPermissionsAsync();
        }
      }

      if (permission.status !== 'granted') {
        setLocationPermissionNeeded(true);
        return;
      }

      setLocationPermissionNeeded(false);

      const loc = await Location.getCurrentPositionAsync({});
      const coords = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      };

      await updateDriverLocation(activeOrder._id, coords, token);
    } catch (e) {
      console.log(e);
    } finally {
      locationUpdateInFlightRef.current = false;
    }
  }, [activeOrder, token]);

  useFocusEffect(
    useCallback(() => {
      if (!activeOrder?._id) return;

      syncLocation();

      if (!gpsTimer.current) {
        gpsTimer.current = setInterval(syncLocation, LOCATION_PUSH_MS);
      }

      return () => {
        clearInterval(gpsTimer.current);
        gpsTimer.current = null;
      };
    }, [syncLocation, activeOrder])
  );

  /**
   * UPDATE STATUS
   */

  const updateStatus = async (order) => {
    const next = getNextDeliveryStatus(order?.status);
    if (!next) return;

    try {
      setUpdatingId(order._id);

      const updated = await updateDeliveryStatus(order._id, next, token);
      setLoadError('');

      setOrders((prev) =>
        prev.map((o) =>
          o._id === order._id ? updated || { ...o, status: next } : o
        )
      );
    } catch (_error) {
      Alert.alert(t('livraison.updateErrorTitle'), t('livraison.updateErrorBody'));
    } finally {
      setUpdatingId(null);
    }
  };

  /**
   * GUARDS
   */

  if (authLoading || loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#C8331A" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login?role=livreur" />;
  }

  if (!isDriverRole(currentRole)) {
    if (currentRole === 'restaurant') {
      return <Redirect href="/restaurant/RestaurantDashboard" />;
    }
    if (currentRole === 'admin') {
      return <Redirect href="/admin" />;
    }
    return <Redirect href="/(tabs)/index" />;
  }

  if (currentStatus === 'pending') {
    return <Redirect href="/auth/pending-approval?role=livreur" />;
  }

  /**
   * RENDER
   */

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        data={safeOrders}
        keyExtractor={(i) => i._id}
        refreshing={refreshing}
        onRefresh={() => fetchOrders(true)}
        ListHeaderComponent={
          <View>
            {!!loadError && (
              <View style={styles.errorBanner}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={17}
                  color="#9A3412"
                />
                <Text style={styles.errorText}>{loadError}</Text>
                <Pressable
                  onPress={() => fetchOrders(true)}
                  disabled={refreshing}
                  accessibilityRole="button"
                  accessibilityLabel={t('restaurant.retry')}
                >
                  {refreshing ? (
                    <ActivityIndicator size="small" color="#084424" />
                  ) : (
                    <Text style={styles.retryText}>{t('restaurant.retry')}</Text>
                  )}
                </Pressable>
              </View>
            )}

            {activeOrder && locationPermissionNeeded && (
              <View style={styles.locationNotice}>
                <Ionicons name="location-outline" size={18} color="#9A3412" />
                <Text style={styles.locationNoticeText}>
                  {t('livraison.locationPermissionUnavailable')}
                </Text>
                <Pressable
                  onPress={() => Linking.openSettings()}
                  accessibilityRole="button"
                  accessibilityLabel={t('livraison.openLocationSettings')}
                >
                  <Text style={styles.retryText}>
                    {t('livraison.openLocationSettings')}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loadError ? (
            <View style={styles.emptyState}>
              <Ionicons name="bicycle-outline" size={42} color="#C9B8A3" />
              <Text style={styles.emptyTitle}>{t('livraison.noDeliveries')}</Text>
              <Text style={styles.emptyText}>
                {t('livraison.noDeliveriesHint')}
              </Text>
              <Pressable
                style={styles.emptyRefreshButton}
                onPress={() => fetchOrders(true)}
                disabled={refreshing}
                accessibilityRole="button"
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.emptyRefreshText}>
                    {t('restaurant.retry')}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const next = getNextDeliveryStatus(item.status);
          const canUpdate = canDriverUpdateStatus(item.status);

          return (
            <View style={styles.card}>
              <Text style={styles.title}>
                {item.restaurantName || t('livraison.restaurantFallback')}
              </Text>

              <Text style={styles.subtitle}>
                #{String(item._id).slice(-6)}
              </Text>

              <Text>
                {formatPrice(item.totalPrice, item.currency, i18n.language)}
              </Text>

              <Text>{t('livraison.itemsCount', { count: getItemsCount(item.items) })}</Text>

              <View style={styles.row}>
                <Pressable onPress={() => router.push(`/livraison/${item._id}`)}>
                  <Text style={styles.link}>{t('livraison.detailsLink')}</Text>
                </Pressable>

                {canUpdate && next && (
                  <Pressable onPress={() => updateStatus(item)}>
                    {updatingId === item._id ? (
                      <ActivityIndicator />
                    ) : (
                      <Text style={styles.primary}>
                        {item.paymentMethod === 'cash' && next === 'Livrée'
                          ? t('livraison.confirmCashAndDelivered')
                          : t(`livraison.status.${DELIVERY_STATUS_SLUG[next] || 'confirmed'}`, next)}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />
    </FadeInView>
  );
}

/**
 * STYLES
 */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EC' },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  card: {
    backgroundColor: '#FFF',
    margin: 12,
    padding: 14,
    borderRadius: 16,
  },

  title: {
    fontWeight: '900',
    fontSize: 16,
  },

  subtitle: {
    color: '#777',
    marginBottom: 6,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },

  link: {
    color: '#245EA8',
    fontWeight: '800',
  },

  primary: {
    color: '#C8331A',
    fontWeight: '900',
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF2E4',
    borderRadius: 14,
    padding: 12,
    margin: 12,
  },

  errorText: {
    flex: 1,
    color: '#7A4A24',
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 8,
  },

  retryText: {
    color: '#084424',
    fontSize: 12,
    fontWeight: '800',
  },

  locationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF2E4',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 12,
  },

  locationNoticeText: {
    flex: 1,
    color: '#7A4A24',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginHorizontal: 8,
  },

  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 54,
  },

  emptyTitle: {
    color: '#1F1F1F',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 14,
  },

  emptyText: {
    color: '#777777',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 7,
  },

  emptyRefreshButton: {
    minWidth: 110,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#084424',
    borderRadius: 13,
    paddingHorizontal: 16,
    marginTop: 18,
  },

  emptyRefreshText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
