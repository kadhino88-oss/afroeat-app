import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  StatusBar,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import FadeInView from '../../../components/FadeInView';
import { useAuth } from '../../../context/AuthContext';
import { apiGet } from '../../../services/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';
import { updateOrderStatus } from '../../../services/orderService';
import { getActiveDrivers, assignDriverToOrder } from '../../../services/driverService';
import i18n from '../../../i18n';

const LIVE_REFRESH_MS = 15000;

/**
 * ================= HELPERS ULTRA SAFE =================
 */

const normalizeText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  const str = String(value).trim();
  return str || fallback;
};

const normalizeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const normalizeStatus = (status) => {
  const s = normalizeText(status).toLowerCase();

  if (
    s.includes('delivered') ||
    s.includes('livrée') ||
    s.includes('livre') ||
    s.includes('termin')
  ) {
    return 'delivered';
  }

  if (
    s.includes('out_for_delivery') ||
    s.includes('delivery') ||
    s.includes('livraison') ||
    s.includes('route')
  ) {
    return 'delivery';
  }

  if (
    s.includes('preparing') ||
    s.includes('prépa') ||
    s.includes('prepa') ||
    s.includes('cooking')
  ) {
    return 'preparing';
  }

  if (
    s.includes('confirmed') ||
    s.includes('confirmée') ||
    s.includes('confirm')
  ) {
    return 'confirmed';
  }

  if (
    s.includes('cancelled') ||
    s.includes('canceled') ||
    s.includes('annul')
  ) {
    return 'cancelled';
  }

  return 'pending';
};

const DATE_LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-ES', it: 'it-IT', zh: 'zh-CN' };

const formatDateTime = (value) => {
  if (!value) return i18n.t('livraison.history.dateUnavailable');
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? i18n.t('livraison.history.dateUnavailable')
    : d.toLocaleString(DATE_LOCALE_MAP[i18n.language] || 'en-US');
};

