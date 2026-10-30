import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { getMyOrders } from '../../services/orderService';
import { useTranslation } from 'react-i18next';

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

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

  if (
    role === 'restaurant' ||
    role === 'resto' ||
    role === 'partner_restaurant'
  ) {
    return 'restaurant';
  }

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
    role === 'super-admin' ||
    role === 'ops'
  ) {
    return 'admin';
  }

  return 'client';
};

const normalizeStatus = (value) => {
  const status = normalizeText(value).toLowerCase();

  if (
    status === 'delivered' ||
    status === 'livré' ||
    status === 'livree' ||
    status === 'livrée' ||
    status === 'completed'
  ) {
    return 'delivered';
  }

  if (
    status === 'cancelled' ||
    status === 'canceled' ||
    status === 'annulé' ||
    status === 'annule' ||
    status === 'annulée' ||
    status === 'annulee'
  ) {
    return 'cancelled';
  }

  if (
    status === 'pending' ||
    status === 'en attente' ||
    status === 'created'
  ) {
    return 'pending';
  }

  if (
    status === 'preparing' ||
    status === 'preparation' ||
    status === 'en préparation'
  ) {
    return 'preparing';
  }

  if (
    status === 'on-the-way' ||
    status === 'on the way' ||
    status === 'out_for_delivery' ||
    status === 'en livraison' ||
    status === 'on_the_way'
  ) {
    return 'on_the_way';
  }

  if (
    status === 'confirmed' ||
    status === 'confirmé' ||
    status === 'confirme' ||
    status === 'confirmée'
  ) {
    return 'confirmed';
  }

  return 'unknown';
};

const normalizeOrder = (item = {}) => {
  const safeItems = normalizeArray(item?.items);

  return {
    ...item,
    _id: item?._id || item?.id || '',
    id: item?.id || item?._id || '',
    status: normalizeStatus(item?.status),
    totalPrice: normalizeNumber(item?.totalPrice, 0),
    currency: normalizeText(item?.currency, 'EUR'),
    createdAt: item?.createdAt || item?.date || item?.updatedAt || null,
    restaurantName: normalizeText(
      item?.restaurant?.name || item?.restaurantName,
      'Restaurant'
    ),
    deliveryAddress: normalizeText(
      item?.deliveryAddress || item?.address || item?.shippingAddress
    ),
    itemsCount:
      safeItems.reduce((sum, line) => {
        return sum + Math.max(0, normalizeNumber(line?.quantity, 0));
      }, 0) || Math.max(0, normalizeNumber(item?.itemsCount, 0)),
    items: safeItems,
  };
};

const formatPrice = (value, currency = 'EUR') => {
  const amount = normalizeNumber(value, 0);
  const c = normalizeText(currency, 'EUR').toUpperCase();

  if (c === 'USD') return `$${amount.toFixed(2)}`;
  if (c === 'GBP') return `£${amount.toFixed(2)}`;
  if (c === 'CHF') return `CHF ${amount.toFixed(2)}`;
  if (c === 'XOF' || c === 'XAF') return `${amount.toFixed(0)} ${c}`;
  if (c === 'CAD') return `${amount.toFixed(2)} $CA`;

  return `${amount.toFixed(2)} €`;
};

