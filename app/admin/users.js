// app/admin/users.jsx

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
import {
  getAdminUsers,
  updateAdminUserStatus,
} from '../../services/adminService';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const ROLE_FILTERS = ['Tous', 'client', 'restaurant', 'livreur', 'admin'];
const STATUS_FILTERS = [
  'Tous',
  'pending_verification',
  'active',
  'suspended',
  'rejected',
];
const SORT_OPTIONS = ['recent', 'oldest', 'name'];
const DEFAULT_PAGE_SIZE = 100;

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

const normalizeBoolean = (value) => {
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
  return Boolean(value);
};

const normalizeRole = (value) => normalizeText(value).toLowerCase();

const isAdminRole = (value) => {
  const role = normalizeRole(value);
  return (
    role === 'admin' ||
    role === 'administrator' ||
    role === 'superadmin' ||
    role === 'super-admin'
  );
};

const isDriverRole = (value) => {
  const role = normalizeRole(value);
  return role === 'livreur' || role === 'driver' || role === 'delivery';
};

const getAccountStatus = (user, auth = {}) => {
  return normalizeText(
    user?.accountStatus ||
      user?.status ||
      user?.approvalStatus ||
      auth?.status ||
      '',
    ''
  ).toLowerCase();
};

const getStatusStyle = (status, t) => {
  switch (normalizeText(status).toLowerCase()) {
    case 'active':
      return {
        bg: '#E8F5ED',
        text: '#1F6F43',
        label: t('admin.users.statusActiveLabel'),
        icon: 'checkmark-circle-outline',
      };
    case 'suspended':
      return {
        bg: '#FDECEC',
        text: '#B83232',
        label: t('admin.users.statusSuspendedLabel'),
        icon: 'ban-outline',
      };
    case 'pending_verification':
      return {
        bg: '#FFF3D8',
        text: '#8A6500',
        label: t('admin.users.statusPendingLabel'),
        icon: 'time-outline',
      };
    case 'rejected':
      return {
        bg: '#EFE9FF',
        text: '#6D4CDB',
        label: t('admin.users.statusRejectedLabel'),
        icon: 'close-circle-outline',
      };
    default:
      return {
        bg: '#F4F4F4',
        text: '#555555',
        label: t('admin.users.statusUnknownLabel'),
        icon: 'help-circle-outline',
      };
  }
};

const getRoleLabel = (role, t) => {
  switch (normalizeText(role).toLowerCase()) {
    case 'client':
      return t('admin.users.roleClientLabel');
    case 'restaurant':
      return t('admin.users.roleRestaurantLabel');
    case 'livreur':
    case 'driver':
    case 'delivery':
      return t('admin.users.roleDriverLabel');
    case 'admin':
    case 'administrator':
    case 'superadmin':
    case 'super-admin':
      return t('admin.users.roleAdminLabel');
    default:
      return t('admin.users.roleDefaultLabel');
  }
};

const getRoleStyle = (role) => {
  switch (normalizeText(role).toLowerCase()) {
    case 'client':
      return {
        bg: '#EEF2FF',
        text: '#245EA8',
        icon: 'person-outline',
      };
    case 'restaurant':
      return {
        bg: '#FFF2E8',
        text: '#C05621',
        icon: 'storefront-outline',
      };
    case 'livreur':
    case 'driver':
    case 'delivery':
      return {
        bg: '#F3E8FF',
        text: '#7C3AED',
        icon: 'bicycle-outline',
      };
    case 'admin':
    case 'administrator':
    case 'superadmin':
    case 'super-admin':
      return {
        bg: '#E8F5ED',
        text: '#1F6F43',
        icon: 'shield-checkmark-outline',
      };
    default:
      return {
        bg: '#F4F4F4',
        text: '#555555',
        icon: 'person-circle-outline',
      };
  }
};

const getStatusFilterLabel = (value, t) => {
  switch (value) {
    case 'pending_verification':
      return t('admin.users.statusPendingLabel');
    case 'active':
      return t('admin.users.statusActiveLabel');
    case 'suspended':
      return t('admin.users.statusSuspendedLabel');
    case 'rejected':
      return t('admin.users.statusRejectedLabel');
    default:
      return value;
  }
};

