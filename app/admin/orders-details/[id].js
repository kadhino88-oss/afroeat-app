import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  StatusBar,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../../../components/FadeInView';
import { useAuth } from '../../../context/AuthContext';
import { getAdminOrderById } from '../../../services/adminService';
import i18n from '../../../i18n';

const LIVE_REFRESH_MS = 15000;

const DATE_LOCALE_MAP = {
  fr: 'fr-FR',
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
  zh: 'zh-CN',
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

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const normalizeRole = (value) => normalizeText(value).toLowerCase();

const isAdminRole = (value) => {
  const role = normalizeRole(value);
  return (
    role === 'admin' ||
    role === 'administrator' ||
    role === 'superadmin' ||
    role === 'super-admin'
  );
};

const isDriverRole = (value) => {
  const role = normalizeRole(value);
  return role === 'livreur' || role === 'driver' || role === 'delivery';
};

const formatPrice = (value, currency = 'EUR') => {
  const amount = normalizeNumber(value, 0);
  const safeCurrency = normalizeText(currency, 'EUR').toUpperCase();

  if (safeCurrency === 'USD') return `$${amount.toFixed(2)}`;
  if (safeCurrency === 'GBP') return `£${amount.toFixed(2)}`;
  if (safeCurrency === 'CHF') return `CHF ${amount.toFixed(2)}`;
  if (safeCurrency === 'XOF' || safeCurrency === 'XAF') {
    return `${amount.toFixed(0)} ${safeCurrency}`;
  }
  if (safeCurrency === 'CAD') return `${amount.toFixed(2)} $CA`;

  return `${amount.toFixed(2)} €`;
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

const getSafeParam = (value) => {
  if (Array.isArray(value)) return normalizeText(value[0]);
  return normalizeText(value);
};

const getStatusStyle = (status, t) => {
  switch (normalizeText(status)) {
    case 'Livrée':
      return {
        bg: '#E3F0E8',
        text: '#084424',
        label: t('order.status.delivered'),
        icon: 'checkmark-circle-outline',
      };
    case 'En livraison':
      return {
        bg: '#F2ECE0',
        text: '#084424',
        label: t('order.status.on_the_way'),
        icon: 'bicycle-outline',
      };
    case 'En préparation':
      return {
        bg: '#F3E7CA',
        text: '#301904',
        label: t('order.status.preparing'),
        icon: 'restaurant-outline',
      };
    case 'Confirmée':
      return {
        bg: '#F2ECE0',
        text: '#084424',
        label: t('order.status.confirmed'),
        icon: 'checkmark-done-outline',
      };
    case 'Annulée':
      return {
        bg: '#F8E1DD',
        text: '#C8331A',
        label: t('order.status.cancelled'),
        icon: 'close-circle-outline',
      };
    default:
      return {
        bg: '#F3E7CA',
        text: '#C8331A',
        label: normalizeText(status) ? status : t('order.status.pending'),
        icon: 'time-outline',
      };
  }
};

const getPaymentStyle = (value, t) => {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized === 'paid' || normalized === 'payé') {
    return {
      bg: '#E3F0E8',
      text: '#084424',
      label: t('admin.orders.paymentPaidLabel'),
      icon: 'card-outline',
    };
  }

  if (normalized === 'unpaid' || normalized === 'non payé') {
    return {
      bg: '#F8E1DD',
      text: '#C8331A',
      label: t('admin.orders.paymentUnpaidLabel'),
      icon: 'alert-circle-outline',
    };
  }

  if (normalized === 'refunded' || normalized === 'remboursé') {
    return {
      bg: '#F2ECE0',
      text: '#084424',
      label: t('admin.orders.paymentRefundedLabel'),
      icon: 'swap-horizontal-outline',
    };
  }

  return {
    bg: '#F2ECE0',
    text: '#606D5D',
    label: normalizeText(value, t('admin.users.statusUnknownLabel')),
    icon: 'help-circle-outline',
  };
};

const getRiskStyle = (order, t) => {
  const status = normalizeText(order?.status);
  const payment = normalizeText(order?.paymentStatus).toLowerCase();
  const hasDriver = Boolean(order?.deliveryPerson?._id);
  const totalPrice = normalizeNumber(order?.totalPrice, 0);

  if (status === 'Annulée' || payment === 'unpaid' || payment === 'non payé') {
    return {
      bg: '#F8E1DD',
      text: '#C8331A',
      label: t('admin.restaurantDetails.riskHighLabel'),
      icon: 'alert-circle-outline',
    };
  }

  if (!hasDriver || totalPrice >= 100) {
    return {
      bg: '#F3E7CA',
      text: '#301904',
      label: t('admin.restaurantDetails.riskMediumLabel'),
      icon: 'warning-outline',
    };
  }

  return {
    bg: '#E3F0E8',
    text: '#084424',
    label: t('admin.restaurantDetails.riskLowLabel'),
    icon: 'checkmark-circle-outline',
  };
};

const normalizeOrder = (payload) => {
  const raw =
    payload?.order ||
    payload?.data?.order ||
    payload?.data ||
    payload ||
    null;

  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const items = normalizeArray(raw?.items).map((item) => ({
    ...item,
    _id: item?._id || item?.id || null,
    id: item?.id || item?._id || null,
    name: normalizeText(item?.name || item?.title || item?.menuItem?.name, i18n.t('admin.restaurantDetails.menuItemNameFallback')),
    price:
      item?.price !== undefined && item?.price !== null
        ? normalizeNumber(item?.price, 0)
        : normalizeNumber(item?.unitPrice, 0),
    quantity: normalizeNumber(item?.quantity, 0),
    notes: normalizeText(item?.notes),
  }));

  const restaurant =
    raw?.restaurant && typeof raw.restaurant === 'object'
      ? {
          ...raw.restaurant,
          _id: raw.restaurant?._id || raw.restaurant?.id || null,
          id: raw.restaurant?.id || raw.restaurant?._id || null,
          name: normalizeText(raw.restaurant?.name, i18n.t('admin.orders.restaurantNameFallback')),
          cuisine: normalizeText(raw.restaurant?.cuisine, i18n.t('admin.orderDetails.cuisineUndefinedShort')),
          email: normalizeText(raw.restaurant?.email),
          owner:
            raw.restaurant?.owner && typeof raw.restaurant.owner === 'object'
              ? {
                  ...raw.restaurant.owner,
                  _id:
                    raw.restaurant.owner?._id ||
                    raw.restaurant.owner?.id ||
                    null,
                  name: normalizeText(raw.restaurant.owner?.name, i18n.t('profile.info.notProvided')),
                }
              : null,
        }
      : null;

  const user =
    raw?.user && typeof raw.user === 'object'
      ? {
          ...raw.user,
          _id: raw.user?._id || raw.user?.id || null,
          id: raw.user?.id || raw.user?._id || null,
          name: normalizeText(raw.user?.name, i18n.t('admin.orderDetails.unknownClientFallback')),
          email: normalizeText(raw.user?.email),
          phone: normalizeText(raw.user?.phone),
        }
      : null;

  const deliveryPerson =
    raw?.deliveryPerson && typeof raw.deliveryPerson === 'object'
      ? {
          ...raw.deliveryPerson,
          _id: raw.deliveryPerson?._id || raw.deliveryPerson?.id || null,
          id: raw.deliveryPerson?.id || raw.deliveryPerson?._id || null,
          name: normalizeText(raw.deliveryPerson?.name, i18n.t('admin.orderDetails.unassignedDriverFallback')),
          email: normalizeText(raw.deliveryPerson?.email),
          phone: normalizeText(raw.deliveryPerson?.phone),
        }
      : null;

  return {
    ...raw,
    _id: raw?._id || raw?.id || null,
    id: raw?.id || raw?._id || null,
    status: normalizeText(raw?.status, i18n.t('order.status.pending')),
    paymentStatus: normalizeText(raw?.paymentStatus, i18n.t('admin.orders.paymentUnpaidLabel')),
    currency: normalizeText(raw?.currency, 'EUR').toUpperCase(),
    totalPrice: normalizeNumber(raw?.totalPrice, 0),
    deliveryAddress: normalizeText(raw?.deliveryAddress),
    notes: normalizeText(raw?.notes),
    createdAt: raw?.createdAt || null,
    updatedAt: raw?.updatedAt || null,
    restaurant,
    user,
    deliveryPerson,
    items,
  };
};

/**
 * =========================================================
 * UI BLOCKS
 * =========================================================
 */

const InfoCard = ({ title, children, footer }) => (
  <View style={styles.infoCard}>
    <Text style={styles.infoCardTitle}>{title}</Text>
    {children}
    {footer ? <View style={styles.infoCardFooter}>{footer}</View> : null}
  </View>
);

const MetaRow = ({ icon, label, value, valueStyle, multiline = false }) => (
  <View style={styles.metaRow}>
    <Ionicons name={icon} size={16} color="#606D5D" />
    <Text style={styles.metaLabel}>{label}</Text>
    <Text
      style={[
        styles.metaValue,
        multiline && styles.metaValueMultiline,
        valueStyle,
      ]}
    >
      {value}
    </Text>
  </View>
);

const FlagBox = ({ label, value, accent, icon }) => (
  <View style={styles.flagBox}>
    <View style={styles.flagBoxTop}>
      {icon ? <Ionicons name={icon} size={15} color={accent || '#0D1C11'} /> : null}
      <Text style={[styles.flagBoxValue, accent ? { color: accent } : null]}>
        {value}
      </Text>
    </View>
    <Text style={styles.flagBoxLabel}>{label}</Text>
  </View>
);

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function AdminOrderDetailsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const auth = useAuth() || {};

  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);
  const currentUser = auth.user ?? null;
  const currentRole = useMemo(
    () => normalizeRole(auth.role || currentUser?.role),
    [auth.role, currentUser]
  );

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastLiveRefresh, setLastLiveRefresh] = useState(null);

  const canAccess = Boolean(isAuthenticated && token && isAdminRole(currentRole));
  const orderId = getSafeParam(params?.id);

  const fetchOrder = useCallback(
    async (manual = false, silent = false) => {
      if (!token || !orderId || !isAuthenticated || !isAdminRole(currentRole)) {
        setOrder(null);
        setErrorMessage(
          !orderId ? t('admin.orders.invalidOrderAlert') : t('admin.users.invalidSessionAlert')
        );
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

        const data = await getAdminOrderById(orderId, token);
        const safeOrder = normalizeOrder(data);

        if (!safeOrder?._id) {
          throw new Error(t('admin.orderDetails.fetchErrorFallback'));
        }

        setOrder(safeOrder);
        setLastLiveRefresh(new Date().toISOString());
      } catch (error) {
        console.log('Erreur admin order details :', error);

        const message =
          error?.message || t('admin.orderDetails.fetchErrorFallback');

        if (!silent) {
          setOrder(null);
        }

        setErrorMessage(message);

        if (manual) {
          Alert.alert(t('common.error'), message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setInitialLoaded(true);
      }
    },
    [orderId, token, isAuthenticated, currentRole, t]
  );

  useFocusEffect(
    useCallback(() => {
      fetchOrder(false, false);
    }, [fetchOrder])
  );

  useEffect(() => {
    if (!canAccess || !orderId) {
      return undefined;
    }

    const interval = setInterval(() => {
      fetchOrder(false, true);
    }, LIVE_REFRESH_MS);

    return () => clearInterval(interval);
  }, [canAccess, orderId, fetchOrder]);

  const statusStyle = useMemo(() => getStatusStyle(order?.status, t), [order, t]);
  const paymentStyle = useMemo(() => getPaymentStyle(order?.paymentStatus, t), [order, t]);
  const riskStyle = useMemo(() => getRiskStyle(order, t), [order, t]);

  const orderCode = useMemo(() => {
    return String(order?._id || orderId || '').slice(-6).toUpperCase();
  }, [order, orderId]);

  const items = useMemo(() => normalizeArray(order?.items), [order]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity = normalizeNumber(item?.quantity, 0);
      const unitPrice = normalizeNumber(item?.price, 0);
      return sum + quantity * unitPrice;
    }, 0);
  }, [items]);

  const itemCount = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + normalizeNumber(item?.quantity, 0),
      0
    );
  }, [items]);

  const liveRefreshLabel = useMemo(() => {
    if (!lastLiveRefresh) {
      return t('admin.ops.liveRefreshWaiting');
    }

    return t('admin.ops.liveRefreshLabel', { date: formatDateTime(lastLiveRefresh) });
  }, [lastLiveRefresh, t]);

  const quickFlags = useMemo(() => {
    return [
      {
        key: 'status',
        label: t('restaurant.profile.statusLabel'),
        value: statusStyle.label,
        accent: statusStyle.text,
        icon: statusStyle.icon,
      },
      {
        key: 'payment',
        label: t('admin.orders.paymentFilterTitle'),
        value: paymentStyle.label,
        accent: paymentStyle.text,
        icon: paymentStyle.icon,
      },
      {
        key: 'delivery',
        label: t('restaurant.profile.deliveryLabel'),
        value: order?.deliveryPerson?._id ? t('admin.orderDetails.deliveryAssignedValue') : t('admin.orderDetails.deliveryUnassignedValue'),
        accent: order?.deliveryPerson?._id ? '#084424' : '#C8331A',
        icon: 'bicycle-outline',
      },
      {
        key: 'items',
        label: t('admin.orderDetails.itemsLabel'),
        value: String(itemCount),
        accent: '#084424',
        icon: 'bag-handle-outline',
      },
      {
        key: 'risk',
        label: t('admin.driverDetails.riskLabel'),
        value: riskStyle.label,
        accent: riskStyle.text,
        icon: riskStyle.icon,
      },
      {
        key: 'amount',
        label: t('admin.orderDetails.amountLabel'),
        value: formatPrice(order?.totalPrice, order?.currency || 'EUR'),
        accent: '#C8331A',
        icon: 'cash-outline',
      },
    ];
  }, [statusStyle, paymentStyle, order, itemCount, riskStyle, t]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/admin/orders');
  }, []);

  /**
   * =========================================================
   * GUARDS
   * =========================================================
   */

  if (authLoading || (loading && !initialLoaded)) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <ActivityIndicator size="large" color="#084424" />
        <Text style={styles.loaderText}>{t('admin.orderDetails.loaderText')}</Text>
      </View>
    );
  }

  if (!isAuthenticated || !token) {
    return <Redirect href="/auth/login?role=admin" />;
  }

  if (!isAdminRole(currentRole)) {
    if (currentRole === 'restaurant') {
      return <Redirect href="/restaurant/RestaurantDashboard" />;
    }

    if (isDriverRole(currentRole)) {
      return <Redirect href="/livraison/index" />;
    }

    return <Redirect href="/(tabs)/index" />;
  }

  if (!orderId) {
    return (
      <FadeInView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={56} color="#EAB02F" />
          <Text style={styles.emptyTitle}>{t('admin.orderDetails.notFoundTitleInvalid')}</Text>
          <Text style={styles.emptyText}>{t('admin.orderDetails.missingIdText')}</Text>

          <Pressable style={styles.retryButton} onPress={handleGoBack}>
            <Text style={styles.retryButtonText}>{t('admin.userDetails.backButton')}</Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  if (!order) {
    return (
      <FadeInView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={56} color="#EAB02F" />
          <Text style={styles.emptyTitle}>{t('admin.orderDetails.notFoundTitle')}</Text>
          <Text style={styles.emptyText}>
            {errorMessage || t('admin.orderDetails.fetchErrorEmptyText')}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={() => fetchOrder(true, false)}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                <Text style={styles.retryButtonText}>{t('restaurant.retry')}</Text>
              </>
            )}
          </Pressable>

          <Pressable style={styles.backLink} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={16} color="#084424" />
            <Text style={styles.backLinkText}>{t('admin.orderDetails.backToOrdersLink')}</Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  return (
    <FadeInView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchOrder(true, false)}
          />
        }
      >
        <View style={styles.topRow}>
          <Pressable style={styles.topButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={20} color="#0D1C11" />
          </Pressable>

          <Pressable
            style={[styles.topButton, refreshing && styles.topButtonDisabled]}
            onPress={() => fetchOrder(true, false)}
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
          <Text style={styles.eyebrow}>{t('admin.restaurantDetails.eyebrow')}</Text>
          <Text style={styles.title}>{t('admin.orderDetails.orderTitle', { code: orderCode || '------' })}</Text>
          <Text style={styles.subtitle}>
            {t('admin.orderDetails.subtitleOrder')}
          </Text>
        </View>

        <View style={styles.liveMonitorCard}>
          <View style={styles.liveMonitorHeader}>
            <View style={styles.liveMonitorTitleWrap}>
              <Ionicons name="radio-outline" size={18} color="#084424" />
              <Text style={styles.liveMonitorTitle}>{t('admin.orderDetails.liveMonitorTitleOrder')}</Text>
            </View>

            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>

          <Text style={styles.liveMonitorText}>
            {t('admin.orderDetails.liveMonitorTextOrder')}
          </Text>

          <Text style={styles.liveMonitorSubText}>{liveRefreshLabel}</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>
              {normalizeText(order?.restaurant?.name, t('admin.orders.restaurantNameFallback'))}
            </Text>
            <Text style={styles.heroText}>
              {t('admin.orderDetails.createdOnHero', { date: formatDateTime(order?.createdAt) })}
            </Text>
            <Text style={styles.heroSubText}>
              {t('admin.orders.customerLabel', { name: normalizeText(order?.user?.name, t('admin.orderDetails.unknownClientFallback')) })}
            </Text>
          </View>

          <View style={styles.heroBadges}>
            <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
              <Ionicons name={statusStyle.icon} size={14} color={statusStyle.text} />
              <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                {statusStyle.label}
              </Text>
            </View>

            <View
              style={[
                styles.badge,
                styles.badgeSecondary,
                { backgroundColor: paymentStyle.bg },
              ]}
            >
              <Ionicons name={paymentStyle.icon} size={14} color={paymentStyle.text} />
              <Text style={[styles.badgeText, { color: paymentStyle.text }]}>
                {paymentStyle.label}
              </Text>
            </View>

            <View
              style={[
                styles.badge,
                styles.badgeSecondary,
                { backgroundColor: riskStyle.bg },
              ]}
            >
              <Ionicons name={riskStyle.icon} size={14} color={riskStyle.text} />
              <Text style={[styles.badgeText, { color: riskStyle.text }]}>
                {t('admin.restaurantDetails.riskBadgeLabel', { level: riskStyle.label })}
              </Text>
            </View>
          </View>
        </View>

        <InfoCard title={t('admin.restaurantDetails.adminIndicatorsTitle')}>
          <View style={styles.flagGrid}>
            {quickFlags.map((flag) => (
              <FlagBox
                key={flag.key}
                label={flag.label}
                value={flag.value}
                accent={flag.accent}
                icon={flag.icon}
              />
            ))}
          </View>
        </InfoCard>

        <InfoCard title={t('admin.orderDetails.orderSummaryTitle')}>
          <MetaRow
            icon="receipt-outline"
            label={t('admin.orderDetails.referenceLabel')}
            value={`#${orderCode || '------'}`}
          />
          <MetaRow
            icon="cash-outline"
            label={t('admin.orderDetails.totalLabel')}
            value={formatPrice(order?.totalPrice, order?.currency || 'EUR')}
          />
          <MetaRow
            icon="card-outline"
            label={t('admin.orders.paymentFilterTitle')}
            value={paymentStyle.label}
            valueStyle={{ color: paymentStyle.text, fontWeight: '900' }}
          />
          <MetaRow
            icon="time-outline"
            label={t('admin.orderDetails.createdOnFieldLabelFem')}
            value={formatDateTime(order?.createdAt)}
          />
          <MetaRow
            icon="refresh-outline"
            label={t('admin.orderDetails.updatedFieldLabelFem')}
            value={formatDateTime(order?.updatedAt)}
          />
          <MetaRow
            icon="location-outline"
            label={t('restaurant.profile.addressLabel')}
            value={normalizeText(order?.deliveryAddress, t('restaurant.profile.cityFallback'))}
            multiline
          />
          <MetaRow
            icon="document-text-outline"
            label={t('admin.orderDetails.notesFieldLabel')}
            value={normalizeText(order?.notes, t('admin.orderDetails.noNotesValue'))}
            multiline
          />
        </InfoCard>

        <InfoCard title={t('admin.orderDetails.restaurantSectionTitle')}>
          <MetaRow
            icon="storefront-outline"
            label={t('restaurant.profile.nameLabel')}
            value={normalizeText(order?.restaurant?.name, t('admin.orderDetails.unknownRestaurantFallback'))}
          />
          <MetaRow
            icon="restaurant-outline"
            label={t('restaurant.profile.cuisineLabel')}
            value={normalizeText(order?.restaurant?.cuisine, t('admin.orderDetails.cuisineUndefinedShort'))}
          />
          <MetaRow
            icon="person-outline"
            label={t('admin.orderDetails.ownerFieldLabel')}
            value={normalizeText(order?.restaurant?.owner?.name, t('profile.info.notProvided'))}
          />
          <MetaRow
            icon="mail-outline"
            label={t('admin.userDetails.emailFieldLabel')}
            value={normalizeText(order?.restaurant?.email, t('profile.info.notProvided'))}
          />
        </InfoCard>

        <InfoCard title={t('admin.orderDetails.clientSectionTitle')}>
          <MetaRow
            icon="person-circle-outline"
            label={t('restaurant.profile.nameLabel')}
            value={normalizeText(order?.user?.name, t('admin.orderDetails.unknownClientFallback'))}
          />
          <MetaRow
            icon="mail-outline"
            label={t('admin.userDetails.emailFieldLabel')}
            value={normalizeText(order?.user?.email, t('profile.info.notProvided'))}
          />
          <MetaRow
            icon="call-outline"
            label={t('admin.userDetails.phoneFieldLabel')}
            value={normalizeText(order?.user?.phone, t('profile.info.notProvided'))}
          />
        </InfoCard>

        <InfoCard title={t('admin.orderDetails.driverSectionTitle')}>
          <MetaRow
            icon="bicycle-outline"
            label={t('restaurant.profile.nameLabel')}
            value={normalizeText(order?.deliveryPerson?.name, t('admin.orderDetails.unassignedDriverFallback'))}
          />
          <MetaRow
            icon="mail-outline"
            label={t('admin.userDetails.emailFieldLabel')}
            value={normalizeText(order?.deliveryPerson?.email, t('profile.info.notProvided'))}
          />
          <MetaRow
            icon="call-outline"
            label={t('admin.userDetails.phoneFieldLabel')}
            value={normalizeText(order?.deliveryPerson?.phone, t('profile.info.notProvided'))}
          />
        </InfoCard>

        <InfoCard
          title={t('admin.orderDetails.orderedItemsTitle')}
          footer={
            items.length > 0 ? (
              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('admin.orderDetails.estimatedSubtotalLabel')}</Text>
                  <Text style={styles.summaryValue}>
                    {formatPrice(subtotal, order?.currency || 'EUR')}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('admin.orderDetails.itemsLabel')}</Text>
                  <Text style={styles.summaryValue}>{itemCount}</Text>
                </View>

                <View style={[styles.summaryRow, styles.summaryRowLast]}>
                  <Text style={styles.summaryLabelStrong}>{t('admin.orderDetails.orderTotalLabel')}</Text>
                  <Text style={styles.summaryValueStrong}>
                    {formatPrice(order?.totalPrice, order?.currency || 'EUR')}
                  </Text>
                </View>
              </View>
            ) : null
          }
        >
          {items.length > 0 ? (
            items.map((item, index) => {
              const itemName = normalizeText(
                item?.name || item?.title || item?.menuItem?.name,
                t('admin.orderDetails.itemFallback', { index: index + 1 })
              );
              const quantity = normalizeNumber(item?.quantity, 0);
              const unitPrice = normalizeNumber(item?.price, 0);
              const lineTotal = quantity * unitPrice;

              return (
                <View
                  key={item?._id || `${itemName}-${index}`}
                  style={[
                    styles.itemRow,
                    index === items.length - 1 && styles.itemRowLast,
                  ]}
                >
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemName}>{itemName}</Text>

                    <Text style={styles.itemMeta}>
                      {t('admin.orderDetails.qtyLabel', { qty: quantity })}
                      {unitPrice > 0
                        ? t('admin.orderDetails.unitPriceFragment', { price: formatPrice(unitPrice, order?.currency || 'EUR') })
                        : ''}
                    </Text>

                    {!!normalizeText(item?.notes) && (
                      <Text style={styles.itemNotes}>
                        {t('admin.orderDetails.noteFragment', { note: normalizeText(item?.notes) })}
                      </Text>
                    )}
                  </View>

                  <Text style={styles.itemTotal}>
                    {formatPrice(lineTotal, order?.currency || 'EUR')}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyInfoText}>{t('admin.orderDetails.noItemsAvailable')}</Text>
          )}
        </InfoCard>

        {!!errorMessage ? (
          <View style={styles.softErrorCard}>
            <Ionicons name="warning-outline" size={18} color="#C8331A" />
            <Text style={styles.softErrorText}>{errorMessage}</Text>
          </View>
        ) : null}
      </ScrollView>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FBF6EC',
  },
  container: {
    flex: 1,
    backgroundColor: '#FBF6EC',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 60,
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBF6EC',
  },
  loaderText: {
    marginTop: 12,
    color: '#777',
    fontSize: 15,
  },

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
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  topButtonDisabled: {
    opacity: 0.7,
  },

  header: {
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    color: '#084424',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 8,
  },
  subtitle: {
    color: '#606D5D',
    fontSize: 14,
    lineHeight: 21,
  },

  liveMonitorCard: {
    backgroundColor: '#F2ECE0',
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
    color: '#084424',
    fontSize: 16,
    fontWeight: '900',
  },
  liveBadge: {
    backgroundColor: '#084424',
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
    color: '#084424',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  liveMonitorSubText: {
    color: '#084424',
    fontSize: 12,
    fontWeight: '800',
  },

  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    elevation: 2,
  },
  heroLeft: {
    flex: 1,
    paddingRight: 12,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#111',
    marginBottom: 8,
  },
  heroText: {
    color: '#666',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
  },
  heroSubText: {
    color: '#606D5D',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  heroBadges: {
    alignItems: 'flex-end',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeSecondary: {
    marginTop: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
  },
  infoCardTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111',
    marginBottom: 14,
  },
  infoCardFooter: {
    marginTop: 14,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metaLabel: {
    marginLeft: 8,
    width: 92,
    color: '#606D5D',
    fontSize: 13,
    fontWeight: '700',
  },
  metaValue: {
    flex: 1,
    color: '#111',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  metaValueMultiline: {
    lineHeight: 20,
  },

  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2ECE0',
  },
  itemRowLast: {
    marginBottom: 0,
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  itemLeft: {
    flex: 1,
    paddingRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111',
    marginBottom: 4,
  },
  itemMeta: {
    color: '#666',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  itemNotes: {
    color: '#606D5D',
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  itemTotal: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },

  summaryBox: {
    backgroundColor: '#F2ECE0',
    borderRadius: 16,
    padding: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryRowLast: {
    marginBottom: 0,
  },
  summaryLabel: {
    color: '#606D5D',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryLabelStrong: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },
  summaryValue: {
    color: '#111',
    fontSize: 13,
    fontWeight: '800',
  },
  summaryValueStrong: {
    color: '#111',
    fontSize: 15,
    fontWeight: '900',
  },

  flagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  flagBox: {
    width: '48%',
    marginHorizontal: '1%',
    backgroundColor: '#F2ECE0',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  flagBoxTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  flagBoxValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111',
    marginLeft: 6,
  },
  flagBoxLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '700',
  },

  emptyInfoText: {
    color: '#777',
    fontSize: 14,
    lineHeight: 21,
  },

  softErrorCard: {
    marginTop: 2,
    backgroundColor: '#F8E1DD',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  softErrorText: {
    marginLeft: 8,
    color: '#C8331A',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
    flex: 1,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
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
    color: '#777',
    fontSize: 15,
    lineHeight: 22,
  },

  retryButton: {
    marginTop: 18,
    backgroundColor: '#084424',
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonPressed: {
    opacity: 0.9,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },

  backLink: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backLinkText: {
    marginLeft: 8,
    color: '#084424',
    fontSize: 14,
    fontWeight: '800',
  },
});