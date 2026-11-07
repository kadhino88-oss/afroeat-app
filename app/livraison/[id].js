import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  Redirect,
} from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import {
  getDeliveryOrderById,
  updateDeliveryStatus,
  getNextDeliveryStatus,
  canDriverUpdateStatus,
} from '../../services/deliveryService';

/**
 * HELPERS
 */

const normalizeRole = (v) => String(v || '').trim().toLowerCase();

const isDriver = (r) =>
  r === 'livreur' || r === 'driver' || r === 'delivery';

const normalizeText = (v, f = '') => String(v || '').trim() || f;

const normalizeNumber = (v, f = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : f;
};

const normalizeArray = (v) => (Array.isArray(v) ? v : []);

const formatPrice = (v, c = 'EUR') => {
  const a = normalizeNumber(v);
  if (c === 'XOF' || c === 'XAF') return `${a.toFixed(0)} ${c}`;
  return `${a.toFixed(2)} €`;
};

const DELIVERY_STATUS_SLUG = {
  'Confirmée': 'confirmed',
  'En préparation': 'preparing',
  'En livraison': 'delivering',
  'Livrée': 'delivered',
};

/**
 * SCREEN
 */

export default function LivraisonOrderDetailsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const auth = useAuth() || {};

  const user = auth.user ?? null;
  const role = auth.role;
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);

  const orderId = useMemo(() => {
    const raw = Array.isArray(params?.id) ? params.id[0] : params?.id;
    return normalizeText(raw) || null;
  }, [params]);

  const currentRole = useMemo(
    () => normalizeRole(role || user?.role),
    [role, user]
  );

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);

  /**
   * FETCH
   */

  const fetchOrder = useCallback(async (manual = false) => {
    if (!orderId || !token || !isDriver(currentRole)) {
      setOrder(null);
      setLoading(false);
      return;
    }

    try {
      if (manual) setRefreshing(true);
      else setLoading(true);

      const data = await getDeliveryOrderById(orderId, token);

      setOrder(data?._id ? data : null);
    } catch (e) {
      console.log(e);
      if (manual) Alert.alert(t('common.error'), t('livraison.profile.errorLoadBody'));
      setOrder(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, token, currentRole, t]);

  useFocusEffect(
    useCallback(() => {
      fetchOrder(false);
    }, [fetchOrder])
  );

  /**
   * DERIVED
   */

  const items = normalizeArray(order?.items);

  const itemsCount = items.reduce(
    (s, i) => s + normalizeNumber(i?.quantity),
    0
  );

  const nextStatus = getNextDeliveryStatus(order?.status);

  /**
   * ACTION
   */

  const updateStatus = async () => {
    if (!order?._id || !nextStatus) return;

    try {
      setUpdating(true);

      const updated = await updateDeliveryStatus(
        order._id,
        nextStatus,
        token
      );

      setOrder((prev) => ({
        ...(prev || {}),
        ...(updated || {}),
        status: updated?.status || nextStatus,
      }));
    } catch (_error) {
      Alert.alert(t('common.error'), t('livraison.orderDetail.errorUpdateBody'));
    } finally {
      setUpdating(false);
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

  if (!isDriver(currentRole)) {
    if (currentRole === 'restaurant') {
      return <Redirect href="/restaurant/RestaurantDashboard" />;
    }
    if (currentRole === 'admin') {
      return <Redirect href="/admin" />;
    }
    return <Redirect href="/(tabs)/index" />;
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text>{t('livraison.orderDetail.notFound')}</Text>
      </View>
    );
  }

  /**
   * RENDER
   */

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.top}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} />
          </Pressable>

          <Pressable onPress={() => fetchOrder(true)}>
            {refreshing ? (
              <ActivityIndicator />
            ) : (
              <Ionicons name="refresh-outline" size={22} />
            )}
          </Pressable>
        </View>

        <Text style={styles.title}>
          #{String(order._id).slice(-6)}
        </Text>

        <Text style={styles.subtitle}>
          {normalizeText(order.restaurantName)}
        </Text>

        <View style={styles.card}>
          <Text>{t(`livraison.status.${DELIVERY_STATUS_SLUG[order.status] || 'confirmed'}`, order.status)}</Text>
          <Text>{t('livraison.itemsCount', { count: itemsCount })}</Text>
          <Text>{formatPrice(order.totalPrice)}</Text>
        </View>

        <View style={styles.card}>
          {items.map((item, i) => (
            <Text key={i}>
              {normalizeText(item.name)} x {item.quantity}
            </Text>
          ))}
        </View>

        <Pressable
          style={styles.button}
          onPress={() =>
            router.push(`/livraison/OrderTracking?orderId=${order._id}`)
          }
        >
          <Text style={styles.buttonText}>{t('livraison.orderDetail.trackingButton')}</Text>
        </Pressable>

        {canDriverUpdateStatus(order.status) && nextStatus && (
          <Pressable style={styles.primary} onPress={updateStatus}>
            {updating ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.primaryText}>
                {order.paymentMethod === 'cash' && nextStatus === 'Livrée'
                  ? t('livraison.confirmCashAndDelivered')
                  : t(`livraison.status.${DELIVERY_STATUS_SLUG[nextStatus] || 'confirmed'}`, nextStatus)}
              </Text>
            )}
          </Pressable>
        )}
      </ScrollView>
    </FadeInView>
  );
}

/**
 * STYLES
 */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },

  content: {
    padding: 20,
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },

  subtitle: {
    color: '#777',
    marginBottom: 20,
  },

  card: {
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },

  button: {
    backgroundColor: '#EEF4FF',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },

  buttonText: {
    color: '#245EA8',
    fontWeight: '800',
  },

  primary: {
    backgroundColor: '#D4A017',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },

  primaryText: {
    fontWeight: '900',
  },
});
