import React, { useCallback, useMemo, useState } from 'react';
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
import { apiDelete, apiGet } from '../../services/apiClient';
import { API_ENDPOINTS } from '../../constants/api';

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

const formatPrice = (value, currency = 'EUR') => {
  const amount = normalizeNumber(value, 0);
  const c = normalizeText(currency, 'EUR').toUpperCase();

  if (c === 'USD') return `$${amount.toFixed(2)}`;
  if (c === 'GBP') return `£${amount.toFixed(2)}`;
  if (c === 'XOF' || c === 'XAF') return `${amount.toFixed(0)} ${c}`;
  if (c === 'CAD') return `${amount.toFixed(2)} $CA`;

  return `${amount.toFixed(2)} €`;
};

const extractRestaurantPayload = (response) => {
  if (!response || typeof response !== 'object') return null;
  return response?.restaurant || response?.data?.restaurant || response?.data || response;
};

const extractMenuArray = (response) => {
  if (!response) return [];
  if (Array.isArray(response?.menuItems)) return response.menuItems;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data?.menuItems)) return response.data.menuItems;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
};

const normalizeMenuItem = (item = {}) => ({
  ...item,
  _id: item?._id || item?.id || '',
  id: item?.id || item?._id || '',
  name: normalizeText(item?.name, 'Plat'),
  description: normalizeText(item?.description, 'Aucune description'),
  category: normalizeText(item?.category, 'Autres'),
  cuisine: normalizeText(item?.cuisine, 'Africaine'),
  price: normalizeNumber(item?.price, 0),
  available: item?.available !== false,
  isPopular: Boolean(item?.isPopular),
  isRecommended: Boolean(item?.isRecommended),
});

