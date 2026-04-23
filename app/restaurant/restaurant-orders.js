import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Alert,
} from 'react-native';
import { router, useFocusEffect, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { apiGet } from '../../services/apiClient';
import { API_ENDPOINTS } from '../../constants/api';

const STATUS_FILTERS = [
  'Toutes',
  'En attente',
  'Confirmée',
  'En préparation',
  'En livraison',
  'Livrée',
  'Annulée',
];

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

const extractRestaurantPayload = (response) => {
  if (!response || typeof response !== 'object') return null;
  return response?.restaurant || response?.data?.restaurant || response?.data || response;
};

const extractOrdersArray = (response) => {
  if (!response) return [];
  if (Array.isArray(response?.orders)) return response.orders;
  if (Array.isArray(response?.data?.orders)) return response.data.orders;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
};

const normalizeOrder = (order = {}) => ({
  ...order,
  _id: order?._id || order?.id || '',
  id: order?.id || order?._id || '',
  status: normalizeText(order?.status, 'En attente'),
  totalPrice: normalizeNumber(order?.totalPrice, 0),
  currency: normalizeText(order?.currency, 'EUR'),
  customerName: normalizeText(order?.user?.name || order?.customerName, 'Client'),
  deliveryPersonName: normalizeText(
    order?.deliveryPerson?.name || order?.deliveryPersonName,
    ''
  ),
  createdAt: order?.createdAt || null,
  itemCount: Array.isArray(order?.items)
    ? order.items.reduce((sum, item) => sum + normalizeNumber(item?.quantity, 0), 0)
    : 0,
});

const formatPrice = (value, currency = 'EUR') => {
  const amount = normalizeNumber(value, 0);
  const c = normalizeText(currency, 'EUR').toUpperCase();

  if (c === 'USD') return `$${amount.toFixed(2)}`;
  if (c === 'GBP') return `£${amount.toFixed(2)}`;
  if (c === 'XOF' || c === 'XAF') return `${amount.toFixed(0)} ${c}`;
  if (c === 'CAD') return `${amount.toFixed(2)} $CA`;

  return `${amount.toFixed(2)} €`;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getStatusStyle = (status) => {
  switch (normalizeText(status)) {
    case 'Livrée':
      return { bg: '#E8F5ED', text: '#1F6F43', icon: 'checkmark-circle-outline' };
    case 'En livraison':
      return { bg: '#EAF3FF', text: '#245EA8', icon: 'bicycle-outline' };
    case 'En préparation':
      return { bg: '#FFF3D8', text: '#8A6500', icon: 'restaurant-outline' };
    case 'Confirmée':
      return { bg: '#EFE9FF', text: '#6D4CDB', icon: 'checkmark-done-outline' };
    case 'Annulée':
      return { bg: '#FDECEC', text: '#B83232', icon: 'close-circle-outline' };
    default:
      return { bg: '#FFF0E8', text: '#D96C2D', icon: 'time-outline' };
  }
};

export default function RestaurantOrders() {
  const auth = useAuth() || {};
  const user = auth.user ?? null;
  const role = normalizeRole(auth.role || user?.role);
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);

  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activeStatus, setActiveStatus] = useState('Toutes');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const canAccess = isAuthenticated && role === 'restaurant';

  const load = useCallback(async (manual = false) => {
    if (!token || role !== 'restaurant') {
      setRestaurant(null);
      setOrders([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      manual ? setRefreshing(true) : setLoading(true);

      const restaurantResponse = await apiGet(API_ENDPOINTS.restaurants.my, token);
      const safeRestaurant = extractRestaurantPayload(restaurantResponse);

      if (!safeRestaurant?._id && !safeRestaurant?.id) {
        setRestaurant(null);
        setOrders([]);
        return;
      }

      const restaurantId = safeRestaurant?._id || safeRestaurant?.id;

      const ordersResponse = await apiGet(
        API_ENDPOINTS.orders.restaurantOrders(restaurantId),
        token
      );

      setRestaurant({
        ...safeRestaurant,
        _id: restaurantId,
        name: normalizeText(safeRestaurant?.name, 'Restaurant'),
      });

      setOrders(
        extractOrdersArray(ordersResponse)
          .map(normalizeOrder)
          .filter((item) => item?._id)
      );
    } catch (error) {
      console.log('Erreur restaurant orders :', error);
      Alert.alert(
        'Erreur',
        error?.message || 'Impossible de charger les commandes.'
      );
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, token]);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const filteredOrders = useMemo(() => {
    if (activeStatus === 'Toutes') return orders;
    return orders.filter((item) => normalizeText(item?.status) === activeStatus);
  }, [orders, activeStatus]);

  const stats = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter((item) => item?.status === 'En attente').length,
      preparing: orders.filter((item) => item?.status === 'En préparation').length,
      delivering: orders.filter((item) => item?.status === 'En livraison').length,
      delivered: orders.filter((item) => item?.status === 'Livrée').length,
    };
  }, [orders]);

  if (!canAccess) {
    return <Redirect href="/auth/login?role=restaurant" />;
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#1F6F43" />
      </View>
    );
  }

  return (
    <FadeInView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <FlatList
        data={filteredOrders}
        keyExtractor={(item, index) => item?._id || `order-${index}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }
        contentContainerStyle={[
          styles.content,
          filteredOrders.length === 0 && styles.emptyListContent,
        ]}
        ListHeaderComponent={
          <View>
            <View style={styles.topRow}>
              <Pressable style={styles.topButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
              </Pressable>

              <Pressable style={styles.topButton} onPress={() => load(true)}>
                {refreshing ? (
                  <ActivityIndicator size="small" color="#1E1E1E" />
                ) : (
                  <Ionicons name="refresh-outline" size={20} color="#1E1E1E" />
                )}
              </Pressable>
            </View>

            <View style={styles.header}>
              <Text style={styles.eyebrow}>Restaurant</Text>
              <Text style={styles.title}>Commandes</Text>
              <Text style={styles.subtitle}>
                Suivi opérationnel des commandes de {restaurant?.name || 'ton restaurant'}.
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.pending}</Text>
                <Text style={styles.statLabel}>En attente</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.preparing}</Text>
                <Text style={styles.statLabel}>Préparation</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.delivering}</Text>
                <Text style={styles.statLabel}>Livraison</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.delivered}</Text>
                <Text style={styles.statLabel}>Livrées</Text>
              </View>
            </View>

            <Text style={styles.filterTitle}>Filtrer par statut</Text>
            <FlatList
              data={STATUS_FILTERS}
              horizontal
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
              renderItem={({ item }) => {
                const active = activeStatus === item;

                return (
                  <Pressable
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setActiveStatus(item)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        active && styles.filterChipTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        }
        renderItem={({ item }) => {
          const statusStyle = getStatusStyle(item?.status);

          return (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardTitle}>
                    Commande #{String(item?._id || '').slice(-6).toUpperCase()}
                  </Text>
                  <Text style={styles.cardMeta}>Client : {item.customerName}</Text>
                  <Text style={styles.cardMeta}>
                    Créée le : {formatDate(item.createdAt)}
                  </Text>
                  {!!item?.deliveryPersonName && (
                    <Text style={styles.cardMeta}>
                      Livreur : {item.deliveryPersonName}
                    </Text>
                  )}
                </View>

                <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                  <Ionicons name={statusStyle.icon} size={13} color={statusStyle.text} />
                  <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                    {item?.status}
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

                <View style={styles.metaBadge}>
                  <Ionicons name="bag-handle-outline" size={14} color="#1F6F43" />
                  <Text style={styles.metaBadgeText}>
                    {normalizeNumber(item?.itemCount)} article(s)
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={54} color="#C8BBAA" />
            <Text style={styles.emptyTitle}>Aucune commande</Text>
            <Text style={styles.emptyText}>
              Aucune commande ne correspond au filtre sélectionné.
            </Text>
          </View>
        }
      />
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 60 },
  emptyListContent: { flexGrow: 1 },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
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
    fontSize: 28,
    fontWeight: '900',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    color: '#6B655E',
    fontSize: 14,
    lineHeight: 21,
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
    fontSize: 17,
    fontWeight: '900',
    color: '#111',
    marginBottom: 4,
  },
  cardMeta: {
    color: '#666',
    fontSize: 13,
    marginBottom: 3,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
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
    marginRight: 8,
    marginBottom: 8,
  },
  metaBadgeText: {
    marginLeft: 6,
    color: '#555',
    fontWeight: '700',
    fontSize: 12,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    textAlign: 'center',
    color: '#111',
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