const formatPrice = (value, currency = 'EUR') => {
  const amount = normalizeNumber(value, 0);

  try {
    return new Intl.NumberFormat(DATE_LOCALE_MAP[i18n.language] || 'en-US', {
      style: 'currency',
      currency: normalizeText(currency, 'EUR'),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} €`;
  }
};

const getOrderIdentifier = (order) =>
  normalizeText(order?._id || order?.id || order?.orderNumber || order?.reference, '—');

const getCustomerName = (order) =>
  normalizeText(
    order?.user?.name ||
      order?.customer?.name ||
      order?.client?.name ||
      order?.deliveryAddress?.fullName ||
      order?.shippingAddress?.fullName,
    i18n.t('restaurant.orderDetails.customerNameFallback')
  );

const getCustomerPhone = (order) =>
  normalizeText(
    order?.user?.phone ||
      order?.customer?.phone ||
      order?.client?.phone ||
      order?.deliveryAddress?.phone ||
      order?.shippingAddress?.phone,
    ''
  );

const getCurrency = (order) =>
  normalizeText(order?.currency || order?.payment?.currency || 'EUR', 'EUR');

const getRawOrderItems = (order) => {
  return normalizeArray(
    order?.items ||
      order?.orderItems ||
      order?.products ||
      order?.lines ||
      order?.cart?.items
  );
};

const normalizeOrderItem = (item, index = 0) => {
  const quantity = normalizeNumber(
    item?.quantity ?? item?.qty ?? item?.count ?? 1,
    1
  );

  const unitPrice = normalizeNumber(
    item?.price ??
      item?.unitPrice ??
      item?.salePrice ??
      item?.amount ??
      item?.dish?.price ??
      item?.menuItem?.price ??
      item?.product?.price,
    0
  );

  const totalPrice = normalizeNumber(
    item?.total ??
      item?.totalPrice ??
      item?.lineTotal ??
      item?.subtotal,
    unitPrice * quantity
  );

  const name = normalizeText(
    item?.name ||
      item?.title ||
      item?.dish?.name ||
      item?.menuItem?.name ||
      item?.product?.name ||
      item?.productName,
    i18n.t('restaurant.orderDetails.articleFallback', { index: index + 1 })
  );

  const note = normalizeText(
    item?.notes || item?.note || item?.specialInstructions,
    ''
  );

  return {
    id: normalizeText(item?._id || item?.id || `${name}-${index}`),
    name,
    quantity,
    unitPrice,
    totalPrice,
    note,
  };
};

const getPricing = (order, items) => {
  const subtotalFromItems = items.reduce(
    (sum, item) => sum + normalizeNumber(item.totalPrice),
    0
  );

  const subtotal = normalizeNumber(
    order?.subtotal ??
      order?.pricing?.subtotal ??
      order?.totals?.subtotal,
    subtotalFromItems
  );

  const deliveryFee = normalizeNumber(
    order?.deliveryFee ??
      order?.fees?.delivery ??
      order?.pricing?.deliveryFee ??
      order?.totals?.deliveryFee,
    0
  );

  const serviceFee = normalizeNumber(
    order?.serviceFee ??
      order?.fees?.service ??
      order?.pricing?.serviceFee ??
      order?.totals?.serviceFee,
    0
  );

  const tax = normalizeNumber(
    order?.tax ??
      order?.taxAmount ??
      order?.fees?.tax ??
      order?.pricing?.tax ??
      order?.totals?.tax,
    0
  );

  const discount = normalizeNumber(
    order?.discount ??
      order?.discountAmount ??
      order?.fees?.discount ??
      order?.pricing?.discount ??
      order?.totals?.discount,
    0
  );

  const explicitTotal = normalizeNumber(
    order?.total ??
      order?.totalAmount ??
      order?.pricing?.total ??
      order?.totals?.total,
    NaN
  );

  const computedTotal = subtotal + deliveryFee + serviceFee + tax - discount;

  return {
    subtotal,
    deliveryFee,
    serviceFee,
    tax,
    discount,
    total: Number.isFinite(explicitTotal) ? explicitTotal : computedTotal,
  };
};

/**
 * ================= STATUS UI =================
 */

const STATUS_SLUG_TO_ORDER_KEY = {
  delivered: 'delivered',
  delivery: 'on_the_way',
  preparing: 'preparing',
  confirmed: 'confirmed',
  cancelled: 'cancelled',
  pending: 'pending',
};

const getStatusStyle = (status) => {
  const s = normalizeStatus(status);

  switch (s) {
    case 'delivered':
      return {
        bg: '#E3F0E8',
        text: '#084424',
        border: '#E3F0E8',
        slug: s,
        icon: 'checkmark-circle-outline',
      };

    case 'delivery':
      return {
        bg: '#F2ECE0',
        text: '#084424',
        border: '#E3F0E8',
        slug: s,
        icon: 'bicycle-outline',
      };

    case 'preparing':
      return {
        bg: '#F3E7CA',
        text: '#301904',
        border: '#EAB02F',
        slug: s,
        icon: 'restaurant-outline',
      };

    case 'confirmed':
      return {
        bg: '#F2ECE0',
        text: '#084424',
        border: '#E3F0E8',
        slug: s,
        icon: 'checkmark-done-outline',
      };

    case 'cancelled':
      return {
        bg: '#F8E1DD',
        text: '#C8331A',
        border: '#F8E1DD',
        slug: s,
        icon: 'close-circle-outline',
      };

    default:
      return {
        bg: '#F3E7CA',
        text: '#C8331A',
        border: '#F3E7CA',
        slug: 'pending',
        icon: 'time-outline',
      };
  }
};

/**
 * ================= COMPONENT =================
 */

export default function RestaurantOrderDetailsScreen() {
  const { t } = useTranslation();
  const { token, isAuthenticated } = useAuth();
  const params = useLocalSearchParams();
  const orderId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(false);

  const fetchOrder = useCallback(
    async (manual = false, silent = false) => {
      const requestId = ++requestIdRef.current;

      if (!token || !isAuthenticated || !orderId) {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }

      try {
        if (silent) {
          // Background polling should not interrupt the current screen.
        } else if (manual) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const res = await apiGet(API_ENDPOINTS.orders.all, token);
        const list = normalizeArray(res?.items || res?.orders || res?.data || res);

        const found = list.find(
          (o) => String(o?._id || o?.id || o?.orderNumber) === String(orderId)
        );

        if (!found) {
          throw new Error(t('restaurant.orderDetails.notFoundTitle'));
        }

        if (isMountedRef.current && requestId === requestIdRef.current) {
          setOrder(found);
          setLoadError('');
        }
      } catch (error) {
        console.log('RestaurantOrderDetailsScreen fetchOrder error:', error);

        if (isMountedRef.current && requestId === requestIdRef.current) {
          setLoadError(t('restaurant.refreshFailed'));
        }
      } finally {
        if (isMountedRef.current && requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [token, isAuthenticated, orderId, t]
  );

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      fetchOrder(false);
      const interval = token && orderId
        ? setInterval(() => fetchOrder(false, true), LIVE_REFRESH_MS)
        : null;

      return () => {
        if (interval) clearInterval(interval);
        requestIdRef.current += 1;
      isMountedRef.current = false;
      };
    }, [fetchOrder, token, orderId])
  );

  const currency = useMemo(() => getCurrency(order), [order]);

  const items = useMemo(() => {
    return getRawOrderItems(order).map((item, index) => normalizeOrderItem(item, index));
  }, [order]);

  const pricing = useMemo(() => getPricing(order, items), [order, items]);

  const status = useMemo(() => getStatusStyle(order?.status), [order]);
  const statusLabel = useMemo(
    () => t(`order.status.${STATUS_SLUG_TO_ORDER_KEY[status.slug] || 'pending'}`),
    [status, t]
  );

  const customerName = useMemo(() => getCustomerName(order), [order]);
  const customerPhone = useMemo(() => getCustomerPhone(order), [order]);

  const orderCode = useMemo(() => getOrderIdentifier(order), [order]);

  const createdAtLabel = useMemo(
    () => formatDateTime(order?.createdAt || order?.created_at || order?.date),
    [order]
  );

  const rawStatus = normalizeText(order?.status);
  const assignedDriver =
    order?.deliveryPerson && typeof order.deliveryPerson === 'object'
      ? order.deliveryPerson
      : null;
  const hasDriver = !!(assignedDriver?._id || (typeof order?.deliveryPerson === 'string' && order.deliveryPerson));
  const canConfirm = rawStatus === 'En attente';
  const canPrepare = rawStatus === 'Confirmée';
  const canCancel = ['En attente', 'Confirmée', 'En préparation'].includes(rawStatus);
  const canAssign = ['Confirmée', 'En préparation'].includes(rawStatus);

  const runStatusChange = async (nextStatus) => {
    if (!order?._id || actionBusy) return;
    setActionBusy(nextStatus);
    setActionError('');
    try {
      await updateOrderStatus(order._id, nextStatus, token);
      setConfirmCancel(false);
      await fetchOrder(false, true);
    } catch (error) {
      setActionError(error?.message || t('restaurant.orderDetails.actionError'));
    } finally {
      setActionBusy('');
    }
  };

  const openDriverPicker = async () => {
    setDriverPickerOpen(true);
    setDriversLoading(true);
    setActionError('');
    try {
      const res = await getActiveDrivers(token, { limit: 50 });
      setDrivers(normalizeArray(res?.drivers));
    } catch (error) {
      setDrivers([]);
      setActionError(error?.message || t('restaurant.orderDetails.driversError'));
    } finally {
      setDriversLoading(false);
    }
  };

  const assignDriver = async (driverId) => {
    if (!order?._id || actionBusy) return;
    setActionBusy('assign');
    setActionError('');
    try {
      await assignDriverToOrder(order._id, driverId, token);
      setDriverPickerOpen(false);
      await fetchOrder(false, true);
    } catch (error) {
      setActionError(error?.message || t('restaurant.orderDetails.assignError'));
    } finally {
      setActionBusy('');
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#084424" />
        <Text style={styles.loaderText}>{t('restaurant.orderDetails.loaderText')}</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="receipt-outline" size={52} color="#606D5D" />
        <Text style={styles.emptyTitle}>{t('restaurant.orderDetails.notFoundTitle')}</Text>
        <Text style={styles.emptyText}>
          {t('restaurant.orderDetails.notFoundText')}
        </Text>

        {!!loadError && (
          <>
            <Text style={styles.refreshNoticeText}>{loadError}</Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => fetchOrder(true)}
              disabled={refreshing}
              accessibilityRole="button"
            >
              {refreshing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>{t('common.retry')}</Text>
              )}
            </Pressable>
          </>
        )}

        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>{t('livraison.tracking.backButton')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchOrder(true)}
            colors={['#084424']}
            tintColor="#084424"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {!!loadError && (
          <View style={styles.refreshNotice}>
            <Ionicons name="cloud-offline-outline" size={18} color="#C8331A" />
            <Text style={styles.refreshNoticeText}>{loadError}</Text>
          </View>
        )}

        {/* HEADER */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#0D1C11" />
          </Pressable>

          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>{t('restaurant.orderDetails.detailTitle')}</Text>
            <Text style={styles.subtitle}>{t('restaurant.orderDetails.refLabel', { ref: orderCode })}</Text>
          </View>
        </View>

        {/* STATUS CARD */}
        <View style={styles.card}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: status.bg,
                borderColor: status.border,
              },
            ]}
          >
            <Ionicons name={status.icon} size={16} color={status.text} />
            <Text style={[styles.badgeText, { color: status.text }]}>{statusLabel}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t('restaurant.orderDetails.createdAtLabel')}</Text>
            <Text style={styles.metaValue}>{createdAtLabel}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t('restaurant.orderDetails.rawStatusLabel')}</Text>
            <Text style={styles.metaValue}>{normalizeText(order?.status, '—')}</Text>
          </View>
        </View>

        {/* ACTIONS */}
        {(canConfirm || canPrepare || canCancel || canAssign || hasDriver) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('restaurant.orderDetails.actionsTitle')}</Text>

            {canConfirm && (
              <Pressable
                style={styles.actionPrimary}
                accessibilityRole="button"
                disabled={!!actionBusy}
                onPress={() => runStatusChange('Confirmée')}
              >
                {actionBusy === 'Confirmée' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.actionPrimaryText}>{t('restaurant.orderDetails.acceptOrder')}</Text>
                )}
              </Pressable>
            )}

            {canPrepare && (
              <Pressable
                style={styles.actionPrimary}
                accessibilityRole="button"
                disabled={!!actionBusy}
                onPress={() => runStatusChange('En préparation')}
              >
                {actionBusy === 'En préparation' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.actionPrimaryText}>{t('restaurant.orderDetails.startPreparing')}</Text>
                )}
              </Pressable>
            )}

            {hasDriver && (
              <View style={styles.infoRow}>
                <Ionicons name="bicycle-outline" size={18} color="#084424" />
                <Text style={styles.infoText}>
                  {t('restaurant.orderDetails.assignedDriver', {
                    name: normalizeText(assignedDriver?.name, t('restaurant.orderDetails.driverFallback')),
                  })}
                </Text>
              </View>
            )}

            {canAssign && (
              <Pressable
                style={styles.actionSecondary}
                accessibilityRole="button"
                disabled={!!actionBusy}
                onPress={() => (driverPickerOpen ? setDriverPickerOpen(false) : openDriverPicker())}
              >
                <Text style={styles.actionSecondaryText}>
                  {hasDriver ? t('restaurant.orderDetails.changeDriver') : t('restaurant.orderDetails.assignDriver')}
                </Text>
              </Pressable>
            )}

            {canAssign && driverPickerOpen && (
              <View style={styles.driverList}>
                {driversLoading ? (
                  <ActivityIndicator color="#084424" />
                ) : drivers.length === 0 ? (
                  <Text style={styles.emptyText}>{t('restaurant.orderDetails.noDriversAvailable')}</Text>
                ) : (
                  drivers.map((driver) => (
                    <Pressable
                      key={driver._id}
                      style={styles.driverRow}
                      accessibilityRole="button"
                      disabled={!!actionBusy}
                      onPress={() => assignDriver(driver._id)}
                    >
                      <Ionicons name="person-circle-outline" size={22} color="#084424" />
                      <Text style={styles.driverName}>{driver.name}</Text>
                      {actionBusy === 'assign' ? (
                        <ActivityIndicator color="#084424" />
                      ) : (
                        <Text style={styles.driverPick}>{t('restaurant.orderDetails.pickDriver')}</Text>
                      )}
                    </Pressable>
                  ))
                )}
              </View>
            )}

            {canCancel && (
              <Pressable
                style={styles.actionDanger}
                accessibilityRole="button"
                disabled={!!actionBusy}
                onPress={() => (confirmCancel ? runStatusChange('Annulée') : setConfirmCancel(true))}
              >
                {actionBusy === 'Annulée' ? (
                  <ActivityIndicator color="#C8331A" />
                ) : (
                  <Text style={styles.actionDangerText}>
                    {confirmCancel
                      ? t('restaurant.orderDetails.confirmCancel')
                      : t('restaurant.orderDetails.cancelOrder')}
                  </Text>
                )}
              </Pressable>
            )}

            {!!actionError && <Text style={styles.actionErrorText}>{actionError}</Text>}
          </View>
        )}

        {/* CLIENT */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('restaurant.orderDetails.clientSectionTitle')}</Text>

          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color="#084424" />
            <Text style={styles.infoText}>{customerName}</Text>
          </View>

          {!!customerPhone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color="#084424" />
              <Text style={styles.infoText}>{customerPhone}</Text>
            </View>
          )}

          {!!normalizeText(order?.deliveryAddress?.address || order?.shippingAddress?.address) && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color="#084424" />
              <Text style={styles.infoText}>
                {normalizeText(
                  order?.deliveryAddress?.address || order?.shippingAddress?.address
                )}
              </Text>
            </View>
          )}
        </View>

        {/* ITEMS */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('restaurant.orderDetails.itemsSectionTitle')}</Text>
            <Text style={styles.sectionCount}>
              {t('livraison.itemsCount', { count: items.length })}
            </Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyItemsBox}>
              <Ionicons name="restaurant-outline" size={24} color="#E3DECF" />
              <Text style={styles.emptyItemsText}>{t('restaurant.orderDetails.noItemsFound')}</Text>
            </View>
          ) : (
            items.map((item, index) => (
              <View
                key={item.id || `${item.name}-${index}`}
                style={[
                  styles.itemCard,
                  index === items.length - 1 ? styles.itemCardLast : null,
                ]}
              >
                <View style={styles.itemTopRow}>
                  <View style={styles.itemNameWrap}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {!!item.note && <Text style={styles.itemNote}>{t('restaurant.orderDetails.noteLabel', { note: item.note })}</Text>}
                  </View>

                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyBadgeText}>x{item.quantity}</Text>
                  </View>
                </View>

                <View style={styles.itemBottomRow}>
                  <Text style={styles.itemUnitPrice}>
                    {t('restaurant.orderDetails.unitPriceSuffix', { price: formatPrice(item.unitPrice, currency) })}
                  </Text>
                  <Text style={styles.itemTotalPrice}>
                    {formatPrice(item.totalPrice, currency)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* TOTALS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('restaurant.orderDetails.paymentSummaryTitle')}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{t('restaurant.orderDetails.subtotalLabel')}</Text>
            <Text style={styles.priceValue}>{formatPrice(pricing.subtotal, currency)}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{t('restaurant.orders.deliveringStatLabel')}</Text>
            <Text style={styles.priceValue}>{formatPrice(pricing.deliveryFee, currency)}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{t('restaurant.orderDetails.serviceFeeLabel')}</Text>
            <Text style={styles.priceValue}>{formatPrice(pricing.serviceFee, currency)}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{t('restaurant.orderDetails.taxesLabel')}</Text>
            <Text style={styles.priceValue}>{formatPrice(pricing.tax, currency)}</Text>
          </View>

          {pricing.discount > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>{t('restaurant.orderDetails.discountLabel')}</Text>
              <Text style={[styles.priceValue, styles.discountValue]}>
                - {formatPrice(pricing.discount, currency)}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('restaurant.menuScreen.totalLabel')}</Text>
            <Text style={styles.totalValue}>{formatPrice(pricing.total, currency)}</Text>
          </View>
        </View>
      </ScrollView>
    </FadeInView>
  );
}

/**
 * ================= STYLES =================
 */

const styles = StyleSheet.create({
  actionPrimary: { backgroundColor: '#084424', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  actionPrimaryText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  actionSecondary: { borderWidth: 1, borderColor: '#084424', borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  actionSecondaryText: { color: '#084424', fontWeight: '800', fontSize: 14 },
  actionDanger: { borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 12, backgroundColor: '#F8E1DD' },
  actionDangerText: { color: '#C8331A', fontWeight: '800', fontSize: 14 },
  actionErrorText: { color: '#C8331A', marginTop: 10, fontSize: 13 },
  driverList: { marginTop: 10, gap: 8 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: '#F2ECE0' },
  driverName: { flex: 1, color: '#0D1C11', fontWeight: '700' },
  driverPick: { color: '#084424', fontWeight: '900' },
  container: {
    flex: 1,
    backgroundColor: '#FBF6EC',
  },

  scrollContent: {
    paddingBottom: 32,
  },

  refreshNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E7CA',
    borderColor: '#F3E7CA',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 4,
    gap: 8,
  },
  refreshNoticeText: {
    color: '#C8331A',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBF6EC',
    paddingHorizontal: 24,
  },

  loaderText: {
    marginTop: 14,
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
  },

  emptyState: {
    flex: 1,
    backgroundColor: '#FBF6EC',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },

  emptyTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '900',
    color: '#111',
  },

  emptyText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  headerTextWrap: {
    marginLeft: 12,
    flex: 1,
  },

  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111',
  },

  subtitle: {
    marginTop: 3,
    fontSize: 13,
    color: '#777',
    fontWeight: '600',
  },

  card: {
    marginHorizontal: 18,
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F2ECE0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  badgeText: {
    marginLeft: 8,
    fontWeight: '800',
    fontSize: 13,
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    marginTop: 8,
  },

  metaLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },

  metaValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    color: '#111',
    fontWeight: '700',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
    marginBottom: 14,
  },

  sectionCount: {
    fontSize: 13,
    color: '#777',
    fontWeight: '700',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    marginBottom: 10,
  },

  infoText: {
    marginLeft: 10,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#222',
    fontWeight: '600',
  },

  emptyItemsBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E3DECF',
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF9',
  },

  emptyItemsText: {
    marginTop: 10,
    color: '#777',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  itemCard: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2ECE0',
  },

  itemCardLast: {
    borderBottomWidth: 0,
    paddingBottom: 4,
  },

  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  itemNameWrap: {
    flex: 1,
  },

  itemName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D1C11',
    lineHeight: 21,
  },

  itemNote: {
    marginTop: 6,
    fontSize: 13,
    color: '#777',
    lineHeight: 18,
    fontWeight: '500',
  },

  qtyBadge: {
    minWidth: 42,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F2ECE0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  qtyBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#301904',
  },

  itemBottomRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  itemUnitPrice: {
    fontSize: 13,
    color: '#777',
    fontWeight: '600',
  },

  itemTotalPrice: {
    fontSize: 15,
    color: '#111',
    fontWeight: '900',
  },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 7,
  },

  priceLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },

  priceValue: {
    fontSize: 14,
    color: '#111',
    fontWeight: '800',
  },

  discountValue: {
    color: '#084424',
  },

  divider: {
    height: 1,
    backgroundColor: '#F2ECE0',
    marginVertical: 14,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  totalLabel: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
  },

  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#084424',
  },

  primaryButton: {
    backgroundColor: '#084424',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
});
