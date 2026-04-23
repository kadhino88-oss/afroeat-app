import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useLocalSearchParams, router, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { getOrderById, getOrderTracking } from '../../services/orderService';

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
      return '#1F8F4C';
    case 'on_the_way':
      return '#2F80ED';
    case 'preparing':
      return '#D4A017';
    case 'confirmed':
      return '#7B61FF';
    case 'cancelled':
      return '#C0392B';
    case 'pending':
    default:
      return '#D96C2D';
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

const formatPrice = (value, currency = 'EUR') => {
  const amount = normalizeNumber(value, 0);
  const normalizedCurrency = normalizeText(currency, 'EUR').toUpperCase();

  if (normalizedCurrency === 'USD') return `$${amount.toFixed(2)}`;
  if (normalizedCurrency === 'GBP') return `£${amount.toFixed(2)}`;
  if (normalizedCurrency === 'XOF' || normalizedCurrency === 'XAF') {
    return `${amount.toFixed(0)} ${normalizedCurrency}`;
  }
  if (normalizedCurrency === 'CAD') return `${amount.toFixed(2)} $CA`;

  return `${amount.toFixed(2)} €`;
};

const formatDate = (value) => {
  if (!value) return 'Date inconnue';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date inconnue';
  }

  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCoordinates = (tracking) => {
  const lat = tracking?.location?.lat;
  const lng = tracking?.location?.lng;

  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return 'Position non disponible';
  }

  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
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

