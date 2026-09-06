import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
  Alert,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { getAdminOrders } from '../../services/adminService';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

const STATUS_FILTERS = [
  'Toutes',
  'En attente',
  'Confirmée',
  'En préparation',
  'En livraison',
  'Livrée',
  'Annulée',
];

const PAYMENT_FILTERS = ['Tous', 'paid', 'unpaid', 'Payé', 'Non payé'];

const LIVE_REFRESH_MS = 15000;
const DEFAULT_LIMIT = 100;

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

const normalizeRole = (value) => normalizeText(value).toLowerCase();

const isAdminRole = (role) => {
  return (
    role === 'admin' ||
    role === 'administrator' ||
    role === 'superadmin' ||
    role === 'super-admin'
  );
};

const formatPrice = (value, currency = 'EUR') => {
  const amount = normalizeNumber(value, 0);

  if (currency === 'USD') return `$${amount.toFixed(2)}`;
  if (currency === 'GBP') return `£${amount.toFixed(2)}`;
  if (currency === 'CHF') return `CHF ${amount.toFixed(2)}`;
  if (currency === 'XOF' || currency === 'XAF') return `${amount.toFixed(0)} ${currency}`;
  if (currency === 'CAD') return `${amount.toFixed(2)} $CA`;

  return `${amount.toFixed(2)} €`;
};

const DATE_LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-ES', it: 'it-IT', zh: 'zh-CN' };

const ORDER_STATUS_SLUG = {
  'En attente': 'order.status.pending',
  'Confirmée': 'order.status.confirmed',
  'En préparation': 'order.status.preparing',
  'En livraison': 'order.status.on_the_way',
  'Livrée': 'order.status.delivered',
  'Annulée': 'order.status.cancelled',
};

const getStatusFilterLabel = (item, t) => {
  if (item === 'Toutes') return t('livraison.filtersAll');
  const key = ORDER_STATUS_SLUG[item];
  return key ? t(key) : item;
};

const getPaymentFilterLabel = (item, t) => {
  if (item === 'Tous') return t('admin.users.allFilterLabel');
  if (item === 'paid' || item === 'Payé') return t('admin.orders.paymentPaidLabel');
  if (item === 'unpaid' || item === 'Non payé') return t('admin.orders.paymentUnpaidLabel');
  return item;
};

const formatDateValue = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(DATE_LOCALE_MAP[i18n.language] || 'fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) return i18n.t('admin.ops.dateUnavailable');

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return i18n.t('admin.ops.dateUnavailable');
  }

  return date.toLocaleString(DATE_LOCALE_MAP[i18n.language] || 'fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getPaymentLabel = (value, t) => {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized === 'paid' || normalized === 'payé') {
    return t('admin.orders.paymentPaidLabel');
  }

  if (normalized === 'unpaid' || normalized === 'non payé') {
    return t('admin.orders.paymentUnpaidLabel');
  }

  if (normalized === 'refunded' || normalized === 'remboursé') {
    return t('admin.orders.paymentRefundedLabel');
  }

  return normalizeText(value, t('admin.users.statusUnknownLabel'));
};

const getPaymentStyle = (value) => {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized === 'paid' || normalized === 'payé') {
    return { bg: '#E8F5ED', text: '#1F6F43', icon: 'card-outline' };
  }

  if (normalized === 'unpaid' || normalized === 'non payé') {
    return { bg: '#FDECEC', text: '#B83232', icon: 'alert-circle-outline' };
  }

  if (normalized === 'refunded' || normalized === 'remboursé') {
    return { bg: '#EAF3FF', text: '#245EA8', icon: 'swap-horizontal-outline' };
  }

  return { bg: '#F4F4F4', text: '#555', icon: 'help-circle-outline' };
};

const getStatusColors = (status) => {
  switch (normalizeText(status)) {
    case 'Livrée':
      return {
        bg: '#E8F5ED',
        text: '#1F6F43',
        icon: 'checkmark-circle-outline',
      };

    case 'En livraison':
      return {
        bg: '#EAF3FF',
        text: '#245EA8',
        icon: 'bicycle-outline',
      };

    case 'En préparation':
      return {
        bg: '#FFF3D8',
        text: '#8A6500',
        icon: 'restaurant-outline',
      };

    case 'Confirmée':
      return {
        bg: '#EFE9FF',
        text: '#6D4CDB',
        icon: 'checkmark-done-outline',
      };

    case 'Annulée':
      return {
        bg: '#FDECEC',
        text: '#B83232',
        icon: 'close-circle-outline',
      };

    default:
      return {
        bg: '#FFF0E8',
        text: '#D96C2D',
        icon: 'time-outline',
      };
  }
};

