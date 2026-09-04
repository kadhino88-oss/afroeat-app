import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  StatusBar,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import FadeInView from '../../../components/FadeInView';
import { useAuth } from '../../../context/AuthContext';
import { apiGet } from '../../../services/apiClient';
import { API_ENDPOINTS } from '../../../constants/api';

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

const formatDateTime = (value) => {
  if (!value) return 'Date indisponible';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Date indisponible' : d.toLocaleString('fr-FR');
};

const formatPrice = (value, currency = 'EUR') => {
  const amount = normalizeNumber(value, 0);

  try {
    return new Intl.NumberFormat('fr-FR', {
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
    'Client non renseigné'
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
    `Article ${index + 1}`
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

const getStatusStyle = (status) => {
  const s = normalizeStatus(status);

  switch (s) {
    case 'delivered':
      return {
        bg: '#E8F5ED',
        text: '#1F6F43',
        border: '#CFE8D8',
        label: 'Livrée',
        icon: 'checkmark-circle-outline',
      };

    case 'delivery':
      return {
        bg: '#EAF3FF',
        text: '#245EA8',
        border: '#CFE1FF',
        label: 'En livraison',
        icon: 'bicycle-outline',
      };

    case 'preparing':
      return {
        bg: '#FFF3D8',
        text: '#8A6500',
        border: '#F4DEAA',
        label: 'En préparation',
        icon: 'restaurant-outline',
      };

    case 'confirmed':
      return {
        bg: '#EFE9FF',
        text: '#6D4CDB',
        border: '#DDD1FF',
        label: 'Confirmée',
        icon: 'checkmark-done-outline',
      };

    case 'cancelled':
      return {
        bg: '#FDECEC',
        text: '#B83232',
        border: '#F7CFCF',
        label: 'Annulée',
        icon: 'close-circle-outline',
      };

    default:
      return {
        bg: '#FFF0E8',
        text: '#D96C2D',
        border: '#FFD9C6',
        label: 'En attente',
        icon: 'time-outline',
      };
  }
};

/**
 * ================= COMPONENT =================
 */

export default function RestaurantOrderDetailsScreen() {
  const { token, isAuthenticated } = useAuth();
  const params = useLocalSearchParams();
  const orderId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const isMountedRef = useRef(true);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrder = useCallback(
    async (manual = false) => {
      if (!token || !isAuthenticated || !orderId) {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }

      try {
        if (manual) {
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
          throw new Error('Commande introuvable');
        }

        if (isMountedRef.current) {
          setOrder(found);
        }
      } catch (error) {
        console.log('RestaurantOrderDetailsScreen fetchOrder error:', error);

        if (manual) {
          Alert.alert('Erreur', error?.message || 'Impossible de rafraîchir la commande.');
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [token, isAuthenticated, orderId]
  );

  useFocusEffect(
    useCallback(() => {
      fetchOrder(false);
    }, [fetchOrder])
  );

  useEffect(() => {
    isMountedRef.current = true;

    if (!token || !orderId) return undefined;

    const interval = setInterval(() => {
      fetchOrder(true);
    }, LIVE_REFRESH_MS);

    return () => {
      clearInterval(interval);
      isMountedRef.current = false;
    };
  }, [fetchOrder, token, orderId]);

  const currency = useMemo(() => getCurrency(order), [order]);

  const items = useMemo(() => {
    return getRawOrderItems(order).map((item, index) => normalizeOrderItem(item, index));
  }, [order]);

  const pricing = useMemo(() => getPricing(order, items), [order, items]);

  const status = useMemo(() => getStatusStyle(order?.status), [order]);

  const customerName = useMemo(() => getCustomerName(order), [order]);
  const customerPhone = useMemo(() => getCustomerPhone(order), [order]);

  const orderCode = useMemo(() => getOrderIdentifier(order), [order]);

  const createdAtLabel = useMemo(
    () => formatDateTime(order?.createdAt || order?.created_at || order?.date),
    [order]
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#1F6F43" />
        <Text style={styles.loaderText}>Chargement de la commande...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="receipt-outline" size={52} color="#B8B8B8" />
        <Text style={styles.emptyTitle}>Commande introuvable</Text>
        <Text style={styles.emptyText}>
          Cette commande est indisponible ou n’existe plus dans la liste actuelle.
        </Text>

        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchOrder(true)}
            colors={['#1F6F43']}
            tintColor="#1F6F43"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#161616" />
          </Pressable>

          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Détail commande</Text>
            <Text style={styles.subtitle}>Réf. {orderCode}</Text>
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
            <Text style={[styles.badgeText, { color: status.text }]}>{status.label}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Créée le</Text>
            <Text style={styles.metaValue}>{createdAtLabel}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Statut brut</Text>
            <Text style={styles.metaValue}>{normalizeText(order?.status, '—')}</Text>
          </View>
        </View>

        {/* CLIENT */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Client</Text>

          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color="#1F6F43" />
            <Text style={styles.infoText}>{customerName}</Text>
          </View>

          {!!customerPhone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color="#1F6F43" />
              <Text style={styles.infoText}>{customerPhone}</Text>
            </View>
          )}

          {!!normalizeText(order?.deliveryAddress?.address || order?.shippingAddress?.address) && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color="#1F6F43" />
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
            <Text style={styles.sectionTitle}>Articles</Text>
            <Text style={styles.sectionCount}>
              {items.length} {items.length > 1 ? 'articles' : 'article'}
            </Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyItemsBox}>
              <Ionicons name="restaurant-outline" size={24} color="#C2C2C2" />
              <Text style={styles.emptyItemsText}>Aucun article trouvé pour cette commande.</Text>
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
                    {!!item.note && <Text style={styles.itemNote}>Note : {item.note}</Text>}
                  </View>

                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyBadgeText}>x{item.quantity}</Text>
                  </View>
                </View>

                <View style={styles.itemBottomRow}>
                  <Text style={styles.itemUnitPrice}>
                    {formatPrice(item.unitPrice, currency)} / unité
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
          <Text style={styles.sectionTitle}>Résumé paiement</Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Sous-total</Text>
            <Text style={styles.priceValue}>{formatPrice(pricing.subtotal, currency)}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Livraison</Text>
            <Text style={styles.priceValue}>{formatPrice(pricing.deliveryFee, currency)}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Frais de service</Text>
            <Text style={styles.priceValue}>{formatPrice(pricing.serviceFee, currency)}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Taxes</Text>
            <Text style={styles.priceValue}>{formatPrice(pricing.tax, currency)}</Text>
          </View>

          {pricing.discount > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Remise</Text>
              <Text style={[styles.priceValue, styles.discountValue]}>
                - {formatPrice(pricing.discount, currency)}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },

  scrollContent: {
    paddingBottom: 32,
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
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
    backgroundColor: '#FFF8F0',
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
    borderColor: '#F2EDE7',
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
    borderColor: '#E4DED6',
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDFB',
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
    borderBottomColor: '#F1ECE6',
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
    color: '#151515',
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
    backgroundColor: '#F5EFE7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  qtyBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#6A4B2F',
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
    color: '#1F6F43',
  },

  divider: {
    height: 1,
    backgroundColor: '#F0E9E1',
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
    color: '#1F6F43',
  },

  primaryButton: {
    backgroundColor: '#1F6F43',
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