const getSortLabel = (value, t) => {
  switch (value) {
    case 'oldest':
      return t('admin.users.sortOldestLabel');
    case 'name':
      return t('admin.users.sortNameLabel');
    case 'recent':
    default:
      return t('admin.users.sortRecentLabel');
  }
};

const DATE_LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-ES', it: 'it-IT', zh: 'zh-CN' };

const formatDateTime = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(DATE_LOCALE_MAP[i18n.language] || 'fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const normalizeUser = (item) => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const normalizedRole = normalizeRole(item?.role || 'client');

  return {
    ...item,
    _id: item?._id || item?.id || null,
    id: item?.id || item?._id || null,
    name: normalizeText(item?.name),
    email: normalizeText(item?.email),
    phone: normalizeText(item?.phone),
    role:
      normalizedRole === 'driver' || normalizedRole === 'delivery'
        ? 'livreur'
        : normalizedRole,
    accountStatus: normalizeText(
      item?.accountStatus || item?.status,
      'pending_verification'
    ).toLowerCase(),
    isIdentityVerified: normalizeBoolean(item?.isIdentityVerified),
    isWorkAuthorized: normalizeBoolean(item?.isWorkAuthorized),
    createdAt: item?.createdAt || null,
    updatedAt: item?.updatedAt || null,
  };
};

const normalizeUsersResponse = (response) => {
  const items = Array.isArray(response?.items)
    ? response.items
    : Array.isArray(response?.users)
    ? response.users
    : Array.isArray(response?.data?.items)
    ? response.data.items
    : Array.isArray(response?.data?.users)
    ? response.data.users
    : Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
    ? response
    : [];

  const normalizedItems = items.map(normalizeUser).filter(Boolean);

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
    limit: normalizeNumber(response?.limit ?? response?.data?.limit, DEFAULT_PAGE_SIZE),
  };
};

/**
 * =========================================================
 * UI
 * =========================================================
 */