const normalizeOrder = (order) => {
  if (!order || typeof order !== 'object') {
    return null;
  }

  const items = Array.isArray(order?.items) ? order.items : [];
  const restaurant =
    order?.restaurant && typeof order.restaurant === 'object'
      ? order.restaurant
      : null;
  const customer =
    order?.user && typeof order.user === 'object'
      ? order.user
      : null;
  const deliveryPerson =
    order?.deliveryPerson && typeof order.deliveryPerson === 'object'
      ? order.deliveryPerson
      : null;

  return {
    ...order,
    _id: order?._id || order?.id || null,
    id: order?.id || order?._id || null,
    status: normalizeText(order?.status, 'En attente'),
    paymentStatus: normalizeText(order?.paymentStatus, 'Non payé'),
    currency: normalizeText(order?.currency, 'EUR'),
    totalPrice: normalizeNumber(order?.totalPrice, 0),
    createdAt: order?.createdAt || null,
    updatedAt: order?.updatedAt || null,
    deliveryAddress: normalizeText(order?.deliveryAddress),
    restaurant,
    user: customer,
    deliveryPerson,
    itemCount: items.reduce(
      (sum, item) => sum + normalizeNumber(item?.quantity, 0),
      0
    ),
    restaurantName: normalizeText(
      restaurant?.name || order?.restaurantName,
      i18n.t('admin.orders.restaurantNameFallback')
    ),
    restaurantCuisine: normalizeText(restaurant?.cuisine),
    customerName: normalizeText(customer?.name || customer?.fullName),
    driverName: normalizeText(deliveryPerson?.name || deliveryPerson?.fullName),
  };
};

/**
 * =========================================================
 * UI
 * =========================================================
 */

