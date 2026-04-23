import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { getAdminRestaurants } from '../../services/adminService';

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const SORT_OPTIONS = ['recent', 'oldest', 'name'];
const LIVE_REFRESH_MS = 15000;

const DEFAULT_PAGINATION = {
  total: 0,
  count: 0,
  page: 1,
  pages: 1,
  hasNextPage: false,
  hasPrevPage: false,
  limit: 100,
};

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

const normalizeRole = (value) => normalizeText(value).toLowerCase();

const normalizeStatus = (value) => normalizeText(value).toLowerCase();

const isAdminRole = (role) =>
  role === 'admin' ||
  role === 'administrator' ||
  role === 'superadmin' ||
  role === 'super-admin';

const isDriverRole = (role) =>
  role === 'livreur' || role === 'driver' || role === 'delivery';

const getAccountStatus = (user, auth) => {
  return normalizeStatus(
    user?.status ||
      user?.approvalStatus ||
      user?.adminStatus ||
      auth?.status ||
      ''
  );
};

const formatDateValue = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) return 'Date indisponible';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date indisponible';
  }

  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getSortLabel = (value) => {
  switch (value) {
    case 'oldest':
      return 'Plus anciens';
    case 'name':
      return 'Nom';
    case 'recent':
    default:
      return 'Plus récents';
  }
};

const normalizeRestaurant = (item) => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const owner =
    item?.owner && typeof item.owner === 'object'
      ? item.owner
      : item?.restaurantOwner && typeof item.restaurantOwner === 'object'
      ? item.restaurantOwner
      : null;

  const rating = normalizeNumber(item?.rating, 0);
  const menuCount = normalizeNumber(
    item?.menuItemsCount ?? item?.menuCount ?? item?.menusCount,
    0
  );
  const ordersCount = normalizeNumber(
    item?.ordersCount ?? item?.totalOrders ?? item?.completedOrders,
    0
  );

  return {
    ...item,
    _id: item?._id || item?.id || null,
    id: item?.id || item?._id || null,
    name: normalizeText(item?.name, 'Restaurant'),
    cuisine: normalizeText(item?.cuisine, 'Cuisine non définie'),
    address: normalizeText(item?.address),
    city: normalizeText(item?.city || item?.addressCity),
    country: normalizeText(item?.country || item?.addressCountry),
    owner,
    ownerName: normalizeText(owner?.name),
    ownerEmail: normalizeText(owner?.email),
    ownerPhone: normalizeText(owner?.phone),
    rating,
    menuCount,
    ordersCount,
    createdAt: item?.createdAt || null,
    updatedAt: item?.updatedAt || null,
    isOpen: item?.isOpen !== false,
    isFeatured: Boolean(item?.isFeatured),
    hasOwner: Boolean(owner?._id || owner?.name || owner?.email),
    hasAddress: Boolean(normalizeText(item?.address)),
    hasCuisine: Boolean(normalizeText(item?.cuisine)),
  };
};

const normalizeRestaurantsResponse = (response) => {
  const items = Array.isArray(response?.items)
    ? response.items
    : Array.isArray(response?.restaurants)
    ? response.restaurants
    : Array.isArray(response?.data?.items)
    ? response.data.items
    : Array.isArray(response?.data?.restaurants)
    ? response.data.restaurants
    : Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
    ? response
    : [];

  const normalizedItems = items.map(normalizeRestaurant).filter(Boolean);

  return {
    items: normalizedItems,
    total: normalizeNumber(response?.total ?? response?.data?.total, normalizedItems.length),
    count: normalizeNumber(response?.count ?? response?.data?.count, normalizedItems.length),
    page: normalizeNumber(response?.page ?? response?.data?.page, 1),
    pages: Math.max(
      normalizeNumber(response?.pages ?? response?.data?.pages, 1),
      1
    ),
    hasNextPage: Boolean(response?.hasNextPage ?? response?.data?.hasNextPage),
    hasPrevPage: Boolean(response?.hasPrevPage ?? response?.data?.hasPrevPage),
    limit: normalizeNumber(response?.limit ?? response?.data?.limit, 100),
  };
};

/**
 * =========================================================
 * UI
 * =========================================================
 */

