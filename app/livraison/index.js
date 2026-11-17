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
  getAvailableOrders,
  acceptAvailableOrder,
  updateMyPosition,
} from '../../services/deliveryService';
import { createNewIdsTracker, playAlertSound } from '../../services/orderAlerts';

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
  const [offers, setOffers] = useState([]);
  const [offerMessage, setOfferMessage] = useState('');
  const [acceptingId, setAcceptingId] = useState(null);
  const trackOffers = useRef(createNewIdsTracker()).current;

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

      const [data, available] = await Promise.all([
        getAssignedOrders(token),
        getAvailableOrders(token).catch(() => null),
      ]);
      if (requestId === requestIdRef.current) {
        setOrders(Array.isArray(data) ? data : []);
        if (Array.isArray(available)) {
          setOffers(available);
          if (trackOffers(available.map((o) => o._id)).length) playAlertSound();
        }
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
  }, [token, currentRole, isAuthenticated, t, trackOffers]);

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

      // Avec une course : suivi de la livraison. Sans course : position pour recevoir les courses proches.
      if (activeOrder?._id) await updateDriverLocation(activeOrder._id, coords, token);
      else await updateMyPosition(coords, token);
    } catch (e) {
      console.log(e);
    } finally {
      locationUpdateInFlightRef.current = false;
    }
  }, [activeOrder, token]);

  useFocusEffect(
    useCallback(() => {
      syncLocation();

      if (!gpsTimer.current) {
        gpsTimer.current = setInterval(syncLocation, activeOrder?._id ? LOCATION_PUSH_MS : 60000);
      }

      return () => {
        clearInterval(gpsTimer.current);
        gpsTimer.current = null;
      };
    }, [syncLocation, activeOrder])
  );

  const acceptOffer = async (offer) => {
    setAcceptingId(offer._id);
    setOfferMessage('');
    try {
      await acceptAvailableOrder(offer._id, token);
      setOfferMessage(t('livraison.dispatch.accepted'));
    } catch (error) {
      setOfferMessage(error?.data?.code === 'COURIER_BUSY' ? t('livraison.dispatch.busy') : t('livraison.dispatch.taken'));
    } finally {
      setAcceptingId(null);
      fetchOrders(true);
    }
  };

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
                  color="#C8331A"
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

            {offers.length > 0 || offerMessage ? (
              <View style={styles.offersBox}>
                <Text style={styles.offersTitle}>
                  {t('livraison.dispatch.title')} · {offers.length}
                </Text>
                {offerMessage ? <Text style={styles.offerMessage}>{offerMessage}</Text> : null}
                {offers.map((offer) => (
                  <View key={offer._id} style={styles.offerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.offerName}>{offer.restaurantName || 'AFROEAT'}</Text>
                      <Text style={styles.offerMeta} numberOfLines={2}>
                        {offer.restaurantAddress}
                        {offer.deliveryCity ? ` → ${offer.deliveryCity}` : ''}
                      </Text>
                      {offer.distanceToPickupKm !== null && offer.distanceToPickupKm !== undefined ? (
                        <Text style={styles.offerMeta}>
                          {t('livraison.dispatch.distance', { km: offer.distanceToPickupKm })}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={styles.offerEarning}>
                        {Number(offer.driverEarning || 0).toFixed(2)} {offer.currency || ''}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        disabled={acceptingId === offer._id}
                        style={[styles.offerButton, acceptingId === offer._id && { opacity: 0.6 }]}
                        onPress={() => acceptOffer(offer)}
                      >
                        <Text style={styles.offerButtonText}>{t('livraison.dispatch.accept')}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {activeOrder && locationPermissionNeeded && (
              <View style={styles.locationNotice}>
                <Ionicons name="location-outline" size={18} color="#C8331A" />
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
              <Ionicons name="bicycle-outline" size={42} color="#EAB02F" />
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
                          : next === 'En livraison' ? t('livraison.startDelivery') : next === 'Livrée' ? t('livraison.markDelivered') : t(`livraison.status.${DELIVERY_STATUS_SLUG[next] || 'confirmed'}`, next)}
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
    color: '#084424',
    fontWeight: '800',
  },

  primary: {
    color: '#C8331A',
    fontWeight: '900',
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E7CA',
    borderRadius: 14,
    padding: 12,
    margin: 12,
  },

  errorText: {
    flex: 1,
    color: '#301904',
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
    backgroundColor: '#F3E7CA',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 12,
  },

  locationNoticeText: {
    flex: 1,
    color: '#301904',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginHorizontal: 8,
  },

  offersBox: { margin: 16, marginBottom: 4, padding: 16, borderRadius: 18, backgroundColor: '#0D1C11', gap: 10 },
  offersTitle: { color: '#EAB02F', fontWeight: '900', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
  offerMessage: { color: '#FFD58A', fontWeight: '700' },
  offerRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  offerName: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  offerMeta: { color: '#B9C4B6', fontSize: 13, marginTop: 2 },
  offerEarning: { color: '#2CFFB0', fontWeight: '900', fontSize: 18 },
  offerButton: { backgroundColor: '#EAB02F', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  offerButtonText: { color: '#0D1C11', fontWeight: '900' },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 54,
  },

  emptyTitle: {
    color: '#0D1C11',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 14,
  },

  emptyText: {
    color: '#606D5D',
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