const StatCard = ({ label, value, iconName, tint = '#1F6F43' }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconWrap, { backgroundColor: `${tint}14` }]}>
      <Ionicons name={iconName} size={18} color={tint} />
    </View>
    <Text style={styles.statValue}>{normalizeNumber(value)}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const QuickActionCard = ({ iconName, tint, title, text, onPress }) => (
  <Pressable style={styles.quickActionCard} onPress={onPress}>
    <View style={[styles.quickActionIconWrap, { backgroundColor: `${tint}14` }]}>
      <Ionicons name={iconName} size={18} color={tint} />
    </View>
    <Text style={styles.quickActionTitle}>{title}</Text>
    <Text style={styles.quickActionText}>{text}</Text>
  </Pressable>
);

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function AdminOrdersScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const loadingAuth = Boolean(auth.loading);
  const user = auth.user ?? null;
  const role = auth.role;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeStatus, setActiveStatus] = useState('Toutes');
  const [activePaymentStatus, setActivePaymentStatus] = useState('Tous');
  const [lastLiveRefresh, setLastLiveRefresh] = useState(null);

  const [pagination, setPagination] = useState({
    total: 0,
    count: 0,
    page: 1,
    pages: 1,
    hasNextPage: false,
    hasPrevPage: false,
    limit: DEFAULT_LIMIT,
  });

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role);
  }, [role, user]);

  const canAccess = isAuthenticated && isAdminRole(currentRole);

  const resolvedStatusFilter = useMemo(
    () => (activeStatus === 'Toutes' ? '' : activeStatus),
    [activeStatus]
  );

  const resolvedPaymentFilter = useMemo(() => {
    if (activePaymentStatus === 'Tous') return '';
    if (activePaymentStatus === 'Payé') return 'paid';
    if (activePaymentStatus === 'Non payé') return 'unpaid';
    return activePaymentStatus;
  }, [activePaymentStatus]);

  const resetPagination = useCallback(() => {
    setPagination({
      total: 0,
      count: 0,
      page: 1,
      pages: 1,
      hasNextPage: false,
      hasPrevPage: false,
      limit: DEFAULT_LIMIT,
    });
  }, []);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/admin/AdminDashboard');
  }, []);

  const fetchOrders = useCallback(
    async (manual = false, silent = false) => {
      if (!isAuthenticated || !token) {
        setOrders([]);
        resetPagination();
        setErrorMessage('');
        setLoading(false);
        setRefreshing(false);
        setInitialLoaded(true);
        return;
      }

      try {
        setErrorMessage('');

        if (manual) {
          setRefreshing(true);
        } else if (!silent) {
          setLoading(true);
        }

        const response = await getAdminOrders(token, {
          page: 1,
          limit: DEFAULT_LIMIT,
          status: resolvedStatusFilter,
          paymentStatus: resolvedPaymentFilter,
          sort: 'recent',
        });

        const rawItems = Array.isArray(response?.items) ? response.items : [];
        const items = rawItems.map(normalizeOrder).filter(Boolean);

        setOrders(items);
        setPagination({
          total: normalizeNumber(response?.total, items.length),
          count: normalizeNumber(response?.count, items.length),
          page: normalizeNumber(response?.page, 1),
          pages: Math.max(normalizeNumber(response?.pages, 1), 1),
          hasNextPage: Boolean(response?.hasNextPage),
          hasPrevPage: Boolean(response?.hasPrevPage),
          limit: normalizeNumber(response?.limit, DEFAULT_LIMIT),
        });
        setLastLiveRefresh(new Date().toISOString());
      } catch (error) {
        console.log('Erreur admin orders :', error);

        const message =
          error?.message || t('admin.orders.fetchErrorFallback');

        setErrorMessage(message);

        if (!silent) {
          setOrders([]);
          resetPagination();
        }

        if (manual) {
          Alert.alert(t('common.error'), message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setInitialLoaded(true);
      }
    },
    [
      isAuthenticated,
      token,
      resolvedStatusFilter,
      resolvedPaymentFilter,
      resetPagination,
      t,
    ]
  );

  useFocusEffect(
    useCallback(() => {
      if (!canAccess) return;
      fetchOrders(false, false);
    }, [fetchOrders, canAccess])
  );

  useEffect(() => {
    if (!canAccess || !token) {
      return undefined;
    }

    const interval = setInterval(() => {
      fetchOrders(false, true);
    }, LIVE_REFRESH_MS);

    return () => clearInterval(interval);
  }, [canAccess, token, fetchOrders]);

  const stats = useMemo(() => {
    return {
      total: normalizeNumber(pagination.total, orders.length),
      pending: orders.filter((item) => item?.status === 'En attente').length,
      delivering: orders.filter((item) => item?.status === 'En livraison').length,
      delivered: orders.filter((item) => item?.status === 'Livrée').length,
      unpaid: orders.filter((item) => {
        const payment = normalizeText(item?.paymentStatus).toLowerCase();
        return payment === 'unpaid' || payment === 'non payé';
      }).length,
      unassigned: orders.filter((item) => !normalizeText(item?.driverName)).length,
    };
  }, [orders, pagination]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(resolvedStatusFilter || resolvedPaymentFilter);
  }, [resolvedStatusFilter, resolvedPaymentFilter]);

  const liveRefreshLabel = useMemo(() => {
    if (!lastLiveRefresh) {
      return t('admin.ops.liveRefreshWaiting');
    }

    return t('admin.ops.liveRefreshLabel', { date: formatDateTime(lastLiveRefresh) });
  }, [lastLiveRefresh, t]);

  const handleResetFilters = useCallback(() => {
    setActiveStatus('Toutes');
    setActivePaymentStatus('Tous');
  }, []);

  const openOrderDetails = useCallback((item) => {
    if (!item?._id) {
      Alert.alert(t('common.error'), t('admin.orders.invalidOrderAlert'));
      return;
    }

    router.push({
      pathname: '/admin/orders-details/[id]',
      params: { id: item._id },
    });
  }, [t]);

  /**
   * =========================================================
   * GUARDS
   * =========================================================
   */

  if (loadingAuth || (loading && !initialLoaded)) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#1F6F43" />
        <Text style={styles.loaderText}>{t('admin.orders.loaderText')}</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login?role=admin" />;
  }

  if (!canAccess) {
    return (
      <FadeInView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.emptyContainer}>
          <Ionicons name="shield-outline" size={54} color="#C8BBAA" />
          <Text style={styles.emptyTitle}>{t('admin.orders.restrictedTitle')}</Text>
          <Text style={styles.emptyText}>
            {t('admin.orders.restrictedText')}
          </Text>
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <FlatList
        data={orders}
        keyExtractor={(item, index) => item?._id || `order-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          orders.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchOrders(true, false)}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.topRow}>
              <Pressable style={styles.topButton} onPress={handleGoBack}>
                <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
              </Pressable>

              <Pressable
                style={[
                  styles.topButton,
                  refreshing && styles.topButtonDisabled,
                ]}
                onPress={() => fetchOrders(true, false)}
                disabled={refreshing}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color="#1E1E1E" />
                ) : (
                  <Ionicons name="refresh-outline" size={20} color="#1E1E1E" />
                )}
              </Pressable>
            </View>

            <View style={styles.header}>
              <Text style={styles.eyebrow}>{t('admin.dashboard.eyebrow')}</Text>
              <Text style={styles.title}>{t('admin.common.ordersTitle')}</Text>
              <Text style={styles.subtitle}>
                {t('admin.orders.subtitle')}
              </Text>
            </View>

            <View style={styles.liveMonitorCard}>
              <View style={styles.liveMonitorHeader}>
                <View style={styles.liveMonitorTitleWrap}>
                  <Ionicons name="radio-outline" size={18} color="#245EA8" />
                  <Text style={styles.liveMonitorTitle}>{t('admin.orders.controlCenterTitle')}</Text>
                </View>

                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              </View>

              <Text style={styles.liveMonitorText}>
                {t('admin.orders.controlCenterText')}
              </Text>

              <Text style={styles.liveMonitorSubText}>{liveRefreshLabel}</Text>
            </View>

            <View style={styles.statsRow}>
              <StatCard
                label={t('admin.users.statTotalLabel')}
                value={stats.total}
                iconName="receipt-outline"
                tint="#1F6F43"
              />
              <StatCard
                label={t('admin.dashboard.pendingLabel')}
                value={stats.pending}
                iconName="time-outline"
                tint="#D96C2D"
              />
              <StatCard
                label={t('order.status.on_the_way')}
                value={stats.delivering}
                iconName="bicycle-outline"
                tint="#245EA8"
              />
              <StatCard
                label={t('order.status.delivered')}
                value={stats.delivered}
                iconName="checkmark-circle-outline"
                tint="#1F6F43"
              />
              <StatCard
                label={t('admin.orders.statUnpaidLabel')}
                value={stats.unpaid}
                iconName="card-outline"
                tint="#B83232"
              />
              <StatCard
                label={t('admin.dashboard.unassignedLabel')}
                value={stats.unassigned}
                iconName="person-remove-outline"
                tint="#7C3AED"
              />
            </View>

            <View style={styles.quickActionsGrid}>
              <QuickActionCard
                iconName="bicycle-outline"
                tint="#245EA8"
                title={t('admin.ops.liveTripsLabel')}
                text={t('admin.orders.liveTripsQuickText')}
                onPress={() => setActiveStatus('En livraison')}
              />
              <QuickActionCard
                iconName="card-outline"
                tint="#B83232"
                title={t('admin.orders.sensitivePaymentsQuickTitle')}
                text={t('admin.orders.sensitivePaymentsQuickText')}
                onPress={() => setActivePaymentStatus('Non payé')}
              />
            </View>

            <Text style={styles.filterTitle}>{t('admin.orders.statusFilterTitle')}</Text>
            <FlatList
              data={STATUS_FILTERS}
              horizontal
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
              renderItem={({ item }) => {
                const isActive = activeStatus === item;

                return (
                  <Pressable
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => setActiveStatus(item)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isActive && styles.filterChipTextActive,
                      ]}
                    >
                      {getStatusFilterLabel(item, t)}
                    </Text>
                  </Pressable>
                );
              }}
            />

            <Text style={styles.filterTitle}>{t('admin.orders.paymentFilterTitle')}</Text>
            <FlatList
              data={PAYMENT_FILTERS}
              horizontal
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
              renderItem={({ item }) => {
                const isActive = activePaymentStatus === item;

                return (
                  <Pressable
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => setActivePaymentStatus(item)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isActive && styles.filterChipTextActive,
                      ]}
                    >
                      {getPaymentFilterLabel(item, t)}
                    </Text>
                  </Pressable>
                );
              }}
            />

            <View style={styles.actionsRow}>
              <Pressable
                style={styles.applyButton}
                onPress={() => fetchOrders(true, false)}
              >
                <Text style={styles.applyButtonText}>{t('admin.restaurants.applyButton')}</Text>
              </Pressable>

              <Pressable style={styles.resetButton} onPress={handleResetFilters}>
                <Ionicons name="refresh-circle-outline" size={16} color="#555" />
                <Text style={styles.resetButtonText}>{t('admin.users.resetButton')}</Text>
              </Pressable>
            </View>

            <View style={styles.resultsCard}>
              <View style={styles.resultsTopRow}>
                <Text style={styles.resultsTitle}>{t('admin.users.resultsTitle')}</Text>
                <Text style={styles.resultsCount}>
                  {normalizeNumber(pagination.count, orders.length)} /{' '}
                  {normalizeNumber(pagination.total, orders.length)}
                </Text>
              </View>

              <Text style={styles.resultsText}>
                {t('admin.users.resultsPageLabel', {
                  page: normalizeNumber(pagination.page, 1),
                  pages: Math.max(normalizeNumber(pagination.pages, 1), 1),
                })}
              </Text>

              {hasActiveFilters ? (
                <Text style={styles.resultsFiltersText}>
                  {t('admin.users.activeFiltersPrefix')}
                  {resolvedStatusFilter
                    ? t('admin.orders.statusFilterQuoteFragment', { status: getStatusFilterLabel(resolvedStatusFilter, t) })
                    : ''}
                  {resolvedPaymentFilter
                    ? t('admin.orders.paymentFilterQuoteFragment', { payment: getPaymentLabel(resolvedPaymentFilter, t) })
                    : ''}
                </Text>
              ) : (
                <Text style={styles.resultsFiltersText}>
                  {t('admin.users.noActiveFiltersText')}
                </Text>
              )}
            </View>

            {!!errorMessage && orders.length === 0 ? (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle-outline" size={18} color="#B83232" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const statusStyle = getStatusColors(item?.status);
          const paymentStyle = getPaymentStyle(item?.paymentStatus);
          const orderCode = String(item?._id || '').slice(-6).toUpperCase();
          const hasDriver = Boolean(normalizeText(item?.driverName));

          return (
            <Pressable
              style={styles.card}
              onPress={() => openOrderDetails(item)}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardTitle}>
                    {normalizeText(item?.restaurantName, t('admin.orders.restaurantNameFallback'))}
                  </Text>

                  <Text style={styles.cardMeta}>
                    {t('livraison.history.orderReference', { ref: orderCode || '------' })}
                  </Text>

                  {!!normalizeText(item?.customerName) && (
                    <Text style={styles.cardMeta}>
                      {t('admin.orders.customerLabel', { name: normalizeText(item?.customerName) })}
                    </Text>
                  )}

                  {hasDriver ? (
                    <Text style={styles.cardMeta}>
                      {t('admin.orders.driverLabel', { name: normalizeText(item?.driverName) })}
                    </Text>
                  ) : (
                    <Text style={[styles.cardMeta, styles.cardMetaAlert]}>
                      {t('admin.orders.driverUnassignedLabel')}
                    </Text>
                  )}

                  {!!item?.createdAt && (
                    <Text style={styles.cardMeta}>
                      {t('admin.orders.createdOnLabel', { date: formatDateValue(item?.createdAt) })}
                    </Text>
                  )}

                  {!!item?.deliveryAddress && (
                    <Text style={styles.cardMeta} numberOfLines={2}>
                      {t('admin.orders.addressLabel', { address: normalizeText(item?.deliveryAddress) })}
                    </Text>
                  )}
                </View>

                <View
                  style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}
                >
                  <Ionicons
                    name={statusStyle.icon}
                    size={13}
                    color={statusStyle.text}
                  />
                  <Text
                    style={[styles.statusBadgeText, { color: statusStyle.text }]}
                  >
                    {t(ORDER_STATUS_SLUG[item?.status] || 'order.status.pending')}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaBadge}>
                  <Ionicons name="cash-outline" size={14} color="#D96C2D" />
                  <Text style={styles.metaBadgeText}>
                    {formatPrice(item?.totalPrice, item?.currency || 'EUR')}
                  </Text>
                </View>

                <View
                  style={[styles.metaBadge, { backgroundColor: paymentStyle.bg }]}
                >
                  <Ionicons
                    name={paymentStyle.icon}
                    size={14}
                    color={paymentStyle.text}
                  />
                  <Text
                    style={[
                      styles.metaBadgeText,
                      { color: paymentStyle.text },
                    ]}
                  >
                    {getPaymentLabel(item?.paymentStatus, t)}
                  </Text>
                </View>

                {!!normalizeText(item?.restaurantCuisine) && (
                  <View style={styles.metaBadge}>
                    <Ionicons name="restaurant-outline" size={14} color="#245EA8" />
                    <Text style={styles.metaBadgeText}>
                      {normalizeText(item?.restaurantCuisine)}
                    </Text>
                  </View>
                )}

                {item?.itemCount > 0 && (
                  <View style={styles.metaBadge}>
                    <Ionicons name="bag-handle-outline" size={14} color="#1F6F43" />
                    <Text style={styles.metaBadgeText}>
                      {t('admin.orders.itemCountLabel', { count: normalizeNumber(item?.itemCount) })}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.footerRow}>
                <View style={styles.footerBadge}>
                  <Ionicons name="eye-outline" size={15} color="#1F6F43" />
                  <Text style={styles.footerBadgeText}>{t('admin.users.viewDetailsButton')}</Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color="#777" />
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={54} color="#C8BBAA" />
            <Text style={styles.emptyTitle}>{t('admin.orders.emptyTitle')}</Text>
            <Text style={styles.emptyText}>
              {t('admin.orders.emptyText')}
            </Text>
          </View>
        }
      />
    </FadeInView>
  );
}

/**
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 60 },
  emptyListContent: { flexGrow: 1 },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
  },
  loaderText: { marginTop: 12, color: '#777', fontSize: 15 },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  topButtonDisabled: {
    opacity: 0.7,
  },

  header: { marginBottom: 18 },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F6F43',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#1E1E1E',
    marginBottom: 8,
  },
  subtitle: { color: '#6B655E', fontSize: 14, lineHeight: 21 },

  liveMonitorCard: {
    backgroundColor: '#EEF4FF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  liveMonitorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveMonitorTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveMonitorTitle: {
    marginLeft: 8,
    color: '#245EA8',
    fontSize: 16,
    fontWeight: '900',
  },
  liveBadge: {
    backgroundColor: '#245EA8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  liveMonitorText: {
    color: '#4F5F88',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  liveMonitorSubText: {
    color: '#245EA8',
    fontSize: 12,
    fontWeight: '800',
  },

  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 12,
  },
  statCard: {
    width: '31.33%',
    marginHorizontal: '1%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 8,
    elevation: 2,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '700',
    textAlign: 'center',
  },

  quickActionsGrid: {
    flexDirection: 'row',
    marginHorizontal: -4,
    marginBottom: 14,
  },
  quickActionCard: {
    width: '48%',
    marginHorizontal: '1%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    elevation: 2,
  },
  quickActionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111',
    marginBottom: 4,
  },
  quickActionText: {
    color: '#666',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },

  filterTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#555',
    marginBottom: 8,
  },
  filtersRow: {
    paddingBottom: 12,
  },
  filterChip: {
    backgroundColor: '#F3ECE4',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginRight: 10,
  },
  filterChipActive: {
    backgroundColor: '#1E1E1E',
  },
  filterChipText: {
    color: '#555',
    fontWeight: '700',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  actionsRow: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#D4A017',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  applyButtonText: {
    color: '#111',
    fontWeight: '900',
    fontSize: 14,
  },
  resetButton: {
    minWidth: 128,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5DDD2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  resetButtonText: {
    color: '#555',
    fontWeight: '800',
    fontSize: 13,
    marginLeft: 6,
  },

  resultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
  },
  resultsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    alignItems: 'center',
  },
  resultsTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111',
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1F6F43',
  },
  resultsText: {
    color: '#666',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '700',
  },
  resultsFiltersText: {
    color: '#6B655E',
    fontSize: 12,
    lineHeight: 18,
  },

  errorCard: {
    backgroundColor: '#FDECEC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    color: '#B83232',
    marginLeft: 8,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardLeft: {
    flex: 1,
    paddingRight: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
    marginBottom: 6,
  },
  cardMeta: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },
  cardMetaAlert: {
    color: '#B83232',
    fontWeight: '800',
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  metaBadgeText: {
    marginLeft: 6,
    color: '#555',
    fontWeight: '700',
    fontSize: 12,
  },

  footerRow: {
    borderTopWidth: 1,
    borderTopColor: '#F2ECE5',
    paddingTop: 12,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5FBF7',
    borderWidth: 1,
    borderColor: '#CFE5D7',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  footerBadgeText: {
    color: '#1F6F43',
    fontWeight: '800',
    fontSize: 13,
    marginLeft: 6,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    textAlign: 'center',
    color: '#1E1E1E',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#777',
    fontSize: 15,
    lineHeight: 22,
  },
});