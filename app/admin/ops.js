import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Alert,
} from 'react-native';
import { router, useFocusEffect, Redirect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { getAdminOpsOverview } from '../../services/adminService';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const LIVE_REFRESH_MS = 15000;

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

const DATE_LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-ES', it: 'it-IT', zh: 'zh-CN' };

const formatDateTime = (value) => {
  if (!value) return i18n.t('admin.ops.dateUnavailable');

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return i18n.t('admin.ops.dateUnavailable');
  }

  return date.toLocaleString(DATE_LOCALE_MAP[i18n.language] || 'fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getHealthStyle = (status, t) => {
  const normalized = normalizeStatus(status);

  if (normalized === 'healthy') {
    return {
      bg: '#E8F5ED',
      text: '#084424',
      border: '#CFE8D8',
      label: t('admin.dashboard.healthyLabel'),
      icon: 'checkmark-circle',
      description: t('admin.ops.healthyDescription'),
    };
  }

  if (normalized === 'warning') {
    return {
      bg: '#FFF3D8',
      text: '#8A6500',
      border: '#F4D89B',
      label: t('admin.dashboard.warningLabel'),
      icon: 'warning',
      description: t('admin.ops.warningDescription'),
    };
  }

  if (normalized === 'critical') {
    return {
      bg: '#FDECEC',
      text: '#B83232',
      border: '#F3C7C7',
      label: t('admin.dashboard.criticalLabel'),
      icon: 'alert-circle',
      description: t('admin.ops.criticalDescription'),
    };
  }

  return {
    bg: '#F4F4F4',
    text: '#555555',
    border: '#E5E5E5',
    label: t('admin.dashboard.unknownLabel'),
    icon: 'help-circle-outline',
    description: t('admin.dashboard.unknownDescription'),
  };
};

const getFlagStyle = (level, t) => {
  const normalized = normalizeStatus(level);

  if (normalized === 'critical') {
    return {
      bg: '#FDECEC',
      text: '#B83232',
      border: '#F3C7C7',
      icon: 'alert-circle',
      label: t('admin.dashboard.flagCriticalLabel'),
    };
  }

  if (normalized === 'warning') {
    return {
      bg: '#FFF3D8',
      text: '#8A6500',
      border: '#F4D89B',
      icon: 'warning',
      label: t('admin.dashboard.flagWarningLabel'),
    };
  }

  return {
    bg: '#EEF2FF',
    text: '#334155',
    border: '#D9E0F2',
    icon: 'information-circle',
    label: t('admin.dashboard.flagInfoLabel'),
  };
};

const normalizeOpsOverview = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return {
      system: {},
      entities: {},
      orders: {},
      audit: {},
    };
  }

  const data = payload?.data || payload;

  return {
    system: data?.system || {},
    entities: data?.entities || {},
    orders: data?.orders || {},
    audit: data?.audit || {},
  };
};

/**
 * =========================================================
 * UI
 * =========================================================
 */

