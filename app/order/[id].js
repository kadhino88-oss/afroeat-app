import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Pressable,
  Alert,
} from 'react-native';
import {
  useLocalSearchParams,
  useFocusEffect,
  router,
  Redirect,
} from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { getOrderById, getOrderTracking, updateOrderStatus } from '../../services/orderService';
import { useTranslation } from 'react-i18next';

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const LIVE_REFRESH_INTERVAL_MS = 15000;

const normalizeRole = (value) => {
  const role = normalizeText(value, 'client').toLowerCase();

  if (role === 'restaurant' || role === 'resto') return 'restaurant';

  if (
    role === 'livreur' ||
    role === 'driver' ||
    role === 'delivery' ||
    role === 'courier'
  ) {
    return 'livreur';
  }

  if (
    role === 'admin' ||
    role === 'administrator' ||
    role === 'superadmin' ||
    role === 'super-admin'
  ) {
    return 'admin';
  }

  return 'client';
};

const normalizeStatus = (value) => {
  const status = normalizeText(value).toLowerCase();

  if (status === 'pending' || status === 'en attente' || status === 'created') {
    return 'pending';
  }

  if (
    status === 'confirmed' ||
    status === 'confirmée' ||
    status === 'accepted' ||
    status === 'confirme'
  ) {
    return 'confirmed';
  }

  if (
    status === 'preparing' ||
    status === 'en préparation' ||
    status === 'preparation'
  ) {
    return 'preparing';
  }

  if (
    status === 'on-the-way' ||
    status === 'on_the_way' ||
    status === 'en livraison' ||
    status === 'out_for_delivery'
  ) {
    return 'on_the_way';
  }

  if (
    status === 'delivered' ||
    status === 'livrée' ||
    status === 'livree' ||
    status === 'completed'
  ) {
    return 'delivered';
  }

  if (
    status === 'cancelled' ||
    status === 'canceled' ||
    status === 'annulée' ||
    status === 'annulee' ||
    status === 'annulé' ||
    status === 'annule'
  ) {
    return 'cancelled';
  }

  return 'pending';
};

const getStatusLabel = (status) => {
  switch (normalizeStatus(status)) {
    case 'confirmed':
      return 'Confirmée';
    case 'preparing':
      return 'En préparation';
    case 'on_the_way':
      return 'En livraison';
    case 'delivered':
      return 'Livrée';
    case 'cancelled':
      return 'Annulée';
    case 'pending':
    default:
      return 'En attente';
  }
};

const getStatusStep = (status) => {
  const safeStatus = normalizeStatus(status);

  if (safeStatus === 'pending') return 1;
  if (safeStatus === 'confirmed') return 2;
  if (safeStatus === 'preparing') return 3;
  if (safeStatus === 'on_the_way') return 4;
  if (safeStatus === 'delivered') return 5;

  return 1;
};

const getStatusColor = (status) => {
  switch (normalizeStatus(status)) {
    case 'delivered':
      return '#084424';
    case 'on_the_way':
      return '#084424';
    case 'preparing':
      return '#EAB02F';
    case 'confirmed':
      return '#084424';
    case 'cancelled':
      return '#C8331A';
    case 'pending':
    default:
      return '#C8331A';
  }
};

const getStatusIcon = (status) => {
  switch (normalizeStatus(status)) {
    case 'delivered':
      return 'checkmark-circle';
    case 'on_the_way':
      return 'bicycle';
    case 'preparing':
      return 'restaurant';
    case 'confirmed':
      return 'checkmark-done';
    case 'cancelled':
      return 'close-circle';
    case 'pending':
    default:
      return 'time-outline';
  }
};

const formatPrice = (value, currency = 'EUR', locale = 'fr') => {
  const amount = normalizeNumber(value, 0);
  const normalizedCurrency = normalizeText(currency, 'EUR').toUpperCase();

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalizedCurrency,
    }).format(amount);
  } catch {
    const formattedAmount = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
    }).format(amount);

    return `${formattedAmount} ${normalizedCurrency}`;
  }
};

const formatDate = (value, locale = 'fr') => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
};

const formatDistance = (value, locale = 'fr') => {
  if (value === null || value === undefined || value === '') return null;

  const distance = Number(value);

  if (!Number.isFinite(distance) || distance < 0) {
    return null;
  }

  try {
    return `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
    }).format(distance)} km`;
  } catch {
    return `${distance.toFixed(1)} km`;
  }
};

const formatTime = (value, locale = 'fr') => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
};

const extractOrderPayload = (response) => {
  if (!response || typeof response !== 'object') return null;

  return response?.order || response?.data?.order || response?.data || response;
};