const StatCard = ({ label, value, iconName, tint = '#1F6F43' }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconWrap, { backgroundColor: `${tint}14` }]}>
      <Ionicons name={iconName} size={18} color={tint} />
    </View>
    <Text style={styles.statValue}>{normalizeNumber(value)}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const QuickActionCard = ({ iconName, tint, title, text, onPress }) => (
  <Pressable style={styles.quickActionCard} onPress={onPress}>
    <View
      style={[styles.quickActionIconWrap, { backgroundColor: `${tint}14` }]}
    >
      <Ionicons name={iconName} size={18} color={tint} />
    </View>
    <Text style={styles.quickActionTitle}>{title}</Text>
    <Text style={styles.quickActionText}>{text}</Text>
  </Pressable>
);

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function AdminRestaurantsScreen() {
  const auth = useAuth() || {};

  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const role = auth.role;
  const user = auth.user ?? null;
  const authLoading = Boolean(auth.loading);

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [search, setSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [lastLiveRefresh, setLastLiveRefresh] = useState(null);

  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role);
  }, [role, user]);

  const currentStatus = useMemo(() => {
    return getAccountStatus(user, auth);
  }, [user, auth]);

  const hasValidSession = Boolean(isAuthenticated && token);
  const canAccess = hasValidSession && isAdminRole(currentRole);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/admin/AdminDashboard');
  }, []);

  const fetchRestaurants = useCallback(
    async (manual = false, silent = false) => {
      if (!canAccess) {
        setRestaurants([]);
        setPagination(DEFAULT_PAGINATION);
        setErrorMessage('');
        setLoading(false);
        setRefreshing(false);
        setInitialLoaded(true);
        return;
      }

      try {
        setErrorMessage('');

        if (manual) {
          setRefreshing(true);
        } else if (!silent) {
          setLoading(true);
        }

        const response = await getAdminRestaurants(token, {
          page: 1,
          limit: 100,
          search,
          sort,
        });

        const normalized = normalizeRestaurantsResponse(response);

        setRestaurants(normalized.items);
        setPagination({
          total: normalized.total,
          count: normalized.count,
          page: normalized.page,
          pages: normalized.pages,
          hasNextPage: normalized.hasNextPage,
          hasPrevPage: normalized.hasPrevPage,
          limit: normalized.limit,
        });
        setLastLiveRefresh(new Date().toISOString());
      } catch (error) {
        console.log('Erreur admin restaurants :', error);

        const message =
          error?.message || 'Impossible de charger les restaurants.';

        setErrorMessage(message);

        if (!silent) {
          setRestaurants([]);
          setPagination(DEFAULT_PAGINATION);
        }

        if (manual) {
          Alert.alert('Erreur', message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setInitialLoaded(true);
      }
    },
    [canAccess, token, search, sort]
  );

  useFocusEffect(
    useCallback(() => {
      fetchRestaurants(false, false);
    }, [fetchRestaurants])
  );

  useEffect(() => {
    if (!canAccess) {
      return undefined;
    }

    const interval = setInterval(() => {
      fetchRestaurants(false, true);
    }, LIVE_REFRESH_MS);

    return () => clearInterval(interval);
  }, [canAccess, fetchRestaurants]);

  const stats = useMemo(() => {
    return {
      total: normalizeNumber(pagination.total, restaurants.length),
      withOwner: restaurants.filter((item) => item?.hasOwner).length,
      withAddress: restaurants.filter((item) => item?.hasAddress).length,
      withCuisine: restaurants.filter((item) => item?.hasCuisine).length,
      open: restaurants.filter((item) => item?.isOpen).length,
      featured: restaurants.filter((item) => item?.isFeatured).length,
    };
  }, [restaurants, pagination]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(search || sort !== 'recent');
  }, [search, sort]);

  const liveRefreshLabel = useMemo(() => {
    if (!lastLiveRefresh) {
      return 'En attente du premier refresh live';
    }

    return `Dernier refresh live : ${formatDateTime(lastLiveRefresh)}`;
  }, [lastLiveRefresh]);

  const handleApplyFilters = useCallback(() => {
    setSearch(normalizeText(draftSearch));
  }, [draftSearch]);

  const handleResetFilters = useCallback(() => {
    setDraftSearch('');
    setSearch('');
    setSort('recent');
  }, []);

  const openRestaurantDetails = useCallback((item) => {
    if (!item?._id) {
      Alert.alert('Erreur', 'Restaurant invalide.');
      return;
    }

    router.push({
      pathname: '/admin/restaurant-details/[id]',
      params: { id: item._id },
    });
  }, []);

  /**
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (authLoading || (loading && !initialLoaded)) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#1F6F43" />
        <Text style={styles.loaderText}>Chargement des restaurants...</Text>
      </View>
    );
  }

  /**
   * =========================================================
   * GUARDS
   * =========================================================
   */

  if (!hasValidSession) {
    return <Redirect href="/auth/login?role=admin" />;
  }

  if (!isAdminRole(currentRole)) {
    if (currentRole === 'restaurant') {
      return <Redirect href="/restaurant/RestaurantDashboard" />;
    }

    if (isDriverRole(currentRole)) {
      return <Redirect href="/livraison/index" />;
    }

    return <Redirect href="/(tabs)/index" />;
  }

  if (currentStatus === 'pending') {
    return <Redirect href="/auth/pending-approval?role=admin" />;
  }

  if (currentStatus && currentStatus !== 'approved' && currentStatus !== 'active') {
    return <Redirect href="/auth/role" />;
  }

  /**
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <FlatList
        data={restaurants}
        keyExtractor={(item, index) => item?._id || `restaurant-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          restaurants.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchRestaurants(true, false)}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.topRow}>
              <Pressable style={styles.topButton} onPress={handleGoBack}>
                <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
              </Pressable>

              <Pressable
                style={[
                  styles.topButton,
                  refreshing && styles.topButtonDisabled,
                ]}
                onPress={() => fetchRestaurants(true, false)}
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
              <Text style={styles.eyebrow}>Admin</Text>
              <Text style={styles.title}>Restaurants</Text>
              <Text style={styles.subtitle}>
                Consulte, filtre et supervise tous les établissements partenaires,
                leur conformité commerciale et leur qualité d’exploitation.
              </Text>
            </View>

            <View style={styles.liveMonitorCard}>
              <View style={styles.liveMonitorHeader}>
                <View style={styles.liveMonitorTitleWrap}>
                  <Ionicons name="radio-outline" size={18} color="#245EA8" />
                  <Text style={styles.liveMonitorTitle}>
                    Restaurant Control Center
                  </Text>
                </View>

                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              </View>

              <Text style={styles.liveMonitorText}>
                Cette vue admin est la base premium AFROEAT pour superviser les
                restaurants, les owners, la couverture catalogue, la qualité des
                fiches et la structure business.
              </Text>

              <Text style={styles.liveMonitorSubText}>{liveRefreshLabel}</Text>
            </View>

            <View style={styles.statsRow}>
              <StatCard
                label="Total"
                value={stats.total}
                iconName="storefront-outline"
                tint="#1F6F43"
              />
              <StatCard
                label="Avec owner"
                value={stats.withOwner}
                iconName="person-outline"
                tint="#245EA8"
              />
              <StatCard
                label="Avec adresse"
                value={stats.withAddress}
                iconName="location-outline"
                tint="#D96C2D"
              />
              <StatCard
                label="Avec cuisine"
                value={stats.withCuisine}
                iconName="restaurant-outline"
                tint="#8A6500"
              />
              <StatCard
                label="Ouverts"
                value={stats.open}
                iconName="checkmark-circle-outline"
                tint="#1F6F43"
              />
              <StatCard
                label="Mis en avant"
                value={stats.featured}
                iconName="flash-outline"
                tint="#7C3AED"
              />
            </View>

            <View style={styles.quickActionsGrid}>
              <QuickActionCard
                iconName="star-outline"
                tint="#7C3AED"
                title="Premium shortlist"
                text="Trie par nom pour un contrôle rapide de la vitrine restaurants."
                onPress={() => setSort('name')}
              />
              <QuickActionCard
                iconName="search-outline"
                tint="#245EA8"
                title="Audit rapide"
                text="Lance une recherche ciblée owner, cuisine, ville ou adresse."
                onPress={handleApplyFilters}
              />
            </View>

            <View style={styles.searchWrap}>
              <Ionicons
                name="search-outline"
                size={18}
                color="#777"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher nom, cuisine, ville, adresse..."
                placeholderTextColor="#888"
                value={draftSearch}
                onChangeText={setDraftSearch}
                onSubmitEditing={handleApplyFilters}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {draftSearch ? (
                <Pressable
                  onPress={() => setDraftSearch('')}
                  style={styles.clearSearchButton}
                >
                  <Ionicons name="close-circle" size={18} color="#999" />
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.filterTitle}>Tri</Text>
            <FlatList
              data={SORT_OPTIONS}
              horizontal
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
              renderItem={({ item }) => {
                const isActive = sort === item;

                return (
                  <Pressable
                    style={[
                      styles.filterChip,
                      isActive && styles.filterChipActive,
                    ]}
                    onPress={() => setSort(item)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isActive && styles.filterChipTextActive,
                      ]}
                    >
                      {getSortLabel(item)}
                    </Text>
                  </Pressable>
                );
              }}
            />

            <View style={styles.actionsRow}>
              <Pressable style={styles.applyButton} onPress={handleApplyFilters}>
                <Text style={styles.applyButtonText}>Appliquer</Text>
              </Pressable>

              <Pressable style={styles.resetButton} onPress={handleResetFilters}>
                <Ionicons
                  name="refresh-circle-outline"
                  size={16}
                  color="#555"
                />
                <Text style={styles.resetButtonText}>Réinitialiser</Text>
              </Pressable>
            </View>

            <View style={styles.resultsCard}>
              <View style={styles.resultsTopRow}>
                <Text style={styles.resultsTitle}>Résultats</Text>
                <Text style={styles.resultsCount}>
                  {normalizeNumber(pagination.count, restaurants.length)} /{' '}
                  {normalizeNumber(pagination.total, restaurants.length)}
                </Text>
              </View>

              <Text style={styles.resultsText}>
                Page {normalizeNumber(pagination.page, 1)} sur{' '}
                {Math.max(normalizeNumber(pagination.pages, 1), 1)}
              </Text>

              {hasActiveFilters ? (
                <Text style={styles.resultsFiltersText}>
                  Filtres actifs :
                  {search ? ` recherche "${search}"` : ''}
                  {sort !== 'recent' ? ` • tri ${getSortLabel(sort)}` : ''}
                </Text>
              ) : (
                <Text style={styles.resultsFiltersText}>
                  Aucun filtre actif.
                </Text>
              )}
            </View>

            {!!errorMessage && restaurants.length === 0 ? (
              <View style={styles.errorCard}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color="#B83232"
                />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const openBadgeStyle = item?.isOpen
            ? { bg: '#E8F5ED', text: '#1F6F43', label: 'Ouvert' }
            : { bg: '#FDECEC', text: '#B83232', label: 'Fermé' };

          return (
            <Pressable
              style={styles.card}
              onPress={() => openRestaurantDetails(item)}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.cardTopLeft}>
                  <Text style={styles.cardTitle}>
                    {normalizeText(item?.name, 'Restaurant')}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {normalizeText(item?.cuisine, 'Cuisine non définie')}
                  </Text>
                </View>

                <View style={styles.cardTopRight}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: openBadgeStyle.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: openBadgeStyle.text },
                      ]}
                    >
                      {openBadgeStyle.label}
                    </Text>
                  </View>

                  <View style={styles.chevronWrap}>
                    <Ionicons name="chevron-forward" size={18} color="#777" />
                  </View>
                </View>
              </View>

              {!!normalizeText(item?.address) && (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={15} color="#6B655E" />
                  <Text style={styles.infoText}>
                    {normalizeText(item?.address)}
                  </Text>
                </View>
              )}

              {(normalizeText(item?.city) || normalizeText(item?.country)) ? (
                <View style={styles.infoRow}>
                  <Ionicons name="earth-outline" size={15} color="#6B655E" />
                  <Text style={styles.infoText}>
                    {[normalizeText(item?.city), normalizeText(item?.country)]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                </View>
              ) : null}

              {!!normalizeText(item?.ownerName) && (
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={15} color="#6B655E" />
                  <Text style={styles.infoText}>
                    Propriétaire : {normalizeText(item?.ownerName)}
                    {!!normalizeText(item?.ownerEmail)
                      ? ` • ${normalizeText(item?.ownerEmail)}`
                      : ''}
                  </Text>
                </View>
              )}

              {!!item?.createdAt && (
                <View style={styles.infoRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color="#6B655E"
                  />
                  <Text style={styles.infoText}>
                    Créé le {formatDateValue(item?.createdAt)}
                  </Text>
                </View>
              )}

              <View style={styles.metaRow}>
                {item?.rating > 0 ? (
                  <View style={styles.metaBadge}>
                    <Ionicons name="star-outline" size={14} color="#D4A017" />
                    <Text style={styles.metaBadgeText}>
                      {Number(item.rating).toFixed(1)}
                    </Text>
                  </View>
                ) : null}

                {item?.menuCount > 0 ? (
                  <View style={styles.metaBadge}>
                    <Ionicons name="book-outline" size={14} color="#245EA8" />
                    <Text style={styles.metaBadgeText}>
                      {item.menuCount} menu(s)
                    </Text>
                  </View>
                ) : null}

                {item?.ordersCount > 0 ? (
                  <View style={styles.metaBadge}>
                    <Ionicons
                      name="receipt-outline"
                      size={14}
                      color="#1F6F43"
                    />
                    <Text style={styles.metaBadgeText}>
                      {item.ordersCount} commande(s)
                    </Text>
                  </View>
                ) : null}

                {item?.isFeatured ? (
                  <View style={styles.metaBadge}>
                    <Ionicons name="flash-outline" size={14} color="#7C3AED" />
                    <Text style={styles.metaBadgeText}>Premium</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.footerRow}>
                <View style={styles.footerBadge}>
                  <Ionicons
                    name="storefront-outline"
                    size={15}
                    color="#1F6F43"
                  />
                  <Text style={styles.footerBadgeText}>Voir le détail</Text>
                </View>

                {!!item?.updatedAt && (
                  <Text style={styles.footerText}>
                    Maj : {formatDateValue(item?.updatedAt)}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="storefront-outline" size={54} color="#C8BBAA" />
            <Text style={styles.emptyTitle}>Aucun restaurant trouvé</Text>
            <Text style={styles.emptyText}>
              Essaie avec une autre recherche ou recharge la page.
            </Text>
          </View>
        }
      />
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 60 },
  emptyListContent: { flexGrow: 1 },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
  },
  loaderText: { marginTop: 12, color: '#777', fontSize: 15 },

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
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  topButtonDisabled: {
    opacity: 0.7,
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
    fontSize: 30,
    fontWeight: '900',
    color: '#1E1E1E',
    marginBottom: 8,
  },
  subtitle: { color: '#6B655E', fontSize: 14, lineHeight: 21 },

  liveMonitorCard: {
    backgroundColor: '#EEF4FF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  liveMonitorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveMonitorTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveMonitorTitle: {
    marginLeft: 8,
    color: '#245EA8',
    fontSize: 16,
    fontWeight: '900',
  },
  liveBadge: {
    backgroundColor: '#245EA8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  liveMonitorText: {
    color: '#4F5F88',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  liveMonitorSubText: {
    color: '#245EA8',
    fontSize: 12,
    fontWeight: '800',
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
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
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

  quickActionsGrid: {
    flexDirection: 'row',
    marginHorizontal: -4,
    marginBottom: 14,
  },
  quickActionCard: {
    width: '48%',
    marginHorizontal: '1%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  quickActionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111',
    marginBottom: 4,
  },
  quickActionText: {
    color: '#666',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },

  searchWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 52,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111',
    paddingVertical: 14,
  },
  clearSearchButton: {
    marginLeft: 8,
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

  actionsRow: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#D4A017',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  applyButtonText: {
    color: '#111',
    fontWeight: '900',
    fontSize: 14,
  },
  resetButton: {
    minWidth: 128,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5DDD2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  resetButtonText: {
    color: '#555',
    fontWeight: '800',
    fontSize: 13,
    marginLeft: 6,
  },

  resultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  resultsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    alignItems: 'center',
  },
  resultsTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111',
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1F6F43',
  },
  resultsText: {
    color: '#666',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '700',
  },
  resultsFiltersText: {
    color: '#6B655E',
    fontSize: 12,
    lineHeight: 18,
  },

  errorCard: {
    backgroundColor: '#FDECEC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    color: '#B83232',
    marginLeft: 8,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTopLeft: {
    flex: 1,
    paddingRight: 10,
  },
  cardTopRight: {
    alignItems: 'flex-end',
  },
  chevronWrap: {
    alignSelf: 'flex-end',
    paddingTop: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
    marginBottom: 6,
  },
  cardMeta: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    color: '#666',
    fontSize: 13,
    lineHeight: 19,
  },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 8,
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

  footerRow: {
    borderTopWidth: 1,
    borderTopColor: '#F2ECE5',
    paddingTop: 12,
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5FBF7',
    borderWidth: 1,
    borderColor: '#CFE5D7',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  footerBadgeText: {
    color: '#1F6F43',
    fontWeight: '800',
    fontSize: 13,
    marginLeft: 6,
  },
  footerText: {
    color: '#777',
    fontSize: 12,
    fontWeight: '700',
  },

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
    color: '#777',
    fontSize: 15,
    lineHeight: 22,
  },
});