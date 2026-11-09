import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { apiGet } from '../../services/apiClient';
import { API_ENDPOINTS } from '../../constants/api';
import i18n from '../../i18n';

const STATUS_FILTERS = [
  'Toutes',
  'En attente',
  'Confirmée',
  'En préparation',
  'En livraison',
  'Livrée',
  'Annulée',
];

const STATUS_FILTER_SLUG = {
  'Toutes': 'livraison.filtersAll',
  'En attente': 'order.status.pending',
  'Confirmée': 'order.status.confirmed',
  'En préparation': 'order.status.preparing',
  'En livraison': 'order.status.on_the_way',
  'Livrée': 'order.status.delivered',
  'Annulée': 'order.status.cancelled',
};

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeSearchText = (value) =>
  normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

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
  customerName: normalizeText(order?.user?.name || order?.customerName, i18n.t('restaurant.orders.customerFallback')),
  deliveryPersonName: normalizeText(
    order?.deliveryPerson?.name || order?.deliveryPersonName,
    ''
  ),
  createdAt: order?.createdAt || null,
  itemCount: Array.isArray(order?.items)
    ? order.items.reduce((sum, item) => sum + normalizeNumber(item?.quantity, 0), 0)
    : 0,
});

const formatPrice = (value, currency = 'EUR', locale = i18n.language) => {
  const amount = normalizeNumber(value, 0);
  const c = normalizeText(currency, 'EUR').toUpperCase();

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: c,
      maximumFractionDigits: c === 'XOF' || c === 'XAF' ? 0 : 2,
    }).format(amount);
  } catch {
    if (c === 'USD') return `$${amount.toFixed(2)}`;
    if (c === 'GBP') return `£${amount.toFixed(2)}`;
    if (c === 'XOF' || c === 'XAF') return `${amount.toFixed(0)} ${c}`;
    if (c === 'CAD') return `${amount.toFixed(2)} $CA`;
    return `${amount.toFixed(2)} €`;
  }
};