const formatDate = (value) => {
  if (!value) return '';

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

const getStatusColor = (s) => {
  if (s === 'unknown') return '#777777';
  if (s === 'delivered') return '#1F6F43';
  if (s === 'cancelled') return '#B63B3B';
  if (s === 'pending') return '#D4A017';
  if (s === 'preparing') return '#D96C2D';
  if (s === 'on_the_way') return '#2457C5';
  if (s === 'confirmed') return '#7B61FF';
  return '#777777';
};

const getStatusBg = (s) => {
  if (s === 'unknown') return '#F4F4F4';
  if (s === 'delivered') return '#E8F5ED';
  if (s === 'cancelled') return '#FDECEC';
  if (s === 'pending') return '#FFF3D8';
  if (s === 'preparing') return '#FFF0E8';
  if (s === 'on_the_way') return '#EAF3FF';
  if (s === 'confirmed') return '#EFE9FF';
  return '#F4F4F4';
};

const getStatusLabel = (s) => {
  if (s === 'delivered') return 'Livré';
  if (s === 'cancelled') return 'Annulé';
  if (s === 'pending') return 'En attente';
  if (s === 'preparing') return 'Préparation';
  if (s === 'on_the_way') return 'En livraison';
  if (s === 'confirmed') return 'Confirmé';
  if (s === 'unknown') return 'Statut à confirmer';
  return 'Commande';
};

const getStatusIcon = (s) => {
  if (s === 'unknown') return 'help-circle-outline';
  if (s === 'delivered') return 'checkmark-circle-outline';
  if (s === 'cancelled') return 'close-circle-outline';
  if (s === 'pending') return 'time-outline';
  if (s === 'preparing') return 'restaurant-outline';
  if (s === 'on_the_way') return 'bicycle-outline';
  if (s === 'confirmed') return 'checkmark-done-outline';
  return 'receipt-outline';
};

const extractOrdersFromResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.orders)) return response.orders;
  if (Array.isArray(response?.data?.orders)) return response.data.orders;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response?.items)) return response.items;
  return [];
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function OrdersScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);
  const user = auth.user ?? null;
  const currentRole = normalizeRole(auth.role || user?.role);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState('');

  const loadOrders = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError('');

        const response = await getMyOrders(token);
        const extracted = extractOrdersFromResponse(response);

        const safeOrders = normalizeArray(extracted)
          .map(normalizeOrder)
          .filter((item) => item?._id);

        setOrders(safeOrders);
      } catch (err) {
        console.log('Erreur orders :', err);
        setOrders([]);
        setError(
          normalizeText(err?.message, 'Impossible de charger les commandes.')
        );
      } finally {
        if (isRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }

        setInitialLoaded(true);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!authLoading && isAuthenticated && currentRole === 'client') {
      loadOrders();
    }
  }, [authLoading, isAuthenticated, currentRole, loadOrders]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      return (
        new Date(b?.createdAt || 0).getTime() -
        new Date(a?.createdAt || 0).getTime()
      );
    });
  }, [orders]);

  const stats = useMemo(() => {
    const total = sortedOrders.length;

    const active = sortedOrders.filter((o) => {
      const s = normalizeStatus(o?.status);
      return s !== 'delivered' && s !== 'cancelled';
    }).length;

    const delivered = sortedOrders.filter((o) => {
      return normalizeStatus(o?.status) === 'delivered';
    }).length;

    return { total, active, delivered };
  }, [sortedOrders]);

  const handleRefresh = useCallback(() => {
    loadOrders(true);
  }, [loadOrders]);

  const handleOpenOrder = useCallback((orderId) => {
    if (!orderId) return;
    router.push(`/order/${orderId}`);
  }, []);

  const handleExplore = useCallback(() => {
    router.push('/(tabs)/explore');
  }, []);

  /**
   * =========================================================
   * AUTH GATE
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

  if (authLoading || (loading && !initialLoaded)) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#D4A017" />
        <Text style={styles.loaderText}>{t('orders.loadingOrders')}</Text>
      </View>
    );
  }

  const renderItem = ({ item }) => {
    const id = item?._id;
    const statusKey = normalizeStatus(item?.status);

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => handleOpenOrder(id)}
      >
        <View style={styles.cardTop}>
          <Text style={styles.orderId}>
            #{normalizeText(id).slice(-6).toUpperCase()}
          </Text>

          <View
            style={[
              styles.statusPill,
              { backgroundColor: getStatusBg(statusKey) },
            ]}
          >
            <Ionicons
              name={getStatusIcon(statusKey)}
              size={13}
              color={getStatusColor(statusKey)}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(statusKey) },
              ]}
            >
              {t(`orders.status.${statusKey}`, getStatusLabel(statusKey))}
            </Text>
          </View>
        </View>

        <Text style={styles.restaurantName} numberOfLines={1}>
          {normalizeText(item?.restaurantName, t('orders.restaurantFallback'))}
        </Text>

        <Text style={styles.date}>
          {formatDate(item?.createdAt) || t('orders.dateUnavailable')}
        </Text>

        {!!normalizeText(item?.deliveryAddress) && (
          <Text style={styles.address} numberOfLines={2}>
            {normalizeText(item?.deliveryAddress)}
          </Text>
        )}

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.total}>
              {formatPrice(item?.totalPrice, item?.currency)}
            </Text>
            <Text style={styles.metaText}>
              {t('orders.items', { count: Math.max(0, normalizeNumber(item?.itemsCount, 0)) })}
            </Text>
          </View>

          <View style={styles.arrow}>
            <Ionicons
              name="chevron-forward-outline"
              size={18}
              color="#777777"
            />
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <FlatList
        data={sortedOrders}
        keyExtractor={(item, index) =>
          item?._id?.toString() || index.toString()
        }
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#D4A017"
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{t('orders.title')}</Text>
            <Text style={styles.subtitle}>
              {t('orders.subtitle')}
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>{t('orders.total')}</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: '#D4A017' }]}>
                  {stats.active}
                </Text>
                <Text style={styles.statLabel}>{t('orders.active')}</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: '#1F6F43' }]}>
                  {stats.delivered}
                </Text>
                <Text style={styles.statLabel}>{t('orders.delivered')}</Text>
              </View>
            </View>

            {!!error && (
              <View style={styles.errorCard}>
                <Ionicons name="warning-outline" size={18} color="#B63B3B" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color="#C4B7A6" />
            <Text style={styles.emptyTitle}>{t('orders.empty')}</Text>
            <Text style={styles.emptyText}>
              {t('orders.emptyText')}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.exploreButton,
                pressed && styles.cardPressed,
              ]}
              onPress={handleExplore}
            >
              <Text style={styles.exploreButtonText}>{t('orders.exploreAfroeat')}</Text>
            </Pressable>
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
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  listContent: {
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
    marginTop: 12,
    color: '#777777',
    fontSize: 15,
  },

  header: {
    marginBottom: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1E1E1E',
    marginBottom: 6,
  },

  subtitle: {
    color: '#777777',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },

  statsRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  statCard: {
    flex: 1,
    alignItems: 'center',
  },

  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#F0E6D9',
    marginHorizontal: 8,
  },

  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E1E1E',
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#777777',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDEAEA',
    borderWidth: 1,
    borderColor: '#F4C7C7',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },

  errorText: {
    flex: 1,
    color: '#B63B3B',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  cardPressed: {
    opacity: 0.88,
  },

  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  orderId: {
    fontWeight: '900',
    fontSize: 15,
    color: '#1E1E1E',
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusText: {
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 5,
  },

  restaurantName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E1E1E',
    marginBottom: 4,
  },

  date: {
    color: '#777777',
    fontSize: 13,
    marginBottom: 8,
  },

  address: {
    color: '#8A8A8A',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  total: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1E1E1E',
    marginBottom: 2,
  },

  metaText: {
    color: '#777777',
    fontSize: 12,
    fontWeight: '700',
  },

  arrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FAF7F2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  empty: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '900',
    color: '#1E1E1E',
  },

  emptyText: {
    color: '#777777',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
    fontSize: 14,
  },

  exploreButton: {
    backgroundColor: '#1F6F43',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
  },

  exploreButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});