const StatCard = ({ label, value, icon, tint = '#1F6F43' }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconWrap, { backgroundColor: `${tint}14` }]}>
      <Ionicons name={icon} size={16} color={tint} />
    </View>
    <Text style={styles.statValue}>{normalizeNumber(value)}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function AdminUsersScreen() {
  const { t } = useTranslation();
  const auth = useAuth();

  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const role = auth.role;
  const user = auth.user ?? null;
  const authLoading = Boolean(auth.loading);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const [search, setSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [activeRole, setActiveRole] = useState('Tous');
  const [activeStatus, setActiveStatus] = useState('Tous');
  const [activeSort, setActiveSort] = useState('recent');
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [pagination, setPagination] = useState({
    total: 0,
    count: 0,
    page: 1,
    pages: 1,
    hasNextPage: false,
    hasPrevPage: false,
    limit: DEFAULT_PAGE_SIZE,
  });

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role);
  }, [role, user]);

  const currentStatus = useMemo(() => {
    return getAccountStatus(user, auth);
  }, [user, auth]);

  const canAccess = Boolean(isAuthenticated && token && isAdminRole(currentRole));

  const resolvedRoleFilter = useMemo(
    () => (activeRole === 'Tous' ? '' : activeRole),
    [activeRole]
  );

  const resolvedStatusFilter = useMemo(
    () => (activeStatus === 'Tous' ? '' : activeStatus),
    [activeStatus]
  );

  const safeUsers = useMemo(() => {
    return Array.isArray(users) ? users : [];
  }, [users]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/admin/AdminDashboard');
  }, []);

  const fetchUsers = useCallback(
    async (manual = false) => {
      if (!canAccess) {
        setUsers([]);
        setPagination({
          total: 0,
          count: 0,
          page: 1,
          pages: 1,
          hasNextPage: false,
          hasPrevPage: false,
          limit: DEFAULT_PAGE_SIZE,
        });
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

        const response = await getAdminUsers(token, {
          page: 1,
          limit: DEFAULT_PAGE_SIZE,
          role: resolvedRoleFilter,
          status: resolvedStatusFilter,
          search,
          sort: activeSort,
        });

        const normalized = normalizeUsersResponse(response);

        setUsers(normalized.items);
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
        console.log('Erreur admin users :', error);

        const message =
          error?.message || t('admin.users.fetchErrorFallback');

        setErrorMessage(message);
        setUsers([]);
        setPagination({
          total: 0,
          count: 0,
          page: 1,
          pages: 1,
          hasNextPage: false,
          hasPrevPage: false,
          limit: DEFAULT_PAGE_SIZE,
        });

        if (manual) {
          Alert.alert(t('common.error'), message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setInitialLoaded(true);
      }
    },
    [
      canAccess,
      token,
      resolvedRoleFilter,
      resolvedStatusFilter,
      search,
      activeSort,
      t,
    ]
  );

  useFocusEffect(
    useCallback(() => {
      fetchUsers(false);
    }, [fetchUsers])
  );

  const stats = useMemo(() => {
    return {
      total: normalizeNumber(pagination.total, safeUsers.length),
      active: safeUsers.filter((item) => item?.accountStatus === 'active').length,
      suspended: safeUsers.filter((item) => item?.accountStatus === 'suspended').length,
      pending: safeUsers.filter(
        (item) => item?.accountStatus === 'pending_verification'
      ).length,
    };
  }, [safeUsers, pagination]);

  const roleStats = useMemo(() => {
    return {
      clients: safeUsers.filter((item) => item?.role === 'client').length,
      restaurants: safeUsers.filter((item) => item?.role === 'restaurant').length,
      livreurs: safeUsers.filter((item) => item?.role === 'livreur').length,
      admins: safeUsers.filter((item) => isAdminRole(item?.role)).length,
    };
  }, [safeUsers]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      search ||
        resolvedRoleFilter ||
        resolvedStatusFilter ||
        activeSort !== 'recent'
    );
  }, [search, resolvedRoleFilter, resolvedStatusFilter, activeSort]);

  const handleApplyFilters = useCallback(() => {
    setSearch(normalizeText(draftSearch));
  }, [draftSearch]);

  const handleResetFilters = useCallback(() => {
    setDraftSearch('');
    setSearch('');
    setActiveRole('Tous');
    setActiveStatus('Tous');
    setActiveSort('recent');
  }, []);

  const handleStatusUpdate = useCallback(
    async (userId, nextStatus) => {
      if (!token) {
        Alert.alert(t('common.error'), t('admin.users.invalidSessionAlert'));
        return;
      }

      try {
        setUpdatingUserId(userId);

        const response = await updateAdminUserStatus(userId, nextStatus, token);
        const updatedUser = normalizeUser(
          response?.user || response?.data?.user || null
        );
        const successMessage =
          response?.message || t('admin.users.statusUpdatedFallback');

        setUsers((prev) =>
          prev.map((item) =>
            item?._id === userId
              ? {
                  ...item,
                  ...(updatedUser || {}),
                  accountStatus: updatedUser?.accountStatus || nextStatus,
                }
              : item
          )
        );

        Alert.alert(t('common.success'), successMessage);
      } catch (error) {
        console.log('Erreur update user status :', error);
        Alert.alert(
          t('common.error'),
          error?.message || t('admin.users.updateAccountErrorFallback')
        );
      } finally {
        setUpdatingUserId(null);
      }
    },
    [token, t]
  );

  const confirmToggleStatus = useCallback(
    (item) => {
      const currentUserStatus = normalizeText(item?.accountStatus).toLowerCase();
      const shouldActivate = ['suspended', 'pending_verification', 'rejected'].includes(
        currentUserStatus
      );
      const nextStatus = shouldActivate ? 'active' : 'suspended';
      const isPendingPartner =
        ['pending_verification', 'rejected'].includes(currentUserStatus) &&
        ['restaurant', 'livreur'].includes(item?.role);
      const actionLabel =
        nextStatus === 'active'
          ? isPendingPartner
            ? t('admin.userDetails.activatePartnerButton')
            : t('admin.users.reactivateAction')
          : t('admin.users.suspendAction');
      const identity = normalizeText(
        item?.name,
        normalizeText(item?.email, t('admin.users.defaultAccountIdentity'))
      );

      Alert.alert(
        t('admin.users.confirmDialogTitle'),
        t('admin.users.confirmDialogMessage', { action: actionLabel, identity }),
        [
          { text: t('admin.users.cancelAction'), style: 'cancel' },
          {
            text: t('admin.users.confirmDialogTitle'),
            onPress: () => handleStatusUpdate(item?._id, nextStatus),
          },
        ]
      );
    },
    [handleStatusUpdate, t]
  );

  const openUserDetails = useCallback((item) => {
    if (!item?._id) {
      Alert.alert(t('common.error'), t('admin.users.invalidUserAlert'));
      return;
    }

    router.push({
      pathname: '/admin/users-details/[id]',
      params: { id: item._id },
    });
  }, [t]);

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
        <Text style={styles.loaderText}>{t('admin.users.loaderText')}</Text>
      </View>
    );
  }

  /**
   * =========================================================
   * GUARDS
   * =========================================================
   */

  if (!isAuthenticated || !token) {
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

  if (
    currentStatus &&
    currentStatus !== 'approved' &&
    currentStatus !== 'active'
  ) {
    return <Redirect href="/auth/role" />;
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <FlatList
        data={safeUsers}
        keyExtractor={(item, index) => item?._id || `user-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          safeUsers.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchUsers(true)}
            tintColor="#1F6F43"
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
                onPress={() => fetchUsers(true)}
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
              <Text style={styles.eyebrow}>{t('admin.dashboard.eyebrow')}</Text>
              <Text style={styles.title}>{t('admin.common.usersTitle')}</Text>
              <Text style={styles.subtitle}>
                {t('admin.users.subtitle')}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <StatCard
                label={t('admin.users.statTotalLabel')}
                value={stats.total}
                icon="people-outline"
                tint="#1F6F43"
              />
              <StatCard
                label={t('admin.dashboard.activeLabel')}
                value={stats.active}
                icon="checkmark-circle-outline"
                tint="#1F6F43"
              />
              <StatCard
                label={t('admin.dashboard.suspendedLabel')}
                value={stats.suspended}
                icon="ban-outline"
                tint="#B83232"
              />
              <StatCard
                label={t('admin.dashboard.pendingLabel')}
                value={stats.pending}
                icon="time-outline"
                tint="#8A6500"
              />
            </View>

            <View style={styles.roleOverviewCard}>
              <Text style={styles.roleOverviewTitle}>{t('admin.users.roleBreakdownTitle')}</Text>

              <View style={styles.roleOverviewGrid}>
                <View style={styles.roleOverviewItem}>
                  <Text style={styles.roleOverviewValue}>
                    {roleStats.clients}
                  </Text>
                  <Text style={styles.roleOverviewLabel}>{t('admin.dashboard.clientsLabel')}</Text>
                </View>

                <View style={styles.roleOverviewItem}>
                  <Text style={styles.roleOverviewValue}>
                    {roleStats.restaurants}
                  </Text>
                  <Text style={styles.roleOverviewLabel}>{t('admin.common.restaurantsTitle')}</Text>
                </View>

                <View style={styles.roleOverviewItem}>
                  <Text style={styles.roleOverviewValue}>
                    {roleStats.livreurs}
                  </Text>
                  <Text style={styles.roleOverviewLabel}>{t('admin.common.driversTitle')}</Text>
                </View>

                <View style={styles.roleOverviewItem}>
                  <Text style={styles.roleOverviewValue}>
                    {roleStats.admins}
                  </Text>
                  <Text style={styles.roleOverviewLabel}>{t('admin.dashboard.adminsLabel')}</Text>
                </View>
              </View>
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
                placeholder={t('admin.users.searchPlaceholder')}
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

            <Text style={styles.filterTitle}>{t('admin.users.roleFilterTitle')}</Text>
            <FlatList
              data={ROLE_FILTERS}
              horizontal
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
              renderItem={({ item }) => {
                const isActive = activeRole === item;

                return (
                  <Pressable
                    style={[
                      styles.filterChip,
                      isActive && styles.filterChipActive,
                    ]}
                    onPress={() => setActiveRole(item)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isActive && styles.filterChipTextActive,
                      ]}
                    >
                      {item === 'Tous' ? t('admin.users.allFilterLabel') : getRoleLabel(item, t)}
                    </Text>
                  </Pressable>
                );
              }}
            />

            <Text style={styles.filterTitle}>{t('admin.users.statusFilterTitle')}</Text>
            <FlatList
              data={STATUS_FILTERS}
              horizontal
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
              renderItem={({ item }) => {
                const isActive = activeStatus === item;

                return (
                  <Pressable
                    style={[
                      styles.filterChip,
                      isActive && styles.filterChipActive,
                    ]}
                    onPress={() => setActiveStatus(item)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isActive && styles.filterChipTextActive,
                      ]}
                    >
                      {item === 'Tous'
                        ? t('admin.users.allFilterLabel')
                        : getStatusFilterLabel(item, t)}
                    </Text>
                  </Pressable>
                );
              }}
            />

            <Text style={styles.filterTitle}>{t('admin.users.sortFilterTitle')}</Text>
            <FlatList
              data={SORT_OPTIONS}
              horizontal
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersRow}
              renderItem={({ item }) => {
                const isActive = activeSort === item;

                return (
                  <Pressable
                    style={[
                      styles.filterChip,
                      isActive && styles.filterChipActive,
                    ]}
                    onPress={() => setActiveSort(item)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isActive && styles.filterChipTextActive,
                      ]}
                    >
                      {getSortLabel(item, t)}
                    </Text>
                  </Pressable>
                );
              }}
            />

            <View style={styles.actionsRow}>
              <Pressable
                style={styles.applyButton}
                onPress={handleApplyFilters}
              >
                <Text style={styles.applyButtonText}>
                  {t('admin.users.applyFiltersButton')}
                </Text>
              </Pressable>

              <Pressable
                style={styles.resetButton}
                onPress={handleResetFilters}
              >
                <Ionicons
                  name="refresh-circle-outline"
                  size={16}
                  color="#555"
                />
                <Text style={styles.resetButtonText}>{t('admin.users.resetButton')}</Text>
              </Pressable>
            </View>

            <View style={styles.resultsCard}>
              <View style={styles.resultsTopRow}>
                <Text style={styles.resultsTitle}>{t('admin.users.resultsTitle')}</Text>
                <Text style={styles.resultsCount}>
                  {normalizeNumber(pagination.count, safeUsers.length)} /{' '}
                  {normalizeNumber(pagination.total, safeUsers.length)}
                </Text>
              </View>

              <Text style={styles.resultsText}>
                {t('admin.users.resultsPageLabel', {
                  page: normalizeNumber(pagination.page, 1),
                  pages: Math.max(normalizeNumber(pagination.pages, 1), 1),
                })}
              </Text>

              {hasActiveFilters ? (
                <Text style={styles.resultsFiltersText}>
                  {t('admin.users.activeFiltersPrefix')}
                  {search ? t('admin.users.searchFilterFragment', { search }) : ''}
                  {resolvedRoleFilter
                    ? t('admin.users.roleFilterFragment', { role: getRoleLabel(resolvedRoleFilter, t) })
                    : ''}
                  {resolvedStatusFilter
                    ? t('admin.users.statusFilterFragment', { status: getStatusFilterLabel(resolvedStatusFilter, t) })
                    : ''}
                  {activeSort !== 'recent'
                    ? t('admin.users.sortFilterFragment', { sort: getSortLabel(activeSort, t) })
                    : ''}
                </Text>
              ) : (
                <Text style={styles.resultsFiltersText}>
                  {t('admin.users.noActiveFiltersText')}
                </Text>
              )}
            </View>

            {!!errorMessage && safeUsers.length === 0 ? (
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
          const statusStyle = getStatusStyle(item?.accountStatus, t);
          const roleStyle = getRoleStyle(item?.role);
          const isUpdating = updatingUserId === item?._id;
          const canToggle = !isAdminRole(item?.role);

          return (
            <Pressable style={styles.card} onPress={() => openUserDetails(item)}>
              <View style={styles.cardTopRow}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardName}>
                    {normalizeText(item?.name, t('admin.users.userNameFallback'))}
                  </Text>
                  <Text style={styles.cardSubText}>
                    {normalizeText(item?.email, t('admin.users.emailUnavailableFallback'))}
                  </Text>
                  {!!normalizeText(item?.phone) && (
                    <Text style={styles.cardSubText}>
                      {normalizeText(item?.phone)}
                    </Text>
                  )}
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusStyle.bg },
                  ]}
                >
                  <Ionicons
                    name={statusStyle.icon}
                    size={13}
                    color={statusStyle.text}
                  />
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: statusStyle.text },
                    ]}
                  >
                    {statusStyle.label}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View
                  style={[
                    styles.metaBadge,
                    { backgroundColor: roleStyle.bg },
                  ]}
                >
                  <Ionicons
                    name={roleStyle.icon}
                    size={14}
                    color={roleStyle.text}
                  />
                  <Text
                    style={[
                      styles.metaBadgeText,
                      { color: roleStyle.text },
                    ]}
                  >
                    {getRoleLabel(item?.role, t)}
                  </Text>
                </View>

                {item?.isIdentityVerified ? (
                  <View style={styles.metaBadge}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={14}
                      color="#1F6F43"
                    />
                    <Text style={styles.metaBadgeText}>
                      {t('admin.users.identityVerifiedLabel')}
                    </Text>
                  </View>
                ) : null}

                {item?.isWorkAuthorized ? (
                  <View style={styles.metaBadge}>
                    <Ionicons
                      name="briefcase-outline"
                      size={14}
                      color="#D96C2D"
                    />
                    <Text style={styles.metaBadgeText}>
                      {t('admin.users.workAuthorizedLabel')}
                    </Text>
                  </View>
                ) : null}

                {!!item?.createdAt ? (
                  <View style={styles.metaBadge}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color="#6B655E"
                    />
                    <Text style={styles.metaBadgeText}>
                      {t('admin.users.createdOnLabel', { date: formatDateTime(item?.createdAt) })}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.footerRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => openUserDetails(item)}
                >
                  <Ionicons name="eye-outline" size={16} color="#1F6F43" />
                  <Text style={styles.secondaryButtonText}>
                    {t('admin.users.viewDetailsButton')}
                  </Text>
                </Pressable>

                {canToggle ? (
                  <Pressable
                    style={[
                      styles.actionButton,
                      item?.accountStatus === 'suspended' &&
                        styles.actionButtonSuccess,
                    ]}
                    onPress={() => confirmToggleStatus(item)}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="#111" />
                    ) : (
                      <>
                        <Ionicons
                          name={
                            ['suspended', 'pending_verification', 'rejected'].includes(
                              normalizeText(item?.accountStatus).toLowerCase()
                            )
                              ? 'checkmark-circle-outline'
                              : 'ban-outline'
                          }
                          size={16}
                          color="#111"
                        />
                        <Text style={styles.actionButtonText}>
                          {['pending_verification', 'rejected'].includes(
                            normalizeText(item?.accountStatus).toLowerCase()
                          ) && ['restaurant', 'livreur'].includes(item?.role)
                            ? t('admin.userDetails.activatePartnerButton')
                            : ['suspended', 'pending_verification', 'rejected'].includes(
                                  normalizeText(item?.accountStatus).toLowerCase()
                                )
                              ? t('admin.users.reactivateButton')
                              : t('admin.users.suspendButton')}
                        </Text>
                      </>
                    )}
                  </Pressable>
                ) : (
                  <View style={styles.adminProtectedBox}>
                    <Text style={styles.adminProtectedText}>
                      {t('admin.users.adminProtectedText')}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={54} color="#C8BBAA" />
            <Text style={styles.emptyTitle}>{t('admin.users.emptyTitle')}</Text>
            <Text style={styles.emptyText}>
              {t('admin.users.emptyText')}
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
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
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

  roleOverviewCard: {
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
  roleOverviewTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111',
    marginBottom: 12,
  },
  roleOverviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  roleOverviewItem: {
    width: '23%',
    marginHorizontal: '1%',
    backgroundColor: '#FAF7F2',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  roleOverviewValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111',
    marginBottom: 4,
  },
  roleOverviewLabel: {
    fontSize: 11,
    color: '#666',
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
    marginBottom: 12,
  },
  cardLeft: {
    flex: 1,
    paddingRight: 10,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111',
    marginBottom: 4,
  },
  cardSubText: {
    color: '#666',
    fontSize: 13,
    marginBottom: 3,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },

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

  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  actionButton: {
    flex: 1,
    minHeight: 46,
    backgroundColor: '#D4A017',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  actionButtonSuccess: {
    backgroundColor: '#CDECD7',
  },
  actionButtonText: {
    color: '#111',
    fontWeight: '900',
    marginLeft: 8,
  },
  adminProtectedBox: {
    flex: 1,
    minHeight: 46,
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminProtectedText: {
    color: '#666',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
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