const DATE_LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-ES', it: 'it-IT', zh: 'zh-CN' };

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString(DATE_LOCALE_MAP[i18n.language] || 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getStatusStyle = (status) => {
  switch (normalizeText(status)) {
    case 'Livrée':
      return { bg: '#E8F5ED', text: '#084424', icon: 'checkmark-circle-outline' };
    case 'En livraison':
      return { bg: '#EAF3FF', text: '#245EA8', icon: 'bicycle-outline' };
    case 'En préparation':
      return { bg: '#FFF3D8', text: '#8A6500', icon: 'restaurant-outline' };
    case 'Confirmée':
      return { bg: '#EFE9FF', text: '#6D4CDB', icon: 'checkmark-done-outline' };
    case 'Annulée':
      return { bg: '#FDECEC', text: '#B83232', icon: 'close-circle-outline' };
    default:
      return { bg: '#FFF0E8', text: '#C8331A', icon: 'time-outline' };
  }
};

export default function RestaurantOrders() {
  const { t, i18n: translation } = useTranslation();
  const auth = useAuth() || {};
  const user = auth.user ?? null;
  const role = normalizeRole(auth.role || user?.role);
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);

  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activeStatus, setActiveStatus] = useState('Toutes');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const canAccess = isAuthenticated && role === 'restaurant';

  const load = useCallback(async (manual = false) => {
    const requestId = ++requestIdRef.current;

    if (!token || role !== 'restaurant') {
      setRestaurant(null);
      setOrders([]);
      setLoadError('');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (manual || hasLoadedOnceRef.current) setRefreshing(true);
      else setLoading(true);

      const restaurantResponse = await apiGet(API_ENDPOINTS.restaurants.my, token);
      if (requestId !== requestIdRef.current) return;
      const safeRestaurant = extractRestaurantPayload(restaurantResponse);

      if (!safeRestaurant?._id && !safeRestaurant?.id) {
        setRestaurant(null);
        setOrders([]);
        setLoadError('');
        return;
      }

      const restaurantId = safeRestaurant?._id || safeRestaurant?.id;
      setRestaurant({
        ...safeRestaurant,
        _id: restaurantId,
        name: normalizeText(safeRestaurant?.name, t('restaurant.menuScreen.restaurantNameFallback')),
      });

      const ordersResponse = await apiGet(
        API_ENDPOINTS.orders.restaurantOrders(restaurantId),
        token
      );

      if (requestId !== requestIdRef.current) return;

      setOrders(
        extractOrdersArray(ordersResponse)
          .map(normalizeOrder)
          .filter((item) => item?._id)
      );
      setLoadError('');
    } catch (error) {
      console.log('Erreur restaurant orders :', error);
      if (requestId === requestIdRef.current) {
        setLoadError(t('restaurant.refreshFailed'));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        hasLoadedOnceRef.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [role, token, t]);

  useFocusEffect(
    useCallback(() => {
      load(false);
      return () => {
        requestIdRef.current += 1;
      };
    }, [load])
  );

  const filteredOrders = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    return orders.filter((item) => {
      const matchesStatus = activeStatus === 'Toutes' || normalizeText(item?.status) === activeStatus;
      if (!matchesStatus) return false;
      if (!query) return true;

      const searchable = [
        item?._id,
        item?.orderNumber,
        item?.customerName,
        item?.deliveryPersonName,
        item?.status,
      ]
        .map(normalizeSearchText)
        .join(' ');

      return searchable.includes(query);
    });
  }, [orders, activeStatus, searchQuery]);

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
        <ActivityIndicator size="large" color="#084424" />
      </View>
    );
  }

  return (
    <FadeInView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

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
                <Ionicons name="arrow-back" size={20} color="#0D1C11" />
              </Pressable>

              <Pressable style={styles.topButton} onPress={() => load(true)}>
                {refreshing ? (
                  <ActivityIndicator size="small" color="#0D1C11" />
                ) : (
                  <Ionicons name="refresh-outline" size={20} color="#0D1C11" />
                )}
              </Pressable>
            </View>

            {!!loadError && (
              <View style={styles.refreshNotice}>
                <Ionicons name="cloud-offline-outline" size={18} color="#9B4B2D" />
                <Text style={styles.refreshNoticeText}>{loadError}</Text>
                <Pressable
                  onPress={() => load(true)}
                  disabled={refreshing}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.retry')}
                >
                  <Text style={styles.refreshNoticeAction}>{t('common.retry')}</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.header}>
              <Text style={styles.eyebrow}>{t('restaurant.settings.eyebrow')}</Text>
              <Text style={styles.title}>{t('restaurant.orders.title')}</Text>
              <Text style={styles.subtitle}>
                {t('restaurant.orders.subtitleWithName', { name: restaurant?.name || t('restaurant.orders.restaurantFallbackPossessive') })}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>{t('restaurant.menuScreen.totalLabel')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.pending}</Text>
                <Text style={styles.statLabel}>{t('order.status.pending')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.preparing}</Text>
                <Text style={styles.statLabel}>{t('restaurant.orders.preparingStatLabel')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.delivering}</Text>
                <Text style={styles.statLabel}>{t('restaurant.orders.deliveringStatLabel')}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.delivered}</Text>
                <Text style={styles.statLabel}>{t('restaurant.orders.deliveredStatLabel')}</Text>
              </View>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={19} color="#8B8177" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('restaurant.orders.searchPlaceholder')}
                placeholderTextColor="#9A9188"
                style={styles.searchInput}
                returnKeyType="search"
                accessibilityLabel={t('restaurant.orders.searchPlaceholder')}
              />
              {!!searchQuery && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel={t('restaurant.orders.clearSearch')}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={19} color="#8B8177" />
                </Pressable>
              )}
            </View>

            <Text style={styles.filterTitle}>{t('restaurant.orders.filterTitle')}</Text>
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
                      {t(STATUS_FILTER_SLUG[item] || 'livraison.filtersAll', item)}
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
                    {t('livraison.history.orderReference', { ref: String(item?._id || '').slice(-6).toUpperCase() })}
                  </Text>
                  <Text style={styles.cardMeta}>{t('restaurant.orders.customerLabel', { name: item.customerName })}</Text>
                  <Text style={styles.cardMeta}>
                    {t('restaurant.orders.createdOnLabel', { date: formatDate(item.createdAt) })}
                  </Text>
                  {!!item?.deliveryPersonName && (
                    <Text style={styles.cardMeta}>
                      {t('restaurant.orders.driverLabel', { name: item.deliveryPersonName })}
                    </Text>
                  )}
                </View>

                <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                  <Ionicons name={statusStyle.icon} size={13} color={statusStyle.text} />
                  <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                    {t(STATUS_FILTER_SLUG[item?.status] || 'order.status.pending', item?.status || '')}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaBadge}>
                  <Ionicons name="cash-outline" size={14} color="#C8331A" />
                  <Text style={styles.metaBadgeText}>
                    {formatPrice(
                      item?.totalPrice,
                      item?.currency || 'EUR',
                      translation.resolvedLanguage || translation.language
                    )}
                  </Text>
                </View>

                <View style={styles.metaBadge}>
                  <Ionicons name="bag-handle-outline" size={14} color="#084424" />
                  <Text style={styles.metaBadgeText}>
                    {t('livraison.itemsCount', { count: normalizeNumber(item?.itemCount) })}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={54} color="#C8BBAA" />
            <Text style={styles.emptyTitle}>
              {searchQuery.trim() || activeStatus !== 'Toutes'
                ? t('restaurant.orders.searchNoResultsTitle')
                : t('restaurant.orders.emptyTitle')}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery.trim() || activeStatus !== 'Toutes'
                ? t('restaurant.orders.searchNoResultsText')
                : t('restaurant.orders.emptyText')}
            </Text>
            {(searchQuery.trim() || activeStatus !== 'Toutes') && (
              <Pressable
                style={styles.clearFiltersButton}
                onPress={() => {
                  setSearchQuery('');
                  setActiveStatus('Toutes');
                }}
                accessibilityRole="button"
              >
                <Text style={styles.clearFiltersText}>{t('restaurant.orders.clearFilters')}</Text>
              </Pressable>
            )}
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
  refreshNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0E8',
    borderColor: '#F2C7B2',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  refreshNoticeText: { flex: 1, color: '#77412C', fontSize: 13, lineHeight: 18 },
  refreshNoticeAction: { color: '#9B4B2D', fontWeight: '800', padding: 4 },

  header: { marginBottom: 18 },
  searchBox: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8DED2',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: '#0D1C11',
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
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
    backgroundColor: '#0D1C11',
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
  clearFiltersButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#084424',
    marginTop: 4,
  },
  clearFiltersText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