export default function MenuScreen() {
  const auth = useAuth() || {};
  const user = auth.user ?? null;
  const role = normalizeRole(auth.role || user?.role);
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);

  const [restaurant, setRestaurant] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const canAccess = isAuthenticated && role === 'restaurant';

  const load = useCallback(async (manual = false) => {
    if (!token || role !== 'restaurant') {
      setRestaurant(null);
      setItems([]);
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
        setItems([]);
        return;
      }

      const restaurantId = safeRestaurant?._id || safeRestaurant?.id;

      const menuResponse = await apiGet(
        `${API_ENDPOINTS.menu.byRestaurant(restaurantId)}?includeUnavailable=true`,
        token
      );

      setRestaurant({
        ...safeRestaurant,
        _id: restaurantId,
        currency: normalizeText(safeRestaurant?.currency, 'EUR'),
        name: normalizeText(safeRestaurant?.name, 'Restaurant'),
      });

      setItems(
        extractMenuArray(menuResponse)
          .map(normalizeMenuItem)
          .filter((item) => item?._id)
      );
    } catch (error) {
      console.log('Erreur MenuScreen :', error);
      Alert.alert('Erreur', error?.message || 'Impossible de charger le menu.');
      setItems([]);
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

  const stats = useMemo(() => {
    return {
      total: items.length,
      available: items.filter((item) => item?.available !== false).length,
      unavailable: items.filter((item) => item?.available === false).length,
      popular: items.filter((item) => item?.isPopular).length,
    };
  }, [items]);

  const handleDelete = useCallback(
    (itemId) => {
      if (!token || !itemId) return;

      Alert.alert(
        'Supprimer ce plat',
        'Veux-tu vraiment supprimer ce plat du menu ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              try {
                await apiDelete(API_ENDPOINTS.menu.byId(itemId), token);
                setItems((prev) => prev.filter((item) => item?._id !== itemId));
                Alert.alert('Succès', 'Plat supprimé.');
              } catch (error) {
                console.log('Erreur suppression menu :', error);
                Alert.alert(
                  'Erreur',
                  error?.message || 'Impossible de supprimer ce plat.'
                );
              }
            },
          },
        ]
      );
    },
    [token]
  );

  const handleEdit = useCallback((item) => {
    router.push({
      pathname: '/restaurant/EditMenuItem',
      params: {
        id: item?._id || '',
        name: item?.name || '',
        description: item?.description || '',
        price: String(item?.price ?? ''),
        category: item?.category || '',
        cuisine: item?.cuisine || '',
        available: String(item?.available !== false),
        isPopular: String(!!item?.isPopular),
        isRecommended: String(!!item?.isRecommended),
      },
    });
  }, []);

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
        data={items}
        keyExtractor={(item, index) => item?._id || `menu-${index}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }
        contentContainerStyle={[
          styles.content,
          items.length === 0 && styles.emptyListContent,
        ]}
        ListHeaderComponent={
          <View>
            <View style={styles.topRow}>
              <Pressable style={styles.topButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
              </Pressable>

              <Pressable
                style={styles.topButton}
                onPress={() => router.push('/restaurant/AddMenuItem')}
              >
                <Ionicons name="add" size={22} color="#1E1E1E" />
              </Pressable>
            </View>

            <View style={styles.header}>
              <Text style={styles.eyebrow}>Restaurant</Text>
              <Text style={styles.title}>Menu</Text>
              <Text style={styles.subtitle}>
                Gère tous les plats visibles de ta vitrine.
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.available}</Text>
                <Text style={styles.statLabel}>Disponibles</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.unavailable}</Text>
                <Text style={styles.statLabel}>Indisponibles</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.popular}</Text>
                <Text style={styles.statLabel}>Populaires</Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardTopLeft}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>{item.category}</Text>
              </View>

              <View
                style={[
                  styles.badge,
                  item?.available !== false ? styles.badgeOpen : styles.badgeClosed,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    item?.available !== false
                      ? styles.badgeTextOpen
                      : styles.badgeTextClosed,
                  ]}
                >
                  {item?.available !== false ? 'Disponible' : 'Indisponible'}
                </Text>
              </View>
            </View>

            <Text style={styles.description}>{item.description}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaBadge}>
                <Ionicons name="cash-outline" size={14} color="#D96C2D" />
                <Text style={styles.metaBadgeText}>
                  {formatPrice(item.price, restaurant?.currency || 'EUR')}
                </Text>
              </View>

              {!!item?.isPopular && (
                <View style={styles.metaBadge}>
                  <Ionicons name="flame-outline" size={14} color="#C05621" />
                  <Text style={styles.metaBadgeText}>Populaire</Text>
                </View>
              )}

              {!!item?.isRecommended && (
                <View style={styles.metaBadge}>
                  <Ionicons name="star-outline" size={14} color="#7C3AED" />
                  <Text style={styles.metaBadgeText}>Recommandé</Text>
                </View>
              )}
            </View>

            <View style={styles.actions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => handleEdit(item)}
              >
                <Ionicons name="create-outline" size={16} color="#1F6F43" />
                <Text style={styles.secondaryButtonText}>Modifier</Text>
              </Pressable>

              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDelete(item?._id)}
              >
                <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                <Text style={styles.deleteButtonText}>Supprimer</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={52} color="#C8BBAA" />
            <Text style={styles.emptyTitle}>Aucun plat</Text>
            <Text style={styles.emptyText}>
              Commence par ajouter tes premiers plats.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/restaurant/AddMenuItem')}
            >
              <Text style={styles.primaryButtonText}>Ajouter un plat</Text>
            </Pressable>
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
    marginBottom: 14,
  },
  statCard: {
    width: '48%',
    marginHorizontal: '1%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '700',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTopLeft: {
    flex: 1,
    paddingRight: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#666',
    fontSize: 13,
  },
  description: {
    color: '#666',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeOpen: { backgroundColor: '#E8F5ED' },
  badgeClosed: { backgroundColor: '#FDECEC' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  badgeTextOpen: { color: '#1F6F43' },
  badgeTextClosed: { color: '#B83232' },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
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

  actions: {
    flexDirection: 'row',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#CFE5D7',
    backgroundColor: '#F5FBF7',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginRight: 8,
  },
  secondaryButtonText: {
    color: '#1F6F43',
    fontWeight: '900',
    marginLeft: 6,
  },
  deleteButton: {
    flex: 1,
    minHeight: 46,
    backgroundColor: '#C0392B',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    marginLeft: 8,
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
    marginBottom: 18,
  },
  primaryButton: {
    backgroundColor: '#D4A017',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: '#111',
    fontWeight: '900',
    fontSize: 15,
  },
});