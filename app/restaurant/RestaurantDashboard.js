import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect, Redirect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

const normalizeRole = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'restaurant' || normalized === 'resto') return 'restaurant';
  if (
    normalized === 'livreur' ||
    normalized === 'driver' ||
    normalized === 'delivery' ||
    normalized === 'courier'
  ) {
    return 'livreur';
  }
  if (
    normalized === 'admin' ||
    normalized === 'administrator' ||
    normalized === 'superadmin'
  ) {
    return 'admin';
  }
  return 'client';
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return fallback;
};

const normalizeStatus = (value) => normalizeText(value).toLowerCase();

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

const extractOrdersArray = (response) => {
  if (!response) return [];
  if (Array.isArray(response?.orders)) return response.orders;
  if (Array.isArray(response?.data?.orders)) return response.data.orders;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
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

const normalizeMenuItem = (item = {}) => {
  return {
    ...item,
    _id: item?._id || item?.id || '',
    id: item?.id || item?._id || '',
    name: normalizeText(item?.name, i18n.t('restaurant.dashboard.dishFallbackName')),
    description: normalizeText(
      item?.description,
      i18n.t('restaurant.dashboard.dishFallbackDescription')
    ),
    price: normalizeNumber(item?.price, 0),
    category: normalizeText(item?.category),
    cuisine: normalizeText(item?.cuisine, i18n.t('restaurant.menuScreen.cuisineFallback')),
    available: normalizeBoolean(item?.available, true),
    isPopular: normalizeBoolean(item?.isPopular, false),
    isRecommended: normalizeBoolean(item?.isRecommended, false),
    image: normalizeText(item?.image),
  };
};

const normalizeOrder = (order = {}) => {
  return {
    ...order,
    _id: order?._id || order?.id || '',
    id: order?.id || order?._id || '',
    status: normalizeText(order?.status, 'En attente'),
    totalPrice: normalizeNumber(order?.totalPrice, 0),
  };
};

const getPendingOrderStatuses = () => [
  'en attente',
  'pending',
  'confirmée',
  'confirmee',
  'confirmed',
  'en préparation',
  'en preparation',
  'preparing',
  'préparation',
  'preparation',
  'prête',
  'prete',
  'ready',
];

const isRestaurantPending = (user) => {
  const accountStatus = normalizeStatus(user?.accountStatus);
  const onboardingStatus = normalizeStatus(user?.onboardingStatus);

  return (
    accountStatus === 'pending_verification' ||
    accountStatus === 'submitted' ||
    accountStatus === 'draft' ||
    onboardingStatus === 'documents_pending' ||
    onboardingStatus === 'identity_pending'
  );
};

export default function RestaurantDashboard() {
  const { t } = useTranslation();
  const auth = useAuth() || {};

  const user = auth.user ?? null;
  const role = auth.role;
  const token = auth.token;
  const logout = auth.logout;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);

  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentRole = useMemo(
    () => normalizeRole(role || user?.role),
    [role, user]
  );

  const restaurantId = useMemo(() => {
    return restaurant?._id || restaurant?.id || null;
  }, [restaurant]);

  const fetchDashboardData = useCallback(
    async (silent = false) => {
      if (!token || currentRole !== 'restaurant') {
        setRestaurant(null);
        setMenuItems([]);
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const restaurantResponse = await apiGet(API_ENDPOINTS.restaurants.my, token);
        const safeRestaurant = extractRestaurantPayload(restaurantResponse);

        if (!safeRestaurant?._id && !safeRestaurant?.id) {
          setRestaurant(null);
          setMenuItems([]);
          setOrders([]);
          return;
        }

        const normalizedRestaurant = {
          ...safeRestaurant,
          _id: safeRestaurant?._id || safeRestaurant?.id,
          id: safeRestaurant?.id || safeRestaurant?._id,
          name: normalizeText(safeRestaurant?.name, user?.name || t('restaurant.menuScreen.restaurantNameFallback')),
          currency: normalizeText(safeRestaurant?.currency, 'EUR'),
          cuisine: normalizeText(safeRestaurant?.cuisine),
          address: normalizeText(safeRestaurant?.address),
          description: normalizeText(safeRestaurant?.description),
          phone: normalizeText(safeRestaurant?.phone),
          email: normalizeText(safeRestaurant?.email),
          isOpen: safeRestaurant?.isOpen !== false,
        };

        setRestaurant(normalizedRestaurant);

        const [menuResponse, ordersResponse] = await Promise.all([
          apiGet(
            `${API_ENDPOINTS.menu.byRestaurant(
              normalizedRestaurant._id
            )}?includeUnavailable=true`,
            token
          ),
          apiGet(
            API_ENDPOINTS.orders.restaurantOrders(normalizedRestaurant._id),
            token
          ),
        ]);

        const safeMenuItems = extractMenuArray(menuResponse)
          .map(normalizeMenuItem)
          .filter((item) => item?._id);

        const safeOrders = extractOrdersArray(ordersResponse)
          .map(normalizeOrder)
          .filter((item) => item?._id);

        setMenuItems(safeMenuItems);
        setOrders(safeOrders);
      } catch (error) {
        console.log('Erreur dashboard restaurant :', error);
        Alert.alert(
          t('common.error'),
          error?.message || t('restaurant.dashboard.errorLoadDashboardBody')
        );
        setRestaurant(null);
        setMenuItems([]);
        setOrders([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, currentRole, user, t]
  );

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData(false);
    }, [fetchDashboardData])
  );

  const dashboardStats = useMemo(() => {
    const totalItems = menuItems.length;
    const availableItems = menuItems.filter((item) => item?.available !== false).length;
    const popularItems = menuItems.filter((item) => item?.isPopular).length;
    const totalOrders = orders.length;
    const pendingStatuses = getPendingOrderStatuses();

    const pendingOrders = orders.filter((order) =>
      pendingStatuses.includes(normalizeStatus(order?.status))
    ).length;

    const revenue = orders.reduce((sum, order) => {
      return sum + normalizeNumber(order?.totalPrice, 0);
    }, 0);

    return {
      totalItems,
      availableItems,
      popularItems,
      totalOrders,
      pendingOrders,
      revenue,
    };
  }, [menuItems, orders]);

  const handleLogout = useCallback(async () => {
    try {
      if (typeof logout === 'function') {
        await logout();
      }
    } catch (error) {
      console.log('Erreur déconnexion restaurant :', error);
    } finally {
      router.replace('/auth/role');
    }
  }, [logout]);

  const handleDelete = useCallback(
    async (id) => {
      if (!token) {
        Alert.alert(t('common.error'), t('restaurant.dashboard.errorSessionInvalidBody'));
        return;
      }

      if (!id) {
        Alert.alert(t('common.error'), t('restaurant.dashboard.errorDishNotFoundBody'));
        return;
      }

      Alert.alert(
        t('restaurant.menuScreen.deleteConfirmTitle'),
        t('restaurant.dashboard.deleteConfirmBody'),
        [
          { text: t('restaurant.settings.cancelButton'), style: 'cancel' },
          {
            text: t('restaurant.menuScreen.deleteButton'),
            style: 'destructive',
            onPress: async () => {
              try {
                await apiDelete(API_ENDPOINTS.menu.byId(id), token);
                setMenuItems((prev) => prev.filter((item) => item?._id !== id));
                Alert.alert(t('restaurant.dashboard.deleteSuccessTitle'), t('restaurant.dashboard.deleteSuccessBody'));
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
        price:
          item?.price !== undefined && item?.price !== null
            ? String(item.price)
            : '',
        image: item?.image || '',
        category: item?.category || 'Plats principaux',
        cuisine: item?.cuisine || 'Africaine',
        available: String(item?.available !== false),
        isPopular: String(!!item?.isPopular),
        isRecommended: String(!!item?.isRecommended),
      },
    });
  }, []);

  const handleAddItem = useCallback(() => {
    if (!restaurantId) {
      Alert.alert(
        t('restaurant.dashboard.restaurantNotFoundTitle'),
        t('restaurant.dashboard.restaurantNotFoundBody')
      );
      return;
    }

    router.push({
      pathname: '/restaurant/AddMenuItem',
      params: { restaurantId },
    });
  }, [restaurantId, t]);

  const handleOpenOrders = useCallback(() => {
    router.push('/restaurant/restaurant-orders');
  }, []);

  const handleOpenProfile = useCallback(() => {
    router.push('/restaurant/restaurant-profile');
  }, []);

  if (authLoading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#D4A017" />
        <Text style={styles.loaderText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login?role=restaurant" />;
  }

  if (currentRole !== 'restaurant') {
    if (currentRole === 'admin') {
      return <Redirect href="/admin" />;
    }

    if (currentRole === 'livreur') {
      return <Redirect href="/livraison" />;
    }

    return <Redirect href="/(tabs)/index" />;
  }

  if (isRestaurantPending(user)) {
    return <Redirect href="/auth/pending-approval?role=restaurant" />;
  }

  const renderHeader = () => (
    <View>
      <View style={styles.topActions}>
        <Pressable style={styles.topButton} onPress={handleOpenProfile}>
          <Ionicons name="person-outline" size={20} color="#1E1E1E" />
        </Pressable>

        <View style={styles.topActionsRight}>
          <Pressable
            style={[styles.topButton, styles.topButtonSpaced]}
            onPress={() => fetchDashboardData(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#1E1E1E" />
            ) : (
              <Ionicons name="refresh-outline" size={20} color="#1E1E1E" />
            )}
          </Pressable>

          <Pressable
            style={[styles.topButton, styles.topButtonSpaced]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#B63B3B" />
          </Pressable>
        </View>
      </View>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>{t('restaurant.dashboard.eyebrow')}</Text>
        <Text style={styles.title}>{t('restaurant.dashboard.title')}</Text>
        <Text style={styles.subtitle}>
          {t('restaurant.dashboard.subtitle')}
        </Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons
            name="storefront-outline"
            size={28}
            color="#1F6F43"
          />
        </View>

        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>
            {restaurant?.name || user?.name || t('restaurant.dashboard.heroTitleFallback')}
          </Text>
          <Text style={styles.heroText}>
            {restaurant?.description ||
              t('restaurant.dashboard.heroTextFallback')}
          </Text>

          <View style={styles.heroTags}>
            {!!restaurant?.cuisine && (
              <View style={styles.heroTag}>
                <Text style={styles.heroTagText}>{restaurant.cuisine}</Text>
              </View>
            )}

            <View
              style={[
                styles.heroTag,
                restaurant?.isOpen ? styles.heroTagOpen : styles.heroTagClosed,
              ]}
            >
              <Text
                style={[
                  styles.heroTagText,
                  restaurant?.isOpen
                    ? styles.heroTagTextOpen
                    : styles.heroTagTextClosed,
                ]}
              >
                {restaurant?.isOpen ? t('restaurant.profile.openLabel') : t('restaurant.profile.closedLabel')}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{dashboardStats.totalItems}</Text>
          <Text style={styles.statLabel}>{t('restaurant.dashboard.statDishesLabel')}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{dashboardStats.availableItems}</Text>
          <Text style={styles.statLabel}>{t('restaurant.menuScreen.availableLabel')}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{dashboardStats.totalOrders}</Text>
          <Text style={styles.statLabel}>{t('restaurant.orders.title')}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{dashboardStats.pendingOrders}</Text>
          <Text style={styles.statLabel}>{t('restaurant.dashboard.statInProgressLabel')}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{dashboardStats.popularItems}</Text>
          <Text style={styles.statLabel}>{t('restaurant.menuScreen.popularLabel')}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {formatPrice(dashboardStats.revenue, restaurant?.currency || 'EUR')}
          </Text>
          <Text style={styles.statLabel}>{t('restaurant.dashboard.statRevenueLabel')}</Text>
        </View>
      </View>

      <View style={styles.quickButtonsRow}>
        <Pressable style={styles.quickButtonPrimary} onPress={handleAddItem}>
          <Ionicons name="add-circle-outline" size={20} color="#1E1E1E" />
          <Text style={styles.quickButtonPrimaryText}>{t('restaurant.menuScreen.addDishButton')}</Text>
        </Pressable>

        <Pressable
          style={styles.quickButtonSecondary}
          onPress={handleOpenOrders}
        >
          <Ionicons name="receipt-outline" size={20} color="#1F6F43" />
          <Text style={styles.quickButtonSecondaryText}>{t('restaurant.dashboard.viewOrdersButton')}</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('restaurant.dashboard.myMenuSectionTitle')}</Text>
        <Text style={styles.sectionCount}>{t('restaurant.dashboard.dishesCount', { count: menuItems.length })}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#D4A017" />
        <Text style={styles.loaderText}>{t('restaurant.dashboard.dashboardLoadingText')}</Text>
      </View>
    );
  }

  if (!restaurantId) {
    return (
      <FadeInView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="storefront-remove-outline"
            size={52}
            color="#C8BBAA"
          />
          <Text style={styles.emptyTitle}>{t('restaurant.dashboard.noRestaurantTitle')}</Text>
          <Text style={styles.emptyText}>
            {t('restaurant.dashboard.noRestaurantText')}
          </Text>
        </View>
      </FadeInView>
    );
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <FlatList
        data={menuItems}
        keyExtractor={(item, index) =>
          item?._id?.toString() || item?.id?.toString() || index.toString()
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.name} numberOfLines={1}>
                {item?.name || t('restaurant.dashboard.dishFallbackName')}
              </Text>

              <View
                style={[
                  styles.statusBadge,
                  item?.available !== false
                    ? styles.statusBadgeAvailable
                    : styles.statusBadgeUnavailable,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    item?.available !== false
                      ? styles.statusBadgeTextAvailable
                      : styles.statusBadgeTextUnavailable,
                  ]}
                >
                  {item?.available !== false ? t('restaurant.menuScreen.availableBadge') : t('restaurant.menuScreen.unavailableBadge')}
                </Text>
              </View>
            </View>

            <Text style={styles.desc} numberOfLines={2}>
              {item?.description || t('restaurant.dashboard.dishFallbackDescription')}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.priceBadge}>
                <Ionicons name="cash-outline" size={14} color="#D96C2D" />
                <Text style={styles.price}>
                  {formatPrice(item?.price, restaurant?.currency || 'EUR')}
                </Text>
              </View>

              {!!item?.category && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.category}>{item.category}</Text>
                </View>
              )}
            </View>

            <View style={styles.tagsRow}>
              {!!item?.isPopular && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{t('restaurant.menuScreen.popularBadge')}</Text>
                </View>
              )}

              {!!item?.isRecommended && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{t('restaurant.menuScreen.recommendedBadge')}</Text>
                </View>
              )}

              {!!item?.cuisine && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{item.cuisine}</Text>
                </View>
              )}
            </View>

            <View style={styles.actions}>
              <Pressable
                style={styles.secondaryAction}
                onPress={() => handleEdit(item)}
              >
                <Ionicons name="create-outline" size={16} color="#1F6F43" />
                <Text style={styles.secondaryActionText}>{t('restaurant.menuScreen.editButton')}</Text>
              </Pressable>

              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDelete(item?._id)}
              >
                <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                <Text style={styles.deleteText}>{t('restaurant.menuScreen.deleteButton')}</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="silverware-fork-knife"
              size={46}
              color="#C8BBAA"
            />
            <Text style={styles.emptyTitle}>{t('restaurant.dashboard.emptyMenuTitle')}</Text>
            <Text style={styles.emptyText}>
              {t('restaurant.dashboard.emptyMenuText')}
            </Text>

            <Pressable style={styles.emptyButton} onPress={handleAddItem}>
              <Text style={styles.emptyButtonText}>{t('restaurant.dashboard.addFirstDishButton')}</Text>
            </Pressable>
          </View>
        }
        contentContainerStyle={[
          styles.listContent,
          menuItems.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDashboardData(true)}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  listContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 120 },
  emptyListContent: { flexGrow: 1 },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
  },
  loaderText: { marginTop: 12, color: '#777777', fontSize: 15 },

  topActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  topActionsRight: { flexDirection: 'row', alignItems: 'center' },
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
  topButtonSpaced: { marginLeft: 10 },

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
    color: '#1E1E1E',
    marginBottom: 8,
  },
  subtitle: { color: '#6B655E', fontSize: 14, lineHeight: 21 },

  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#E8F5ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  heroContent: { flex: 1 },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1E1E',
    marginBottom: 6,
  },
  heroText: { color: '#666666', fontSize: 14, lineHeight: 21 },
  heroTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  heroTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    marginBottom: 8,
  },
  heroTagText: {
    color: '#555555',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTagOpen: { backgroundColor: '#E8F5ED' },
  heroTagClosed: { backgroundColor: '#FDECEC' },
  heroTagTextOpen: { color: '#1F6F43' },
  heroTagTextClosed: { color: '#B63B3B' },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 18,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    marginHorizontal: '1%',
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E1E1E',
    marginBottom: 6,
    textAlign: 'center',
  },
  statLabel: { fontSize: 13, color: '#777777', fontWeight: '700' },

  quickButtonsRow: { flexDirection: 'row', marginBottom: 20 },
  quickButtonPrimary: {
    flex: 1,
    backgroundColor: '#D4A017',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginRight: 6,
  },
  quickButtonPrimaryText: {
    color: '#111111',
    fontWeight: '900',
    fontSize: 15,
    marginLeft: 8,
  },
  quickButtonSecondary: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#E8F1EA',
  },
  quickButtonSecondaryText: {
    color: '#1F6F43',
    fontWeight: '900',
    fontSize: 15,
    marginLeft: 8,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E1E1E',
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D4A017',
  },

  card: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 22,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  name: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1E1E1E',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeAvailable: { backgroundColor: '#E8F5ED' },
  statusBadgeUnavailable: { backgroundColor: '#FDEAEA' },
  statusBadgeText: { fontSize: 12, fontWeight: '800' },
  statusBadgeTextAvailable: { color: '#1F6F43' },
  statusBadgeTextUnavailable: { color: '#B63B3B' },

  desc: {
    color: '#666666',
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 21,
    fontSize: 14,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5EC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 10,
    marginBottom: 8,
  },
  price: {
    color: '#D96C2D',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  categoryBadge: {
    backgroundColor: '#FFF3D8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  category: { color: '#6A5530', fontWeight: '700', fontSize: 12 },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
  tag: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: { color: '#555555', fontSize: 12, fontWeight: '700' },

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5FBF7',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginRight: 10,
  },
  secondaryActionText: {
    color: '#1F6F43',
    fontWeight: '800',
    marginLeft: 6,
  },
  deleteButton: {
    backgroundColor: '#C0392B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteText: { color: '#FFFFFF', fontWeight: '800', marginLeft: 6 },

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
    color: '#777777',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  emptyButton: {
    backgroundColor: '#D4A017',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  emptyButtonText: {
    color: '#111111',
    fontWeight: '800',
    fontSize: 15,
  },
});