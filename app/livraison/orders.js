import React, { useCallback, useMemo, useState } from 'react';
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

import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import {
  getAssignedOrders,
  getDeliveryStats,
} from '../../services/deliveryService';

/**
 * CONSTANTS
 */

const FILTERS = [
  'Toutes',
  'Confirmée',
  'En préparation',
  'En livraison',
  'Livrée',
];

/**
 * HELPERS
 */

const normalizeRole = (v) => String(v || '').trim().toLowerCase();

const normalizeStatus = (v) => String(v || '').trim();

const isDriverRole = (role) =>
  role === 'livreur' || role === 'driver' || role === 'delivery';

const normalizeArray = (v) => (Array.isArray(v) ? v : []);

const normalizeNumber = (v, f = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : f;
};

const normalizeText = (v, f = '') => {
  const t = String(v || '').trim();
  return t || f;
};

const formatPrice = (v, c = 'EUR') => {
  const a = normalizeNumber(v);
  if (c === 'USD') return `$${a.toFixed(2)}`;
  if (c === 'XOF' || c === 'XAF') return `${a.toFixed(0)} ${c}`;
  return `${a.toFixed(2)} €`;
};

const formatDate = (v) => {
  if (!v) return '--';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getItemsCount = (items = []) =>
  normalizeArray(items).reduce(
    (s, i) => s + normalizeNumber(i?.quantity),
    0
  );

/**
 * SCREEN
 */

export default function LivraisonOrdersScreen() {
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

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('Toutes');

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
      setOrders(normalizeArray(data));
    } catch (e) {
      console.log(e);
      if (manual) Alert.alert('Erreur', 'Chargement impossible');
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, currentRole, isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders(false);
    }, [fetchOrders])
  );

  /**
   * DERIVED
   */

  const filtered = useMemo(() => {
    if (filter === 'Toutes') return normalizeArray(orders);
    return normalizeArray(orders).filter(
      (o) => normalizeStatus(o.status) === filter
    );
  }, [orders, filter]);

  const stats = useMemo(() => getDeliveryStats(orders), [orders]);

  const totalAmount = useMemo(
    () =>
      filtered.reduce(
        (s, o) => s + normalizeNumber(o?.totalPrice),
        0
      ),
    [filtered]
  );

  const totalItems = useMemo(
    () =>
      filtered.reduce((s, o) => s + getItemsCount(o.items), 0),
    [filtered]
  );

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

  /**
   * RENDER
   */

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        data={filtered}
        keyExtractor={(i) => i._id}
        refreshing={refreshing}
        onRefresh={() => fetchOrders(true)}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Mes livraisons</Text>

            <View style={styles.stats}>
              <Text>{stats.total} assignées</Text>
              <Text>{stats.delivering} en cours</Text>
            </View>

            <View style={styles.summary}>
              <Text>{totalItems} articles</Text>
              <Text>{formatPrice(totalAmount)}</Text>
            </View>

            <FlatList
              data={FILTERS}
              horizontal
              keyExtractor={(i) => i}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.filter,
                    filter === item && styles.filterActive,
                  ]}
                  onPress={() => setFilter(item)}
                >
                  <Text
                    style={
                      filter === item
                        ? styles.filterTextActive
                        : styles.filterText
                    }
                  >
                    {item}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push(`/livraison/${item._id}`)
            }
          >
            <Text style={styles.cardTitle}>
              {normalizeText(item.restaurantName, 'Restaurant')}
            </Text>

            <Text style={styles.cardSub}>
              #{String(item._id).slice(-6)}
            </Text>

            <Text>
              {getItemsCount(item.items)} articles •{' '}
              {formatPrice(item.totalPrice)}
            </Text>

            <Text style={styles.date}>
              {formatDate(item.updatedAt || item.createdAt)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text>Aucune livraison</Text>
          </View>
        }
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

  header: {
    padding: 16,
  },

  title: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 10,
  },

  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  filter: {
    backgroundColor: '#EEE',
    padding: 8,
    borderRadius: 20,
    marginRight: 8,
  },

  filterActive: {
    backgroundColor: '#111',
  },

  filterText: {
    color: '#555',
  },

  filterTextActive: {
    color: '#FFF',
  },

  card: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
  },

  cardTitle: {
    fontWeight: '800',
    fontSize: 16,
  },

  cardSub: {
    color: '#777',
    marginBottom: 6,
  },

  date: {
    marginTop: 6,
    color: '#777',
    fontSize: 12,
  },

  empty: {
    alignItems: 'center',
    marginTop: 40,
  },
});