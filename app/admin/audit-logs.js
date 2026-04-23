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
  TextInput,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { getAdminAuditLogs } from '../../services/adminService';

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const TARGET_TYPE_FILTERS = [
  'Tous',
  'user',
  'restaurant',
  'driver',
  'order',
  'system',
  'other',
];

const SORT_FILTERS = ['recent', 'oldest'];

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

const isAdminRole = (role) => {
  return (
    role === 'admin' ||
    role === 'administrator' ||
    role === 'superadmin' ||
    role === 'super-admin'
  );
};

const isDriverRole = (role) => {
  return role === 'livreur' || role === 'driver' || role === 'delivery';
};

const getAccountStatus = (user, auth) => {
  return normalizeStatus(
    user?.status ||
      user?.approvalStatus ||
      user?.adminStatus ||
      auth?.status ||
      ''
  );
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
  });
};

const formatActionLabel = (value) => {
  const raw = normalizeText(value);

  if (!raw) return 'Action admin';

  return raw
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
};

const getTargetTypeLabel = (value) => {
  switch (normalizeText(value).toLowerCase()) {
    case 'user':
      return 'Utilisateur';
    case 'restaurant':
      return 'Restaurant';
    case 'driver':
      return 'Livreur';
    case 'order':
      return 'Commande';
    case 'system':
      return 'Système';
    case 'other':
      return 'Autre';
    default:
      return normalizeText(value, 'Autre');
  }
};

const getTargetTypeStyle = (value) => {
  switch (normalizeText(value).toLowerCase()) {
    case 'user':
      return { bg: '#EEF2FF', text: '#245EA8' };
    case 'restaurant':
      return { bg: '#FFF2E8', text: '#C05621' };
    case 'driver':
      return { bg: '#F3E8FF', text: '#7C3AED' };
    case 'order':
      return { bg: '#EAF3FF', text: '#245EA8' };
    case 'system':
      return { bg: '#E8F5ED', text: '#1F6F43' };
    default:
      return { bg: '#F4F4F4', text: '#555555' };
  }
};

const getSortLabel = (value) => {
  switch (normalizeText(value).toLowerCase()) {
    case 'oldest':
      return 'Plus anciens';
    case 'recent':
    default:
      return 'Plus récents';
  }
};

const normalizeAuditItem = (item) => {
  if (!item || typeof item !== 'object') return null;

  return {
    _id: item?._id || item?.id || '',
    action: normalizeText(item?.action, 'action_admin'),
    details: normalizeText(item?.details),
    targetType: normalizeText(item?.targetType, 'other').toLowerCase(),
    targetLabel: normalizeText(item?.targetLabel),
    targetId: normalizeText(item?.targetId),
    ipAddress: normalizeText(item?.ipAddress),
    userAgent: normalizeText(item?.userAgent),
    createdAt: item?.createdAt || null,
    admin: {
      name: normalizeText(item?.admin?.name, 'Admin inconnu'),
      email: normalizeText(item?.admin?.email),
    },
  };
};

