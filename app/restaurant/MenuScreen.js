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
import { useTranslation } from 'react-i18next';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { apiDelete, apiGet } from '../../services/apiClient';
import { API_ENDPOINTS } from '../../constants/api';
import i18n from '../../i18n';

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
  if (c === 'CHF') return `CHF ${amount.toFixed(2)}`;
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
  name: normalizeText(item?.name, i18n.t('restaurant.menuScreen.dishFallback')),
  description: normalizeText(item?.description, i18n.t('restaurant.menuScreen.noDescriptionFallback')),
  category: normalizeText(item?.category, i18n.t('restaurant.menuScreen.categoryFallback')),
  cuisine: normalizeText(item?.cuisine, i18n.t('restaurant.menuScreen.cuisineFallback')),
  price: normalizeNumber(item?.price, 0),
  available: item?.available !== false,
  isPopular: Boolean(item?.isPopular),
  isRecommended: Boolean(item?.isRecommended),
});

export default function MenuScreen() {
  const { t } = useTranslation();
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
        name: normalizeText(safeRestaurant?.name, t('restaurant.menuScreen.restaurantNameFallback')),
      });

      setItems(
        extractMenuArray(menuResponse)
          .map(normalizeMenuItem)
          .filter((item) => item?._id)
      );
    } catch (error) {
      console.log('Erreur MenuScreen :', error);
      Alert.alert(t('common.error'), error?.message || t('restaurant.menuScreen.errorLoadBody'));
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, token, t]);

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
        t('restaurant.menuScreen.deleteConfirmTitle'),
        t('restaurant.menuScreen.deleteConfirmBody'),
        [
          { text: t('restaurant.settings.cancelButton'), style: 'cancel' },
          {
            text: t('restaurant.menuScreen.deleteButton'),
            style: 'destructive',
            onPress: async () => {
              try {
                await apiDelete(API_ENDPOINTS.menu.byId(itemId), token);
                setItems((prev) => prev.filter((item) => item?._id !== itemId));
                Alert.alert(t('restaurant.settings.successTitle'), t('restaurant.menuScreen.deleteSuccessBody'));
              } catch (error) {
                console.log('Erreur suppression menu :', error);
                Alert.alert(
                  t('common.error'),
                  error?.message || t('restaurant.menuScreen.deleteErrorBody')
                );
              }
            },
          },
        ]
      );
    },
    [token, t]
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
        <ActivityIndicator size="large" color="#084424" />
      </View>
    );
  }

  return (
    <FadeInView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

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
                <Ionicons name="arrow-back" size={20} color="#0D1C11" />
              </Pressable>

              <Pressable
                style={styles.topButton}
                onPress={() => router.push('/restaurant/AddMenuItem')}
              >
                <Ionicons name="add" size={22} color="#0D1C11" />
              </Pressable>
            </View>

            <View style={styles.header}>
              <Text style={styles.eyebrow}>{t('restaurant.settings.eyebrow')}</Text>
              <Text style={styles.title}>{t('restaurant.menuScreen.title')}</Text>
              <Text style={styles.subtitle}>
                {t('restaurant.menuScreen.subtitle')}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>{t('restaurant.menuScreen.totalLabel')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.available}</Text>
                <Text style={styles.statLabel}>{t('restaurant.menuScreen.availableLabel')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.unavailable}</Text>
                <Text style={styles.statLabel}>{t('restaurant.menuScreen.unavailableLabel')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.popular}</Text>
                <Text style={styles.statLabel}>{t('restaurant.menuScreen.popularLabel')}</Text>
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
                  {item?.available !== false ? t('restaurant.menuScreen.availableBadge') : t('restaurant.menuScreen.unavailableBadge')}
                </Text>
              </View>
            </View>

            <Text style={styles.description}>{item.description}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaBadge}>
                <Ionicons name="cash-outline" size={14} color="#C8331A" />
                <Text style={styles.metaBadgeText}>
                  {formatPrice(item.price, restaurant?.currency || 'EUR')}
                </Text>
              </View>

              {!!item?.isPopular && (
                <View style={styles.metaBadge}>
                  <Ionicons name="flame-outline" size={14} color="#C8331A" />
                  <Text style={styles.metaBadgeText}>{t('restaurant.menuScreen.popularBadge')}</Text>
                </View>
              )}

              {!!item?.isRecommended && (
                <View style={styles.metaBadge}>
                  <Ionicons name="star-outline" size={14} color="#084424" />
                  <Text style={styles.metaBadgeText}>{t('restaurant.menuScreen.recommendedBadge')}</Text>
                </View>
              )}
            </View>

            <View style={styles.actions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => handleEdit(item)}
              >
                <Ionicons name="create-outline" size={16} color="#084424" />
                <Text style={styles.secondaryButtonText}>{t('restaurant.menuScreen.editButton')}</Text>
              </Pressable>

              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDelete(item?._id)}
              >
                <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                <Text style={styles.deleteButtonText}>{t('restaurant.menuScreen.deleteButton')}</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={52} color="#606D5D" />
            <Text style={styles.emptyTitle}>{t('restaurant.menuScreen.emptyTitle')}</Text>
            <Text style={styles.emptyText}>
              {t('restaurant.menuScreen.emptyText')}
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/restaurant/AddMenuItem')}
            >
              <Text style={styles.primaryButtonText}>{t('restaurant.menuScreen.addDishButton')}</Text>
            </Pressable>
          </View>
        }
      />
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBF6EC' },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 60 },
  emptyListContent: { flexGrow: 1 },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBF6EC',
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
    color: '#084424',
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
    color: '#606D5D',
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
  badgeOpen: { backgroundColor: '#E3F0E8' },
  badgeClosed: { backgroundColor: '#F8E1DD' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  badgeTextOpen: { color: '#084424' },
  badgeTextClosed: { color: '#C8331A' },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2ECE0',
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
    borderColor: '#E3F0E8',
    backgroundColor: '#F2ECE0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginRight: 8,
  },
  secondaryButtonText: {
    color: '#084424',
    fontWeight: '900',
    marginLeft: 6,
  },
  deleteButton: {
    flex: 1,
    minHeight: 46,
    backgroundColor: '#C8331A',
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
    backgroundColor: '#EAB02F',
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