const STEPS = [
  'Commande reçue',
  'Confirmée',
  'Préparation',
  'En livraison',
  'Livrée',
];

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function OrderDetailScreen() {
  const params = useLocalSearchParams();
  const { token, isAuthenticated, user, role, loading: authLoading } =
    useAuth();

  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role || 'client');
  }, [role, user]);

  const safeOrderId = useMemo(() => {
    const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
    return normalizeText(rawId) || null;
  }, [params]);

  const isLoggedIn = Boolean(isAuthenticated && token && user?._id);

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
   * LOAD
   * =========================================================
   */

  const load = useCallback(
    async (manualRefresh = false) => {
      if (authLoading) return;

      if (!isLoggedIn || !token || !safeOrderId || currentRole !== 'client') {
        setOrder(null);
        setTracking(null);
        setErrorMessage('');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (manualRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage('');

        const [orderRes, trackingRes] = await Promise.all([
          getOrderById(safeOrderId, token),
          getOrderTracking(safeOrderId, token),
        ]);

        const safeOrder = normalizeOrder(extractOrderPayload(orderRes));
        const safeTracking = extractTrackingPayload(trackingRes);

        if (!safeOrder?._id) {
          throw new Error('Commande introuvable.');
        }

        setOrder(safeOrder);
        setTracking(safeTracking || null);
      } catch (err) {
        console.log('Erreur order detail:', err);
        setOrder(null);
        setTracking(null);
        setErrorMessage(
          err?.message || 'Impossible de charger cette commande.'
        );

        if (manualRefresh) {
          Alert.alert(
            'Erreur',
            err?.message || 'Impossible de charger cette commande.'
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authLoading, currentRole, isLoggedIn, safeOrderId, token]
  );

  useEffect(() => {
    if (safeOrderId) {
      load(false);
    } else {
      setLoading(false);
      setErrorMessage('Commande introuvable.');
    }
  }, [safeOrderId, load]);

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

  const itemCount = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + normalizeNumber(item?.quantity, 0);
    }, 0);
  }, [items]);

  /**
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (authLoading || loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#D4A017" />
        <Text style={styles.loaderText}>Chargement commande...</Text>
      </View>
    );
  }

  if (!isLoggedIn) {
    return <Redirect href="/auth/role" />;
  }

  if (!order) {
    return (
      <FadeInView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

        <View style={styles.emptyWrapper}>
          <Pressable style={styles.topButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
          </Pressable>

          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={54} color="#C9B8A3" />
            <Text style={styles.emptyTitle}>Commande introuvable</Text>
            <Text style={styles.emptyText}>
              {errorMessage || 'Impossible de charger cette commande.'}
            </Text>

            <Pressable
              style={styles.primaryButton}
              onPress={() => router.replace('/(tabs)/orders')}
            >
              <Text style={styles.primaryButtonText}>Voir mes commandes</Text>
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.topActions}>
          <Pressable style={styles.topButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
          </Pressable>

          <Pressable
            style={styles.topButton}
            onPress={() => load(true)}
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
          <Text style={styles.title}>Suivi commande</Text>
          <Text style={styles.subtitle}>
            Commande #{String(order?._id || '').slice(-6).toUpperCase()}
          </Text>
          <Text style={styles.subMeta}>{formatDate(order?.createdAt)}</Text>
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
            <Text style={styles.statusText}>{order?.statusLabel}</Text>
          </View>

          <Text style={styles.restaurantName}>
            {order?.restaurantName || 'Restaurant AFROEAT'}
          </Text>

          {!!order?.deliveryAddress && (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={15} color="#777777" />
              <Text style={styles.addressText}>{order.deliveryAddress}</Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Ionicons name="bag-handle-outline" size={14} color="#1F6F43" />
              <Text style={styles.metaBadgeText}>{itemCount} article(s)</Text>
            </View>

            <View style={styles.metaBadge}>
              <Ionicons name="cash-outline" size={14} color="#D96C2D" />
              <Text style={styles.metaBadgeText}>
                {formatPrice(total, order?.currency)}
              </Text>
            </View>

            <View style={styles.metaBadge}>
              <Ionicons name="card-outline" size={14} color="#7B61FF" />
              <Text style={styles.metaBadgeText}>
                {order?.paymentStatus || 'Non payé'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.liveCard}>
          <View style={styles.liveHeader}>
            <Ionicons name="radio-outline" size={18} color="#2457C5" />
            <Text style={styles.liveTitle}>Temps réel</Text>
          </View>

          <View style={styles.liveRow}>
            <Text style={styles.liveLabel}>Statut tracking</Text>
            <Text style={styles.liveValue}>
              {tracking ? 'Actif' : 'Indisponible'}
            </Text>
          </View>

          <View style={styles.liveRow}>
            <Text style={styles.liveLabel}>Position livreur</Text>
            <Text style={styles.liveValue}>{formatCoordinates(tracking)}</Text>
          </View>
        </View>

        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Progression</Text>

          {STEPS.map((label, index) => {
            const isDone =
              normalizeStatus(order?.status) !== 'cancelled' && index + 1 <= step;
            const isCurrent = index + 1 === step;

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
                        Statut actuel de la commande
                      </Text>
                    )}
                </View>
              </View>
            );
          })}

          {normalizeStatus(order?.status) === 'cancelled' && (
            <View style={styles.cancelBox}>
              <Ionicons name="close-circle-outline" size={18} color="#C0392B" />
              <Text style={styles.cancelText}>Cette commande a été annulée.</Text>
            </View>
          )}
        </View>

        <View style={styles.itemsCard}>
          <Text style={styles.itemsTitle}>Articles</Text>

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
                    <Text style={styles.itemQuantity}>Quantité : {quantity}</Text>
                  </View>

                  <Text style={styles.itemPrice}>
                    {formatPrice(lineTotal, order?.currency)}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyItemsText}>Aucun article à afficher.</Text>
          )}
        </View>

        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatPrice(total, order?.currency)}
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
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
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
    backgroundColor: '#FFF8F0',
  },

  loaderText: {
    marginTop: 10,
    color: '#777777',
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

  subMeta: {
    textAlign: 'center',
    color: '#999999',
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
    color: '#1E1E1E',
    marginBottom: 10,
  },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },

  addressText: {
    color: '#777777',
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
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 10,
    marginBottom: 8,
  },

  metaBadgeText: {
    marginLeft: 6,
    color: '#555555',
    fontWeight: '700',
    fontSize: 12,
  },

  liveCard: {
    backgroundColor: '#EEF4FF',
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
    color: '#2457C5',
  },

  liveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 36,
    paddingVertical: 4,
  },

  liveLabel: {
    color: '#4F5F88',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    paddingRight: 10,
  },

  liveValue: {
    color: '#2457C5',
    fontSize: 13,
    fontWeight: '900',
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
    color: '#1E1E1E',
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
    backgroundColor: '#E6E6E6',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },

  timelineDotDone: {
    backgroundColor: '#1F6F43',
  },

  timelineDotCurrent: {
    backgroundColor: '#D4A017',
  },

  timelineContent: {
    flex: 1,
  },

  timelineStepText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#777777',
  },

  timelineStepTextDone: {
    color: '#1E1E1E',
  },

  timelineStepTextCurrent: {
    color: '#1E1E1E',
    fontWeight: '900',
  },

  timelineStepSubtext: {
    marginTop: 4,
    color: '#777777',
    fontSize: 13,
  },

  cancelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDEAEA',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },

  cancelText: {
    marginLeft: 8,
    color: '#C0392B',
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
    color: '#1E1E1E',
    marginBottom: 14,
  },

  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1ECE4',
  },

  itemLeft: {
    flex: 1,
    marginRight: 10,
  },

  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E1E1E',
    marginBottom: 4,
  },

  itemQuantity: {
    fontSize: 13,
    color: '#777777',
  },

  itemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D96C2D',
  },

  emptyItemsText: {
    color: '#777777',
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
    color: '#1E1E1E',
  },

  totalValue: {
    fontWeight: '900',
    fontSize: 18,
    color: '#1E1E1E',
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
    color: '#1E1E1E',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 8,
  },

  emptyText: {
    textAlign: 'center',
    color: '#777777',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },

  primaryButton: {
    backgroundColor: '#D4A017',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
  },

  primaryButtonText: {
    color: '#111111',
    fontWeight: '800',
    fontSize: 15,
  },
});