const normalizeAuditLogsResponse = (response) => {
  const items = Array.isArray(response?.items)
    ? response.items
    : Array.isArray(response?.data?.items)
    ? response.data.items
    : Array.isArray(response?.logs)
    ? response.logs
    : Array.isArray(response?.data?.logs)
    ? response.data.logs
    : [];

  return {
    items: items.map(normalizeAuditItem).filter(Boolean),
    total: normalizeNumber(response?.total ?? response?.data?.total, items.length),
    count: normalizeNumber(response?.count ?? response?.data?.count, items.length),
    page: normalizeNumber(response?.page ?? response?.data?.page, 1),
    pages: Math.max(normalizeNumber(response?.pages ?? response?.data?.pages, 1), 1),
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

const StatCard = ({ label, value }) => (
  <View style={styles.statCard}>
    <Text style={styles.statValue}>{normalizeNumber(value)}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function AdminAuditLogsScreen() {
  const auth = useAuth() || {};

  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const role = auth.role;
  const user = auth.user ?? null;
  const authLoading = Boolean(auth.loading);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [search, setSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [activeTargetType, setActiveTargetType] = useState('Tous');
  const [activeSort, setActiveSort] = useState('recent');

  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role);
  }, [role, user]);

  const currentStatus = useMemo(() => {
    return getAccountStatus(user, auth);
  }, [user, auth]);

  const hasValidSession = Boolean(isAuthenticated && token);

  const resolvedTargetType = useMemo(() => {
    return activeTargetType === 'Tous' ? '' : activeTargetType;
  }, [activeTargetType]);

  const canAccess = hasValidSession && isAdminRole(currentRole);

  const fetchLogs = useCallback(
    async (manual = false) => {
      if (!canAccess) {
        setLogs([]);
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
        } else {
          setLoading(true);
        }

        const response = await getAdminAuditLogs(token, {
          page: 1,
          limit: 100,
          search,
          targetType: resolvedTargetType,
          sort: activeSort,
        });

        const normalized = normalizeAuditLogsResponse(response);

        setLogs(normalized.items);
        setPagination({
          total: normalized.total,
          count: normalized.count,
          page: normalized.page,
          pages: normalized.pages,
          hasNextPage: normalized.hasNextPage,
          hasPrevPage: normalized.hasPrevPage,
          limit: normalized.limit,
        });
      } catch (error) {
        console.log('Erreur audit logs admin :', error);

        const message =
          error?.message || 'Impossible de charger les journaux admin.';

        setErrorMessage(message);
        setLogs([]);
        setPagination(DEFAULT_PAGINATION);

        if (manual) {
          Alert.alert('Erreur', message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setInitialLoaded(true);
      }
    },
    [canAccess, token, search, resolvedTargetType, activeSort]
  );

  useFocusEffect(
    useCallback(() => {
      fetchLogs(false);
    }, [fetchLogs])
  );

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/admin/AdminDashboard');
  }, []);

  const handleApplyFilters = useCallback(() => {
    setSearch(normalizeText(draftSearch));
  }, [draftSearch]);

  const handleResetFilters = useCallback(() => {
    setDraftSearch('');
    setSearch('');
    setActiveTargetType('Tous');
    setActiveSort('recent');
  }, []);

  const stats = useMemo(() => {
    return {
      total: normalizeNumber(pagination.total, logs.length),
      users: logs.filter((item) => item?.targetType === 'user').length,
      restaurants: logs.filter((item) => item?.targetType === 'restaurant').length,
      orders: logs.filter((item) => item?.targetType === 'order').length,
    };
  }, [logs, pagination]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(search || resolvedTargetType || activeSort !== 'recent');
  }, [search, resolvedTargetType, activeSort]);

  const openAuditLogDetails = useCallback((item) => {
    if (!item?._id) {
      Alert.alert('Erreur', 'Journal invalide.');
      return;
    }

    router.push({
      pathname: '/admin/audit-log-details/[id]',
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
        <Text style={styles.loaderText}>Chargement des journaux admin...</Text>
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
        data={logs}
        keyExtractor={(item, index) => item?._id || `log-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          logs.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchLogs(true)}
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
                onPress={() => fetchLogs(true)}
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
              <Text style={styles.title}>Journaux admin</Text>
              <Text style={styles.subtitle}>
                Suis les actions sensibles réalisées dans l’espace administration.
              </Text>
            </View>

            <View style={styles.statsRow}>
              <StatCard label="Total" value={stats.total} />
              <StatCard label="Users" value={stats.users} />
              <StatCard label="Restaurants" value={stats.restaurants} />
              <StatCard label="Orders" value={stats.orders} />
            </View>

            <View style={styles.searchWrap}>
              <Ionicons
                name="search-outline"
                size={18}
                color="#777777"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher action, cible, détails..."
                placeholderTextColor="#888888"
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
                  <Ionicons name="close-circle" size={18} color="#999999" />
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.filterTitle}>Type de cible</Text>
            <FlatList
              data={TARGET_TYPE_FILTERS}
              horizontal
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
              renderItem={({ item }) => {
                const isActive = activeTargetType === item;

                return (
                  <Pressable
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => setActiveTargetType(item)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isActive && styles.filterChipTextActive,
                      ]}
                    >
                      {item === 'Tous' ? item : getTargetTypeLabel(item)}
                    </Text>
                  </Pressable>
                );
              }}
            />

            <Text style={styles.filterTitle}>Tri</Text>
            <FlatList
              data={SORT_FILTERS}
              horizontal
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
              renderItem={({ item }) => {
                const isActive = activeSort === item;

                return (
                  <Pressable
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => setActiveSort(item)}
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
                <Ionicons name="refresh-circle-outline" size={16} color="#555555" />
                <Text style={styles.resetButtonText}>Réinitialiser</Text>
              </Pressable>
            </View>

            <View style={styles.resultsCard}>
              <View style={styles.resultsTopRow}>
                <Text style={styles.resultsTitle}>Résultats</Text>
                <Text style={styles.resultsCount}>
                  {normalizeNumber(pagination.count, logs.length)} /{' '}
                  {normalizeNumber(pagination.total, logs.length)}
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
                  {resolvedTargetType
                    ? ` • cible ${getTargetTypeLabel(resolvedTargetType)}`
                    : ''}
                  {activeSort !== 'recent'
                    ? ` • tri ${getSortLabel(activeSort)}`
                    : ''}
                </Text>
              ) : (
                <Text style={styles.resultsFiltersText}>
                  Aucun filtre actif.
                </Text>
              )}
            </View>

            {!!errorMessage && logs.length === 0 ? (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle-outline" size={18} color="#B83232" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const targetTypeStyle = getTargetTypeStyle(item?.targetType);

          return (
            <Pressable
              style={styles.card}
              onPress={() => openAuditLogDetails(item)}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.cardTopLeft}>
                  <Text style={styles.cardTitle}>
                    {formatActionLabel(item?.action)}
                  </Text>

                  <Text style={styles.cardMeta}>
                    Admin : {normalizeText(item?.admin?.name, 'Admin inconnu')}
                    {!!normalizeText(item?.admin?.email)
                      ? ` • ${normalizeText(item?.admin?.email)}`
                      : ''}
                  </Text>
                </View>

                <View
                  style={[
                    styles.targetBadge,
                    { backgroundColor: targetTypeStyle.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.targetBadgeText,
                      { color: targetTypeStyle.text },
                    ]}
                  >
                    {getTargetTypeLabel(item?.targetType)}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardMeta}>
                Cible : {getTargetTypeLabel(item?.targetType)}
                {normalizeText(item?.targetLabel)
                  ? ` • ${normalizeText(item?.targetLabel)}`
                  : ''}
              </Text>

              {!!normalizeText(item?.details) && (
                <Text style={styles.cardDetails}>{normalizeText(item?.details)}</Text>
              )}

              <View style={styles.cardMetaChipsRow}>
                {!!normalizeText(item?.ipAddress) && (
                  <View style={styles.metaBadge}>
                    <Ionicons name="globe-outline" size={14} color="#245EA8" />
                    <Text style={styles.metaBadgeText}>
                      {normalizeText(item?.ipAddress)}
                    </Text>
                  </View>
                )}

                {!!normalizeText(item?.userAgent) && (
                  <View style={styles.metaBadge}>
                    <Ionicons
                      name="phone-portrait-outline"
                      size={14}
                      color="#6B655E"
                    />
                    <Text style={styles.metaBadgeText}>Agent capturé</Text>
                  </View>
                )}

                {!!normalizeText(item?.targetId) && (
                  <View style={styles.metaBadge}>
                    <Ionicons
                      name="finger-print-outline"
                      size={14}
                      color="#7C3AED"
                    />
                    <Text style={styles.metaBadgeText}>Target ID</Text>
                  </View>
                )}
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.footerText}>{formatDateTime(item?.createdAt)}</Text>
                <View style={styles.footerRight}>
                  <Text style={styles.footerActionText}>Voir le détail</Text>
                  <Ionicons name="document-text-outline" size={18} color="#777777" />
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={54} color="#C8BBAA" />
            <Text style={styles.emptyTitle}>Aucun journal trouvé</Text>
            <Text style={styles.emptyText}>
              Les actions admin tracées apparaîtront ici.
            </Text>
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
  container: { flex: 1, backgroundColor: '#FFF8F0' },

  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 60 },

  emptyListContent: { flexGrow: 1 },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
  },

  loaderText: { marginTop: 12, color: '#777777', fontSize: 15 },

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
    width: '23%',
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

  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '700',
    textAlign: 'center',
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
    color: '#111111',
    paddingVertical: 14,
  },

  clearSearchButton: {
    marginLeft: 8,
  },

  filterTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#555555',
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
    color: '#555555',
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
    color: '#111111',
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
    color: '#555555',
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
    color: '#111111',
  },

  resultsCount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1F6F43',
  },

  resultsText: {
    color: '#666666',
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
    marginBottom: 8,
  },

  cardTopLeft: {
    flex: 1,
    paddingRight: 10,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 8,
    textTransform: 'capitalize',
  },

  cardMeta: {
    color: '#666666',
    fontSize: 13,
    marginBottom: 4,
    lineHeight: 19,
  },

  targetBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },

  targetBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },

  cardDetails: {
    color: '#333333',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },

  cardMetaChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
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
    color: '#555555',
    fontWeight: '700',
    fontSize: 12,
  },

  footerRow: {
    borderTopWidth: 1,
    borderTopColor: '#F2ECE5',
    paddingTop: 12,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  footerText: {
    color: '#777777',
    fontSize: 12,
    fontWeight: '700',
  },

  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  footerActionText: {
    color: '#1E1E1E',
    fontWeight: '800',
    fontSize: 13,
    marginRight: 8,
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
    color: '#777777',
    fontSize: 15,
    lineHeight: 22,
  },
});