const extractTrackingPayload = (response) => {
  if (!response || typeof response !== 'object') return null;

  return (
    response?.tracking ||
    response?.data?.tracking ||
    response?.data ||
    response
  );
};

const normalizeOrder = (order) => {
  if (!order || typeof order !== 'object') return null;

  return {
    ...order,
    _id: order?._id || order?.id || null,
    id: order?.id || order?._id || null,
    status: normalizeStatus(order?.status),
    statusLabel: getStatusLabel(order?.status),
    createdAt: order?.createdAt || order?.created_at || null,
    currency: normalizeText(order?.currency, 'EUR'),
    totalPrice: normalizeNumber(order?.totalPrice, 0),
    restaurantName: normalizeText(
      order?.restaurantName || order?.restaurant?.name,
      'Restaurant AFROEAT'
    ),
    deliveryAddress: normalizeText(
      order?.deliveryAddress ||
        order?.address ||
        order?.shippingAddress ||
        order?.customerAddress
    ),
    paymentStatus: normalizeText(order?.paymentStatus, 'Non payé'),
    items: Array.isArray(order?.items) ? order.items : [],
  };
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function OrderDetailScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'fr';
  const STEPS = [
    t('order.steps.received'),
    t('order.steps.confirmed'),
    t('order.steps.preparing'),
    t('order.steps.onTheWay'),
    t('order.steps.delivered'),
  ];
  const params = useLocalSearchParams();
  const { token, isAuthenticated, user, role, loading: authLoading } =
    useAuth();
  const rawOrderId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const safeOrderId = normalizeText(rawOrderId) || null;

  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cancelStep, setCancelStep] = useState('idle'); // idle | confirm | busy
  const [cancelError, setCancelError] = useState('');
  const requestInFlightRef = useRef(false);
  const hasOrderRef = useRef(false);
  const loadedOrderIdRef = useRef(null);

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role || 'client');
  }, [role, user]);

  const isLoggedIn = Boolean(isAuthenticated && token && user?._id);

  /**
   * =========================================================
   * LOAD
   * =========================================================
   */

  const load = useCallback(
    async (manualRefresh = false, silent = false) => {
      if (authLoading || requestInFlightRef.current) return;

      if (!safeOrderId) {
        setOrder(null);
        setTracking(null);
        hasOrderRef.current = false;
        setErrorMessage('Commande introuvable.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (loadedOrderIdRef.current !== safeOrderId) {
        loadedOrderIdRef.current = safeOrderId;
        hasOrderRef.current = false;
        setOrder(null);
        setTracking(null);
      }

      if (!isLoggedIn || !token || !safeOrderId || currentRole !== 'client') {
        if (!silent) {
          setOrder(null);
          setTracking(null);
          hasOrderRef.current = false;
          setErrorMessage('');
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }

      requestInFlightRef.current = true;

      try {
        if (manualRefresh) {
          setRefreshing(true);
        } else if (!silent && !hasOrderRef.current) {
          setLoading(true);
        }

        if (!silent) setErrorMessage('');

        const [orderResult, trackingResult] = await Promise.allSettled([
          getOrderById(safeOrderId, token),
          getOrderTracking(safeOrderId, token),
        ]);

        if (orderResult.status === 'rejected') {
          throw orderResult.reason;
        }

        const safeOrder = normalizeOrder(
          extractOrderPayload(orderResult.value)
        );
        const safeTracking =
          trackingResult.status === 'fulfilled'
            ? extractTrackingPayload(trackingResult.value)
            : null;

        if (!safeOrder?._id) {
          throw new Error('Commande introuvable.');
        }

        setOrder(safeOrder);
        setTracking(safeTracking || null);
        hasOrderRef.current = true;
      } catch (err) {
        if (!silent) {
          setErrorMessage(
            err?.message || 'Impossible de charger cette commande.'
          );

          if (manualRefresh) {
            Alert.alert(
              'Erreur',
              err?.message || 'Impossible de charger cette commande.'
            );
          }
        }
      } finally {
        requestInFlightRef.current = false;

        if (!silent) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [authLoading, currentRole, isLoggedIn, safeOrderId, token]
  );

  /**
   * =========================================================
   * DERIVED
   * =========================================================
   */

  const items = useMemo(() => {
    return Array.isArray(order?.items) ? order.items : [];
  }, [order]);

  const total = useMemo(() => {
    if (order?.totalPrice) {
      return normalizeNumber(order.totalPrice, 0);
    }

    return items.reduce((sum, item) => {
      return (
        sum +
        normalizeNumber(item?.price, 0) * normalizeNumber(item?.quantity, 0)
      );
    }, 0);
  }, [items, order]);

  const step = getStatusStep(order?.status);
  const isTerminal =
    normalizeStatus(order?.status) === 'delivered' ||
    normalizeStatus(order?.status) === 'cancelled';
  const isOnTheWay = normalizeStatus(order?.status) === 'on_the_way';
  useFocusEffect(
    useCallback(() => {
      void load(false);

      if (
        authLoading ||
        !isLoggedIn ||
        !token ||
        !safeOrderId ||
        currentRole !== 'client' ||
        isTerminal
      ) {
        return undefined;
      }

      const refreshTimer = setInterval(() => {
        if (isTerminal) {
          clearInterval(refreshTimer);
          return;
        }

        void load(false, true);
      }, LIVE_REFRESH_INTERVAL_MS);

      return () => clearInterval(refreshTimer);
    }, [
      authLoading,
      currentRole,
      isLoggedIn,
      isTerminal,
      load,
      safeOrderId,
      token,
    ])
  );

  const itemCount = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + normalizeNumber(item?.quantity, 0);
    }, 0);
  }, [items]);

  /**
   * =========================================================
   * AUTH
   * =========================================================
   */

  if (!authLoading && !isAuthenticated) {
    return <Redirect href="/auth/role" />;
  }

  if (!authLoading && isAuthenticated && currentRole !== 'client') {
    if (currentRole === 'restaurant') {
      return <Redirect href="/restaurant/RestaurantDashboard" />;
    }

    if (currentRole === 'livreur') {
      return <Redirect href="/livraison" />;
    }

    if (currentRole === 'admin') {
      return <Redirect href="/admin" />;
    }
  }

  /**
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (authLoading || loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <ActivityIndicator size="large" color="#EAB02F" />
        <Text style={styles.loaderText}>{t('order.loading')}</Text>
      </View>
    );
  }

  if (!isLoggedIn) {
    return <Redirect href="/auth/role" />;
  }

  if (!order) {
    return (
      <FadeInView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

        <View style={styles.emptyWrapper}>
          <Pressable style={styles.topButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#0D1C11" />
          </Pressable>

          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={54} color="#EAB02F" />
            <Text style={styles.emptyTitle}>{t('order.notFoundTitle')}</Text>
            <Text style={styles.emptyText}>
              {errorMessage || t('order.loadError')}
            </Text>

            <Pressable
              style={styles.primaryButton}
              onPress={() => router.replace('/(tabs)/orders')}
            >
              <Text style={styles.primaryButtonText}>{t('order.viewMyOrders')}</Text>
            </Pressable>
          </View>
        </View>
      </FadeInView>
    );
  }

  /**
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.topActions}>
          <Pressable style={styles.topButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#0D1C11" />
          </Pressable>

          <Pressable
            style={styles.topButton}
            onPress={() => load(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#0D1C11" />
            ) : (
              <Ionicons name="refresh-outline" size={20} color="#0D1C11" />
            )}
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>{t('order.title')}</Text>
          <Text style={styles.subtitle}>
            {t('order.orderNumber', { number: String(order?._id || '').slice(-6).toUpperCase() })}
          </Text>
          <Text style={styles.subMeta}>
            {formatDate(order?.createdAt, locale)}
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(order?.status) },
            ]}
          >
            <Ionicons
              name={getStatusIcon(order?.status)}
              size={15}
              color="#FFFFFF"
              style={styles.statusIcon}
            />
            <Text style={styles.statusText}>{t(`order.status.${order?.status}`, order?.statusLabel)}</Text>
          </View>

          <Text style={styles.restaurantName}>
            {order?.restaurantName || t('order.restaurantFallback')}
          </Text>

          {!!order?.deliveryAddress && (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={15} color="#606D5D" />
              <Text style={styles.addressText}>{order.deliveryAddress}</Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Ionicons name="bag-handle-outline" size={14} color="#084424" />
              <Text style={styles.metaBadgeText}>{t('order.itemsCount', { count: itemCount })}</Text>
            </View>

            <View style={styles.metaBadge}>
              <Ionicons name="cash-outline" size={14} color="#C8331A" />
              <Text style={styles.metaBadgeText}>
                {formatPrice(total, order?.currency, locale)}
              </Text>
            </View>

            <View style={styles.metaBadge}>
              <Ionicons name="card-outline" size={14} color="#084424" />
              <Text style={styles.metaBadgeText}>
                {order?.paymentStatus || t('order.unpaid')}
              </Text>
            </View>
          </View>
        </View>

        {isOnTheWay && (
          <View style={styles.liveCard}>
            <View style={styles.liveHeader}>
              <Ionicons name="radio-outline" size={18} color="#084424" />
              <Text style={styles.liveTitle}>{t('order.realtime')}</Text>
            </View>

            <View style={styles.liveRow}>
              <Text style={styles.liveLabel}>{t('order.trackingStatus')}</Text>
              <Text style={styles.liveValue}>
                {tracking?.trackingEnabled && tracking?.driverLocation
                  ? t('order.active')
                  : t('order.unavailable')}
              </Text>
            </View>

            <View style={styles.liveRow}>
              <Text style={styles.liveLabel}>{t('order.deliveryEta')}</Text>
              <Text style={styles.liveValue}>
                {Number.isFinite(Number(tracking?.etaMinutes)) &&
                Number(tracking?.etaMinutes) > 0
                  ? t('order.etaMinutes', {
                      minutes: Number(tracking.etaMinutes),
                    })
                  : t('order.unavailable')}
              </Text>
            </View>

            <View style={styles.liveRow}>
              <Text style={styles.liveLabel}>
                {t('order.remainingDistance')}
              </Text>
              <Text style={styles.liveValue}>
                {formatDistance(tracking?.distanceKm, locale) ||
                  t('order.unavailable')}
              </Text>
            </View>

            {!!tracking?.driverLocation &&
              !!formatTime(tracking?.lastLocationUpdateAt, locale) && (
                <Text style={styles.liveUpdatedAt}>
                  {t('order.locationUpdatedAt', {
                    time: formatTime(tracking.lastLocationUpdateAt, locale),
                  })}
                </Text>
              )}
          </View>
        )}

        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>{t('order.progress')}</Text>

          {STEPS.map((label, index) => {
            const isDone =
              normalizeStatus(order?.status) !== 'cancelled' && index + 1 <= step;
            const isCurrent =
              normalizeStatus(order?.status) !== 'cancelled' &&
              index + 1 === step;

            return (
              <View key={label} style={styles.timelineRow}>
                <View
                  style={[
                    styles.timelineDot,
                    isDone && styles.timelineDotDone,
                    isCurrent && styles.timelineDotCurrent,
                  ]}
                >
                  {isDone ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : null}
                </View>

                <View style={styles.timelineContent}>
                  <Text
                    style={[
                      styles.timelineStepText,
                      isDone && styles.timelineStepTextDone,
                      isCurrent && styles.timelineStepTextCurrent,
                    ]}
                  >
                    {label}
                  </Text>

                  {isCurrent &&
                    normalizeStatus(order?.status) !== 'cancelled' && (
                      <Text style={styles.timelineStepSubtext}>
                        {t('order.currentStatus')}
                      </Text>
                    )}
                </View>
              </View>
            );
          })}

          {order?.status === 'pending' && (
            <View style={styles.cancelAction}>
              <Pressable
                accessibilityRole="button"
                disabled={cancelStep === 'busy'}
                style={styles.cancelButton}
                onPress={async () => {
                  if (cancelStep === 'idle') {
                    setCancelStep('confirm');
                    return;
                  }
                  try {
                    setCancelStep('busy');
                    setCancelError('');
                    await updateOrderStatus(order._id, 'Annulée', token);
                    setCancelStep('idle');
                    await load(false, true);
                  } catch (e) {
                    setCancelStep('idle');
                    setCancelError(e?.message || t('order.cancelError'));
                  }
                }}
              >
                <Text style={styles.cancelButtonText}>
                  {cancelStep === 'confirm' ? t('order.cancelConfirm') : cancelStep === 'busy' ? '…' : t('order.cancelOrder')}
                </Text>
              </Pressable>
              {!!cancelError && <Text style={styles.cancelErrorText}>{cancelError}</Text>}
            </View>
          )}

          {normalizeStatus(order?.status) === 'cancelled' && (
            <View style={styles.cancelBox}>
              <Ionicons name="close-circle-outline" size={18} color="#C8331A" />
              <Text style={styles.cancelText}>{t('order.cancelled')}</Text>
            </View>
          )}
        </View>

        <View style={styles.itemsCard}>
          <Text style={styles.itemsTitle}>{t('checkout.items')}</Text>

          {items.length > 0 ? (
            items.map((item, index) => {
              const quantity = normalizeNumber(item?.quantity, 0);
              const price = normalizeNumber(item?.price, 0);
              const lineTotal = quantity * price;

              return (
                <View
                  key={`${item?.menuItem || item?._id || item?.id || index}`}
                  style={styles.itemRow}
                >
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemName}>
                      {normalizeText(item?.name, 'Plat')}
                    </Text>
                    <Text style={styles.itemQuantity}>{t('order.quantity', { quantity })}</Text>
                  </View>

                  <Text style={styles.itemPrice}>
                    {formatPrice(lineTotal, order?.currency, locale)}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyItemsText}>{t('order.noItems')}</Text>
          )}
        </View>

        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('checkout.total')}</Text>
            <Text style={styles.totalValue}>
              {formatPrice(total, order?.currency, locale)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </FadeInView>
  );
}

/**
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles = StyleSheet.create({
  cancelAction: { marginTop: 14 },
  cancelButton: { backgroundColor: '#F8E1DD', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  cancelButtonText: { color: '#C8331A', fontWeight: '800', fontSize: 14 },
  cancelErrorText: { color: '#C8331A', marginTop: 8, fontSize: 13 },
  container: {
    flex: 1,
    backgroundColor: '#FBF6EC',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 120,
    flexGrow: 1,
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBF6EC',
  },

  loaderText: {
    marginTop: 10,
    color: '#606D5D',
    fontSize: 15,
  },

  emptyWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 40,
  },

  topActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
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

  header: {
    marginBottom: 22,
  },

  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0D1C11',
    textAlign: 'center',
    marginBottom: 8,
  },

  subtitle: {
    textAlign: 'center',
    color: '#606D5D',
    fontSize: 14,
    lineHeight: 20,
  },

  subMeta: {
    textAlign: 'center',
    color: '#606D5D',
    fontSize: 12,
    marginTop: 6,
  },

  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginBottom: 14,
  },

  statusIcon: {
    marginRight: 6,
  },

  statusText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  restaurantName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0D1C11',
    marginBottom: 10,
  },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },

  addressText: {
    color: '#606D5D',
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
    lineHeight: 20,
  },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2ECE0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 10,
    marginBottom: 8,
  },

  metaBadgeText: {
    marginLeft: 6,
    color: '#606D5D',
    fontWeight: '700',
    fontSize: 12,
  },

  liveCard: {
    backgroundColor: '#F2ECE0',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  liveTitle: {
    marginLeft: 8,
    fontSize: 17,
    fontWeight: '800',
    color: '#084424',
  },

  liveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 36,
    paddingVertical: 4,
  },

  liveLabel: {
    color: '#084424',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    paddingRight: 10,
  },

  liveValue: {
    color: '#084424',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
  },

  liveUpdatedAt: {
    marginTop: 8,
    color: '#606D5D',
    fontSize: 11,
    textAlign: 'right',
  },

  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  timelineTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0D1C11',
    marginBottom: 16,
  },

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },

  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E3DECF',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },

  timelineDotDone: {
    backgroundColor: '#084424',
  },

  timelineDotCurrent: {
    backgroundColor: '#EAB02F',
  },

  timelineContent: {
    flex: 1,
  },

  timelineStepText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#606D5D',
  },

  timelineStepTextDone: {
    color: '#0D1C11',
  },

  timelineStepTextCurrent: {
    color: '#0D1C11',
    fontWeight: '900',
  },

  timelineStepSubtext: {
    marginTop: 4,
    color: '#606D5D',
    fontSize: 13,
  },

  cancelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8E1DD',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },

  cancelText: {
    marginLeft: 8,
    color: '#C8331A',
    fontWeight: '700',
    fontSize: 13,
  },

  itemsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  itemsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0D1C11',
    marginBottom: 14,
  },

  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2ECE0',
  },

  itemLeft: {
    flex: 1,
    marginRight: 10,
  },

  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0D1C11',
    marginBottom: 4,
  },

  itemQuantity: {
    fontSize: 13,
    color: '#606D5D',
  },

  itemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#C8331A',
  },

  emptyItemsText: {
    color: '#606D5D',
    fontSize: 14,
  },

  totalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  totalLabel: {
    fontWeight: '800',
    fontSize: 16,
    color: '#0D1C11',
  },

  totalValue: {
    fontWeight: '900',
    fontSize: 18,
    color: '#0D1C11',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 80,
  },

  emptyTitle: {
    textAlign: 'center',
    color: '#0D1C11',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 8,
  },

  emptyText: {
    textAlign: 'center',
    color: '#606D5D',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },

  primaryButton: {
    backgroundColor: '#EAB02F',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
  },

  primaryButtonText: {
    color: '#0D1C11',
    fontWeight: '800',
    fontSize: 15,
  },
});
