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
  getDeliveryStats,
  getNextDeliveryStatus,
  canDriverUpdateStatus,
  calculateDistanceKm,
  calculateETA,
  formatEtaLabel,
  updateDriverLocation,
} from '../../services/deliveryService';

/**
 * CONSTANTS
 */

const LIVE_REFRESH_MS = 12000;
const LOCATION_PUSH_MS = 15000;

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

const formatPrice = (v, c = 'EUR') => {
  const amount = normalizeNumber(v);
  if (c === 'USD') return `$${amount.toFixed(2)}`;
  if (c === 'XOF' || c === 'XAF') return `${amount.toFixed(0)} ${c}`;
  return `${amount.toFixed(2)} €`;
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
  const { t } = useTranslation();
  const auth = useAuth() || {};

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

  const [driverPosition, setDriverPosition] = useState(null);

  const liveTimer = useRef(null);
  const gpsTimer = useRef(null);

  const safeOrders = Array.isArray(orders) ? orders : [];

  const stats = useMemo(() => getDeliveryStats(safeOrders), [safeOrders]);

  const activeOrder = useMemo(() => {
    return (
      safeOrders.find((o) => o.status === 'En livraison') ||
      safeOrders.find((o) => o.status === 'En préparation') ||
      null
    );
  }, [safeOrders]);

  /**
   * FETCH
   */

  const fetchOrders = useCallback(async (manual = false) => {
    if (!isAuthenticated || !token || !isDriverRole(currentRole)) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      manual ? setRefreshing(true) : setLoading(true);

      const data = await getAssignedOrders(token);
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log(e);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, currentRole, isAuthenticated]);

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
    if (!activeOrder?._id || !token) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      const coords = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      };

      setDriverPosition(coords);

      await updateDriverLocation(activeOrder._id, coords, token);
    } catch (e) {
      console.log(e);
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

      setOrders((prev) =>
        prev.map((o) =>
          o._id === order._id ? updated || { ...o, status: next } : o
        )
      );
    } catch (e) {
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
        <ActivityIndicator size="large" color="#D96C2D" />
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

              <Text>{formatPrice(item.totalPrice)}</Text>

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
                        {t(`livraison.status.${DELIVERY_STATUS_SLUG[next] || 'confirmed'}`, next)}
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
  container: { flex: 1, backgroundColor: '#FFF8F0' },

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
    color: '#D96C2D',
    fontWeight: '900',
  },
});