const StatCard = ({ label, value, iconName, tint = '#084424' }) => (
  <View style={styles.statCard}>
    <View style={styles.statCardTop}>
      <View style={[styles.statIconWrap, { backgroundColor: `${tint}14` }]}>
        <Ionicons name={iconName} size={18} color={tint} />
      </View>
    </View>
    <Text style={styles.statValue}>{normalizeNumber(value)}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const HighlightCard = ({
  label,
  value,
  iconName,
  tint = '#084424',
}) => (
  <View style={styles.highlightCard}>
    <View
      style={[
        styles.highlightIconWrap,
        { backgroundColor: `${tint}14` },
      ]}
    >
      <Ionicons name={iconName} size={18} color={tint} />
    </View>
    <View style={styles.highlightTextBlock}>
      <Text style={styles.highlightValue}>{normalizeNumber(value)}</Text>
      <Text style={styles.highlightLabel}>{label}</Text>
    </View>
  </View>
);

const MetricStripCard = ({ title, items }) => (
  <View style={styles.metricStripCard}>
    <Text style={styles.metricStripTitle}>{title}</Text>
    <View style={styles.metricStripGrid}>
      {items.map((item) => (
        <View key={item.key} style={styles.metricStripItem}>
          <Text
            style={[
              styles.metricStripValue,
              { color: item.tint || '#0D1C11' },
            ]}
          >
            {normalizeNumber(item.value)}
          </Text>
          <Text style={styles.metricStripLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  </View>
);

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function AdminOpsScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};

  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const role = auth.role;
  const user = auth.user ?? null;
  const authLoading = Boolean(auth.loading);

  const [ops, setOps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastLiveRefresh, setLastLiveRefresh] = useState(null);

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role);
  }, [role, user]);

  const currentStatus = useMemo(() => {
    return getAccountStatus(user, auth);
  }, [user, auth]);

  const hasValidSession = Boolean(isAuthenticated && token);

  const fetchOps = useCallback(
    async (manual = false, silent = false) => {
      if (!hasValidSession || !isAdminRole(currentRole)) {
        setOps(null);
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

        const data = await getAdminOpsOverview(token);
        setOps(normalizeOpsOverview(data));
        setLastLiveRefresh(new Date().toISOString());
      } catch (error) {
        console.log('Erreur admin ops :', error);

        const message =
          error?.message || t('admin.ops.fetchErrorFallback');

        setErrorMessage(message);

        if (!silent) {
          setOps(null);
        }

        if (manual) {
          Alert.alert(t('common.error'), message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setInitialLoaded(true);
      }
    },
    [hasValidSession, currentRole, token, t]
  );

  useFocusEffect(
    useCallback(() => {
      fetchOps(false, false);
    }, [fetchOps])
  );

  useEffect(() => {
    if (!hasValidSession || !isAdminRole(currentRole)) {
      return undefined;
    }

    const interval = setInterval(() => {
      fetchOps(false, true);
    }, LIVE_REFRESH_MS);

    return () => clearInterval(interval);
  }, [hasValidSession, currentRole, fetchOps]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/admin/AdminDashboard');
  }, []);

  const handleOpenOrders = useCallback(() => {
    router.push('/admin/orders');
  }, []);

  const handleOpenDrivers = useCallback(() => {
    router.push('/admin/drivers');
  }, []);

  const handleOpenUsers = useCallback(() => {
    router.push('/admin/users');
  }, []);

  const handleOpenRestaurants = useCallback(() => {
    router.push('/admin/restaurants');
  }, []);

  const handleOpenAuditLogs = useCallback(() => {
    router.push('/admin/audit-logs');
  }, []);

  const system = ops?.system || {};
  const entities = ops?.entities || {};
  const orders = ops?.orders || {};
  const audit = ops?.audit || {};

  const healthStyle = useMemo(() => {
    return getHealthStyle(system?.healthStatus, t);
  }, [system, t]);

  const healthFlags = useMemo(() => {
    return Array.isArray(system?.flags) ? system.flags : [];
  }, [system]);

  const populationStats = useMemo(
    () => [
      {
        key: 'total-users',
        label: t('admin.common.usersTitle'),
        value: entities.totalUsers,
        iconName: 'people-outline',
        tint: '#084424',
      },
      {
        key: 'total-restaurants',
        label: t('admin.common.restaurantsTitle'),
        value: entities.totalRestaurants,
        iconName: 'storefront-outline',
        tint: '#C8331A',
      },
      {
        key: 'total-drivers',
        label: t('admin.common.driversTitle'),
        value: entities.totalDrivers,
        iconName: 'bicycle-outline',
        tint: '#7C3AED',
      },
      {
        key: 'active-users',
        label: t('admin.dashboard.activeLabel'),
        value: entities.activeUsers,
        iconName: 'checkmark-done-outline',
        tint: '#15803D',
      },
    ],
    [entities, t]
  );

  const riskStats = useMemo(
    () => [
      {
        key: 'pending-users',
        label: t('admin.dashboard.pendingLabel'),
        value: entities.pendingUsers,
        iconName: 'time-outline',
        tint: '#8A6500',
      },
      {
        key: 'suspended-users',
        label: t('admin.dashboard.suspendedLabel'),
        value: entities.suspendedUsers,
        iconName: 'ban-outline',
        tint: '#B83232',
      },
      {
        key: 'active-restaurants',
        label: t('admin.ops.activeRestaurantsLabel'),
        value: entities.activeRestaurantsOwners,
        iconName: 'restaurant-outline',
        tint: '#245EA8',
      },
      {
        key: 'active-drivers',
        label: t('admin.ops.activeDriversLabel'),
        value: entities.activeDriversAccounts,
        iconName: 'navigate-outline',
        tint: '#084424',
      },
    ],
    [entities, t]
  );

  const orderFlowStats = useMemo(
    () => [
      {
        key: 'total-orders',
        label: t('admin.ops.totalOrdersLabel'),
        value: orders.totalOrders,
        iconName: 'receipt-outline',
        tint: '#084424',
      },
      {
        key: 'pending-orders',
        label: t('admin.dashboard.pendingLabel'),
        value: orders.pendingOrders,
        iconName: 'hourglass-outline',
        tint: '#C8331A',
      },
      {
        key: 'preparing-orders',
        label: t('order.status.preparing'),
        value: orders.preparingOrders,
        iconName: 'restaurant-outline',
        tint: '#8A6500',
      },
      {
        key: 'delivering-orders',
        label: t('order.status.on_the_way'),
        value: orders.deliveringOrders,
        iconName: 'bicycle-outline',
        tint: '#245EA8',
      },
      {
        key: 'delivered-orders',
        label: t('order.status.delivered'),
        value: orders.deliveredOrders,
        iconName: 'checkmark-circle-outline',
        tint: '#084424',
      },
      {
        key: 'cancelled-orders',
        label: t('order.status.cancelled'),
        value: orders.cancelledOrders,
        iconName: 'close-circle-outline',
        tint: '#B83232',
      },
    ],
    [orders, t]
  );

  const highlights = useMemo(
    () => [
      {
        key: 'new-users-7d',
        label: t('admin.dashboard.newAccounts7dLabel'),
        value: entities.newUsers7d,
        iconName: 'person-add-outline',
        tint: '#084424',
      },
      {
        key: 'new-restaurants-7d',
        label: t('admin.dashboard.newRestaurants7dLabel'),
        value: entities.newRestaurants7d,
        iconName: 'add-circle-outline',
        tint: '#C8331A',
      },
      {
        key: 'new-orders-24h',
        label: t('admin.dashboard.newOrders24hLabel'),
        value: orders.newOrders24h,
        iconName: 'time-outline',
        tint: '#245EA8',
      },
      {
        key: 'audit-logs-24h',
        label: t('admin.dashboard.adminLogs24hLabel'),
        value: audit.recentAuditLogs24h || audit.recentAuditLogs,
        iconName: 'document-text-outline',
        tint: '#7C3AED',
      },
    ],
    [entities, orders, audit, t]
  );

  const liveOverviewMetrics = useMemo(
    () => [
      {
        key: 'unassigned',
        label: t('admin.dashboard.unassignedLabel'),
        value: orders.unassignedOrders,
        tint: '#B83232',
      },
      {
        key: 'unpaid',
        label: t('admin.dashboard.unpaidLabel'),
        value: orders.unpaidOrders,
        tint: '#8A6500',
      },
      {
        key: 'delivering',
        label: t('admin.ops.liveTripsLabel'),
        value: orders.deliveringOrders,
        tint: '#245EA8',
      },
      {
        key: 'audit24h',
        label: t('admin.ops.audit24hLabel'),
        value: audit.recentAuditLogs24h || audit.recentAuditLogs,
        tint: '#7C3AED',
      },
    ],
    [orders, audit, t]
  );

  const liveRefreshLabel = useMemo(() => {
    if (!lastLiveRefresh) {
      return t('admin.ops.liveRefreshWaiting');
    }

    return t('admin.ops.liveRefreshLabel', { date: formatDateTime(lastLiveRefresh) });
  }, [lastLiveRefresh, t]);

  /**
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (authLoading || (loading && !initialLoaded)) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <ActivityIndicator size="large" color="#084424" />
        <Text style={styles.loaderText}>{t('admin.ops.loaderText')}</Text>
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
   * EMPTY STATE
   * =========================================================
   */

  if (!ops) {
    return (
      <FadeInView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={56} color="#D8B28A" />
          <Text style={styles.emptyTitle}>{t('admin.ops.emptyTitle')}</Text>
          <Text style={styles.emptyText}>
            {errorMessage || t('admin.ops.emptyTextFallback')}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={() => fetchOps(true, false)}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                <Text style={styles.retryButtonText}>{t('restaurant.retry')}</Text>
              </>
            )}
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  /**
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchOps(true, false)}
          />
        }
      >
        <View style={styles.topRow}>
          <Pressable style={styles.topButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={20} color="#0D1C11" />
          </Pressable>

          <Pressable
            style={[styles.topButton, refreshing && styles.topButtonDisabled]}
            onPress={() => fetchOps(true, false)}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#0D1C11" />
            ) : (
              <Ionicons name="refresh-outline" size={20} color="#0D1C11" />
            )}
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>{t('admin.dashboard.eyebrow')}</Text>
          <Text style={styles.title}>{t('admin.common.opsTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('admin.ops.subtitle')}
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>{t('admin.ops.heroTitle')}</Text>
            <Text style={styles.heroText}>
              {t('admin.ops.generatedLabel', { date: formatDateTime(system.generatedAt) })}
            </Text>
            <Text style={styles.heroSubText}>{healthStyle.description}</Text>
          </View>

          <View
            style={[
              styles.healthBadge,
              {
                backgroundColor: healthStyle.bg,
                borderColor: healthStyle.border,
              },
            ]}
          >
            <Ionicons
              name={healthStyle.icon}
              size={16}
              color={healthStyle.text}
            />
            <Text style={[styles.healthBadgeText, { color: healthStyle.text }]}>
              {healthStyle.label}
            </Text>
          </View>
        </View>

        <View style={styles.liveOpsCard}>
          <View style={styles.liveOpsHeader}>
            <View style={styles.liveOpsTitleWrap}>
              <Ionicons name="radio-outline" size={18} color="#245EA8" />
              <Text style={styles.liveOpsTitle}>{t('admin.ops.liveOpsMonitorTitle')}</Text>
            </View>

            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>

          <Text style={styles.liveOpsText}>
            {t('admin.ops.liveOpsText')}
          </Text>

          <Text style={styles.liveOpsSubText}>{liveRefreshLabel}</Text>
        </View>

        <MetricStripCard
          title={t('admin.ops.immediateSummaryTitle')}
          items={liveOverviewMetrics}
        />

        <View
          style={[
            styles.healthCard,
            {
              backgroundColor: healthStyle.bg,
              borderColor: healthStyle.border,
            },
          ]}
        >
          <View style={styles.healthCardHeader}>
            <View style={styles.healthCardTitleWrap}>
              <Ionicons
                name={healthStyle.icon}
                size={18}
                color={healthStyle.text}
              />
              <Text style={[styles.healthCardTitle, { color: healthStyle.text }]}>
                {t('admin.ops.systemHealthLabel', { label: healthStyle.label })}
              </Text>
            </View>
          </View>
          <Text
            style={[styles.healthCardDescription, { color: healthStyle.text }]}
          >
            {healthStyle.description}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>{t('admin.ops.quickAccessSupervisionTitle')}</Text>
        <View style={styles.quickActionsGrid}>
          <Pressable style={styles.quickActionCard} onPress={handleOpenOrders}>
            <Ionicons name="receipt-outline" size={20} color="#245EA8" />
            <Text style={styles.quickActionTitle}>{t('admin.common.ordersTitle')}</Text>
            <Text style={styles.quickActionText}>{t('admin.ops.ordersQuickText')}</Text>
          </Pressable>

          <Pressable style={styles.quickActionCard} onPress={handleOpenDrivers}>
            <Ionicons name="bicycle-outline" size={20} color="#084424" />
            <Text style={styles.quickActionTitle}>{t('admin.common.driversTitle')}</Text>
            <Text style={styles.quickActionText}>{t('admin.ops.driversQuickText')}</Text>
          </Pressable>

          <Pressable style={styles.quickActionCard} onPress={handleOpenUsers}>
            <Ionicons name="people-outline" size={20} color="#7C3AED" />
            <Text style={styles.quickActionTitle}>{t('admin.common.usersTitle')}</Text>
            <Text style={styles.quickActionText}>{t('admin.ops.usersQuickText')}</Text>
          </Pressable>

          <Pressable
            style={styles.quickActionCard}
            onPress={handleOpenRestaurants}
          >
            <Ionicons name="storefront-outline" size={20} color="#C8331A" />
            <Text style={styles.quickActionTitle}>{t('admin.common.restaurantsTitle')}</Text>
            <Text style={styles.quickActionText}>{t('admin.ops.restaurantsQuickText')}</Text>
          </Pressable>

          <Pressable
            style={[styles.quickActionCard, styles.quickActionCardWide]}
            onPress={handleOpenAuditLogs}
          >
            <Ionicons name="document-text-outline" size={20} color="#B83232" />
            <Text style={styles.quickActionTitle}>{t('admin.dashboard.navAuditTitle')}</Text>
            <Text style={styles.quickActionText}>
              {t('admin.ops.auditQuickText')}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>{t('admin.ops.platformPopulationTitle')}</Text>
        <View style={styles.grid}>
          {populationStats.map((item) => (
            <StatCard
              key={item.key}
              label={item.label}
              value={item.value}
              iconName={item.iconName}
              tint={item.tint}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('admin.ops.accountRiskTitle')}</Text>
        <View style={styles.grid}>
          {riskStats.map((item) => (
            <StatCard
              key={item.key}
              label={item.label}
              value={item.value}
              iconName={item.iconName}
              tint={item.tint}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('admin.ops.orderFlowTitle')}</Text>
        <View style={styles.grid}>
          {orderFlowStats.map((item) => (
            <StatCard
              key={item.key}
              label={item.label}
              value={item.value}
              iconName={item.iconName}
              tint={item.tint}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('admin.dashboard.opsHighlightsTitle')}</Text>
        <View style={styles.highlightGrid}>
          {highlights.map((item) => (
            <HighlightCard
              key={item.key}
              label={item.label}
              value={item.value}
              iconName={item.iconName}
              tint={item.tint}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('admin.dashboard.alertsSectionTitle')}</Text>

        {healthFlags.length > 0 ? (
          <View style={styles.flagList}>
            {healthFlags.map((flag, index) => {
              const flagStyle = getFlagStyle(flag?.level, t);

              return (
                <View
                  key={`${flag?.code || 'flag'}-${index}`}
                  style={[
                    styles.flagCard,
                    {
                      backgroundColor: flagStyle.bg,
                      borderColor: flagStyle.border,
                    },
                  ]}
                >
                  <View style={styles.flagHeader}>
                    <View style={styles.flagTitleWrap}>
                      <Ionicons
                        name={flagStyle.icon}
                        size={17}
                        color={flagStyle.text}
                      />
                      <Text style={[styles.flagLevel, { color: flagStyle.text }]}>
                        {flagStyle.label}
                      </Text>
                    </View>

                    <Text style={[styles.flagValue, { color: flagStyle.text }]}>
                      {normalizeNumber(flag?.value)}
                    </Text>
                  </View>

                  <Text style={[styles.flagMessage, { color: flagStyle.text }]}>
                    {normalizeText(
                      flag?.message,
                      t('admin.ops.flagMessageFallback')
                    )}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.cleanStateCard}>
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color="#084424"
            />
            <Text style={styles.cleanStateText}>
              {t('admin.dashboard.noSignalText')}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('admin.ops.exploitationAlertsTitle')}</Text>

        <View style={styles.alertCard}>
          <View style={styles.alertRow}>
            <MaterialCommunityIcons
              name="account-question-outline"
              size={20}
              color="#8A6500"
            />
            <Text style={styles.alertText}>
              {t('admin.ops.unassignedOrdersAlertLabel', { count: normalizeNumber(orders.unassignedOrders) })}
            </Text>
          </View>

          <View style={styles.alertRow}>
            <Ionicons name="card-outline" size={20} color="#B83232" />
            <Text style={styles.alertText}>
              {t('admin.ops.unpaidOrdersAlertLabel', { count: normalizeNumber(orders.unpaidOrders) })}
            </Text>
          </View>

          <View style={styles.alertRow}>
            <Ionicons
              name="document-text-outline"
              size={20}
              color="#245EA8"
            />
            <Text style={styles.alertText}>
              {t('admin.ops.auditLogs24hAlertLabel', { count: normalizeNumber(audit.recentAuditLogs24h || audit.recentAuditLogs) })}
            </Text>
          </View>

          <View style={[styles.alertRow, styles.alertRowLast]}>
            <Ionicons name="close-circle-outline" size={20} color="#B83232" />
            <Text style={styles.alertText}>
              {t('admin.ops.cancelledOrders7dAlertLabel', { count: normalizeNumber(orders.cancelledOrders7d) })}
            </Text>
          </View>
        </View>

        {!!errorMessage && (
          <View style={styles.softErrorCard}>
            <Ionicons name="warning-outline" size={18} color="#B83232" />
            <Text style={styles.softErrorText}>{errorMessage}</Text>
          </View>
        )}
      </ScrollView>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EC' },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 60 },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBF6EC',
  },
  loaderText: {
    marginTop: 12,
    color: '#777777',
    fontSize: 15,
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
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  topButtonDisabled: {
    opacity: 0.7,
  },

  header: {
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    color: '#084424',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 8,
  },
  subtitle: {
    color: '#6B655E',
    fontSize: 14,
    lineHeight: 21,
  },

  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  heroLeft: {
    flex: 1,
    paddingRight: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 8,
  },
  heroText: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  heroSubText: {
    color: '#7A7268',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },

  healthBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  healthBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
  },

  liveOpsCard: {
    backgroundColor: '#EEF4FF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  liveOpsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveOpsTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveOpsTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '900',
    color: '#245EA8',
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
  liveOpsText: {
    color: '#4F5F88',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  liveOpsSubText: {
    color: '#245EA8',
    fontSize: 12,
    fontWeight: '800',
  },

  metricStripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  metricStripTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 14,
  },
  metricStripGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  metricStripItem: {
    width: '48%',
    marginHorizontal: '1%',
    backgroundColor: '#FAF7F2',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  metricStripValue: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  metricStripLabel: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },

  healthCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 18,
  },
  healthCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthCardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthCardTitle: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '900',
  },
  healthCardDescription: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 12,
    marginTop: 4,
  },

  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 18,
  },
  quickActionCard: {
    width: '48%',
    marginHorizontal: '1%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  quickActionCardWide: {
    width: '98%',
  },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D1C11',
    marginTop: 10,
    marginBottom: 4,
  },
  quickActionText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 18,
  },
  statCard: {
    width: '48%',
    marginHorizontal: '1%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  statCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '700',
    lineHeight: 18,
  },

  highlightGrid: {
    marginBottom: 18,
  },
  highlightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  highlightIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  highlightTextBlock: {
    flex: 1,
  },
  highlightValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 2,
  },
  highlightLabel: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },

  flagList: {
    marginBottom: 18,
  },
  flagCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  flagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flagTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  flagLevel: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  flagValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  flagMessage: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },

  cleanStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  cleanStateText: {
    marginLeft: 10,
    color: '#084424',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
    flex: 1,
  },

  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  alertRowLast: {
    marginBottom: 0,
  },
  alertText: {
    marginLeft: 10,
    color: '#333333',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    flex: 1,
  },

  softErrorCard: {
    marginTop: 14,
    backgroundColor: '#FDECEC',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  softErrorText: {
    marginLeft: 8,
    color: '#B83232',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
    flex: 1,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    textAlign: 'center',
    color: '#0D1C11',
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

  retryButton: {
    marginTop: 18,
    backgroundColor: '#084424',
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonPressed: {
    opacity: 0.9,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
});