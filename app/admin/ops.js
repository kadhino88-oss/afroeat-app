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

const getHealthStyle = (status) => {
  const normalized = normalizeStatus(status);

  if (normalized === 'healthy') {
    return {
      bg: '#E8F5ED',
      text: '#1F6F43',
      border: '#CFE8D8',
      label: 'Healthy',
      icon: 'checkmark-circle',
      description:
        'La plateforme reste stable et exploitable sans friction majeure.',
    };
  }

  if (normalized === 'warning') {
    return {
      bg: '#FFF3D8',
      text: '#8A6500',
      border: '#F4D89B',
      label: 'Warning',
      icon: 'warning',
      description:
        'Des signaux faibles demandent une surveillance renforcée.',
    };
  }

  if (normalized === 'critical') {
    return {
      bg: '#FDECEC',
      text: '#B83232',
      border: '#F3C7C7',
      label: 'Critical',
      icon: 'alert-circle',
      description:
        'Des signaux critiques nécessitent une intervention rapide.',
    };
  }

  return {
    bg: '#F4F4F4',
    text: '#555555',
    border: '#E5E5E5',
    label: 'Unknown',
    icon: 'help-circle-outline',
    description: 'État système non déterminé.',
  };
};

const getFlagStyle = (level) => {
  const normalized = normalizeStatus(level);

  if (normalized === 'critical') {
    return {
      bg: '#FDECEC',
      text: '#B83232',
      border: '#F3C7C7',
      icon: 'alert-circle',
      label: 'Critique',
    };
  }

  if (normalized === 'warning') {
    return {
      bg: '#FFF3D8',
      text: '#8A6500',
      border: '#F4D89B',
      icon: 'warning',
      label: 'Alerte',
    };
  }

  return {
    bg: '#EEF2FF',
    text: '#334155',
    border: '#D9E0F2',
    icon: 'information-circle',
    label: 'Info',
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

const StatCard = ({ label, value, iconName, tint = '#1F6F43' }) => (
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
  tint = '#1F6F43',
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
              { color: item.tint || '#111111' },
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
          error?.message || 'Impossible de charger les indicateurs ops.';

        setErrorMessage(message);

        if (!silent) {
          setOps(null);
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
    [hasValidSession, currentRole, token]
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
    return getHealthStyle(system?.healthStatus);
  }, [system]);

  const healthFlags = useMemo(() => {
    return Array.isArray(system?.flags) ? system.flags : [];
  }, [system]);

  const populationStats = useMemo(
    () => [
      {
        key: 'total-users',
        label: 'Utilisateurs',
        value: entities.totalUsers,
        iconName: 'people-outline',
        tint: '#1F6F43',
      },
      {
        key: 'total-restaurants',
        label: 'Restaurants',
        value: entities.totalRestaurants,
        iconName: 'storefront-outline',
        tint: '#D96C2D',
      },
      {
        key: 'total-drivers',
        label: 'Livreurs',
        value: entities.totalDrivers,
        iconName: 'bicycle-outline',
        tint: '#7C3AED',
      },
      {
        key: 'active-users',
        label: 'Actifs',
        value: entities.activeUsers,
        iconName: 'checkmark-done-outline',
        tint: '#15803D',
      },
    ],
    [entities]
  );

  const riskStats = useMemo(
    () => [
      {
        key: 'pending-users',
        label: 'En attente',
        value: entities.pendingUsers,
        iconName: 'time-outline',
        tint: '#8A6500',
      },
      {
        key: 'suspended-users',
        label: 'Suspendus',
        value: entities.suspendedUsers,
        iconName: 'ban-outline',
        tint: '#B83232',
      },
      {
        key: 'active-restaurants',
        label: 'Restos actifs',
        value: entities.activeRestaurantsOwners,
        iconName: 'restaurant-outline',
        tint: '#245EA8',
      },
      {
        key: 'active-drivers',
        label: 'Livreurs actifs',
        value: entities.activeDriversAccounts,
        iconName: 'navigate-outline',
        tint: '#1F6F43',
      },
    ],
    [entities]
  );

  const orderFlowStats = useMemo(
    () => [
      {
        key: 'total-orders',
        label: 'Total commandes',
        value: orders.totalOrders,
        iconName: 'receipt-outline',
        tint: '#1F6F43',
      },
      {
        key: 'pending-orders',
        label: 'En attente',
        value: orders.pendingOrders,
        iconName: 'hourglass-outline',
        tint: '#D96C2D',
      },
      {
        key: 'preparing-orders',
        label: 'Préparation',
        value: orders.preparingOrders,
        iconName: 'restaurant-outline',
        tint: '#8A6500',
      },
      {
        key: 'delivering-orders',
        label: 'Livraison',
        value: orders.deliveringOrders,
        iconName: 'bicycle-outline',
        tint: '#245EA8',
      },
      {
        key: 'delivered-orders',
        label: 'Livrées',
        value: orders.deliveredOrders,
        iconName: 'checkmark-circle-outline',
        tint: '#1F6F43',
      },
      {
        key: 'cancelled-orders',
        label: 'Annulées',
        value: orders.cancelledOrders,
        iconName: 'close-circle-outline',
        tint: '#B83232',
      },
    ],
    [orders]
  );

  const highlights = useMemo(
    () => [
      {
        key: 'new-users-7d',
        label: 'Nouveaux comptes (7j)',
        value: entities.newUsers7d,
        iconName: 'person-add-outline',
        tint: '#1F6F43',
      },
      {
        key: 'new-restaurants-7d',
        label: 'Nouveaux restaurants (7j)',
        value: entities.newRestaurants7d,
        iconName: 'add-circle-outline',
        tint: '#D96C2D',
      },
      {
        key: 'new-orders-24h',
        label: 'Nouvelles commandes (24h)',
        value: orders.newOrders24h,
        iconName: 'time-outline',
        tint: '#245EA8',
      },
      {
        key: 'audit-logs-24h',
        label: 'Logs admin (24h)',
        value: audit.recentAuditLogs24h || audit.recentAuditLogs,
        iconName: 'document-text-outline',
        tint: '#7C3AED',
      },
    ],
    [entities, orders, audit]
  );

  const liveOverviewMetrics = useMemo(
    () => [
      {
        key: 'unassigned',
        label: 'Sans livreur',
        value: orders.unassignedOrders,
        tint: '#B83232',
      },
      {
        key: 'unpaid',
        label: 'Non payées',
        value: orders.unpaidOrders,
        tint: '#8A6500',
      },
      {
        key: 'delivering',
        label: 'Courses live',
        value: orders.deliveringOrders,
        tint: '#245EA8',
      },
      {
        key: 'audit24h',
        label: 'Audit 24h',
        value: audit.recentAuditLogs24h || audit.recentAuditLogs,
        tint: '#7C3AED',
      },
    ],
    [orders, audit]
  );

  const liveRefreshLabel = useMemo(() => {
    if (!lastLiveRefresh) {
      return 'En attente du premier refresh live';
    }

    return `Dernier refresh live : ${formatDateTime(lastLiveRefresh)}`;
  }, [lastLiveRefresh]);

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
        <Text style={styles.loaderText}>Chargement des indicateurs ops...</Text>
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
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={56} color="#D8B28A" />
          <Text style={styles.emptyTitle}>Ops indisponible</Text>
          <Text style={styles.emptyText}>
            {errorMessage ||
              'Impossible de charger les indicateurs d’exploitation.'}
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
                <Text style={styles.retryButtonText}>Réessayer</Text>
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

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
            <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
          </Pressable>

          <Pressable
            style={[styles.topButton, refreshing && styles.topButtonDisabled]}
            onPress={() => fetchOps(true, false)}
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
          <Text style={styles.title}>Ops / Health</Text>
          <Text style={styles.subtitle}>
            Supervise la plateforme, détecte les signaux faibles et pilote
            l’exploitation en mode premium.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>État global système</Text>
            <Text style={styles.heroText}>
              Dernière génération : {formatDateTime(system.generatedAt)}
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
              <Text style={styles.liveOpsTitle}>Live Ops Monitor</Text>
            </View>

            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>

          <Text style={styles.liveOpsText}>
            Ce panneau est la base du monitoring temps réel AFROEAT : flux
            commandes, supervision livreurs, paiements sensibles et audit
            d’exploitation.
          </Text>

          <Text style={styles.liveOpsSubText}>{liveRefreshLabel}</Text>
        </View>

        <MetricStripCard
          title="Résumé exploitation immédiat"
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
                Santé plateforme : {healthStyle.label}
              </Text>
            </View>
          </View>
          <Text
            style={[styles.healthCardDescription, { color: healthStyle.text }]}
          >
            {healthStyle.description}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Accès rapide supervision</Text>
        <View style={styles.quickActionsGrid}>
          <Pressable style={styles.quickActionCard} onPress={handleOpenOrders}>
            <Ionicons name="receipt-outline" size={20} color="#245EA8" />
            <Text style={styles.quickActionTitle}>Commandes</Text>
            <Text style={styles.quickActionText}>Voir le flux commandes</Text>
          </Pressable>

          <Pressable style={styles.quickActionCard} onPress={handleOpenDrivers}>
            <Ionicons name="bicycle-outline" size={20} color="#1F6F43" />
            <Text style={styles.quickActionTitle}>Livreurs</Text>
            <Text style={styles.quickActionText}>Piloter la flotte</Text>
          </Pressable>

          <Pressable style={styles.quickActionCard} onPress={handleOpenUsers}>
            <Ionicons name="people-outline" size={20} color="#7C3AED" />
            <Text style={styles.quickActionTitle}>Utilisateurs</Text>
            <Text style={styles.quickActionText}>Contrôle comptes</Text>
          </Pressable>

          <Pressable
            style={styles.quickActionCard}
            onPress={handleOpenRestaurants}
          >
            <Ionicons name="storefront-outline" size={20} color="#D96C2D" />
            <Text style={styles.quickActionTitle}>Restaurants</Text>
            <Text style={styles.quickActionText}>Suivi partenaires</Text>
          </Pressable>

          <Pressable
            style={[styles.quickActionCard, styles.quickActionCardWide]}
            onPress={handleOpenAuditLogs}
          >
            <Ionicons name="document-text-outline" size={20} color="#B83232" />
            <Text style={styles.quickActionTitle}>Audit logs</Text>
            <Text style={styles.quickActionText}>
              Contrôle des actions sensibles et traçabilité admin
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Population plateforme</Text>
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

        <Text style={styles.sectionTitle}>Risque comptes</Text>
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

        <Text style={styles.sectionTitle}>Flux commandes</Text>
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

        <Text style={styles.sectionTitle}>Highlights ops</Text>
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

        <Text style={styles.sectionTitle}>Alertes de supervision</Text>

        {healthFlags.length > 0 ? (
          <View style={styles.flagList}>
            {healthFlags.map((flag, index) => {
              const flagStyle = getFlagStyle(flag?.level);

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
                      'Signal de supervision détecté.'
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
              color="#1F6F43"
            />
            <Text style={styles.cleanStateText}>
              Aucun signal critique remonté pour le moment.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Alertes exploitation</Text>

        <View style={styles.alertCard}>
          <View style={styles.alertRow}>
            <MaterialCommunityIcons
              name="account-question-outline"
              size={20}
              color="#8A6500"
            />
            <Text style={styles.alertText}>
              Commandes sans livreur :{' '}
              {normalizeNumber(orders.unassignedOrders)}
            </Text>
          </View>

          <View style={styles.alertRow}>
            <Ionicons name="card-outline" size={20} color="#B83232" />
            <Text style={styles.alertText}>
              Commandes non payées : {normalizeNumber(orders.unpaidOrders)}
            </Text>
          </View>

          <View style={styles.alertRow}>
            <Ionicons
              name="document-text-outline"
              size={20}
              color="#245EA8"
            />
            <Text style={styles.alertText}>
              Audit logs dernières 24h :{' '}
              {normalizeNumber(
                audit.recentAuditLogs24h || audit.recentAuditLogs
              )}
            </Text>
          </View>

          <View style={[styles.alertRow, styles.alertRowLast]}>
            <Ionicons name="close-circle-outline" size={20} color="#B83232" />
            <Text style={styles.alertText}>
              Commandes annulées sur 7 jours :{' '}
              {normalizeNumber(orders.cancelledOrders7d)}
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
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 60 },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
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
    color: '#111111',
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
    color: '#111111',
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
    color: '#111111',
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
    color: '#111111',
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
    color: '#111111',
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
    color: '#111111',
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
    color: '#1F6F43',
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

  retryButton: {
    marginTop: 18,
    backgroundColor: '#1F6F43',
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