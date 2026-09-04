import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StatusBar,
  Alert,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect, Redirect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import {
  getAdminDashboard,
  getAdminOpsOverview,
} from '../../services/adminService';

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
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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
      description: 'La plateforme fonctionne dans une zone stable.',
    };
  }

  if (normalized === 'warning') {
    return {
      bg: '#FFF3D8',
      text: '#8A6500',
      border: '#F4D89B',
      label: 'Warning',
      icon: 'warning',
      description: 'Quelques indicateurs demandent une vigilance renforcée.',
    };
  }

  if (normalized === 'critical') {
    return {
      bg: '#FDECEC',
      text: '#B83232',
      border: '#F3C7C7',
      label: 'Critical',
      icon: 'alert-circle',
      description: 'Des signaux critiques nécessitent une action rapide.',
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

const normalizeDashboardPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return {
      users: {},
      restaurants: {},
      orders: {},
    };
  }

  const data = payload?.data || payload;

  return {
    users: data?.users || {},
    restaurants: data?.restaurants || {},
    orders: data?.orders || {},
  };
};

const normalizeOpsPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return {
      system: {},
      orders: {},
      entities: {},
      audit: {},
    };
  }

  const data = payload?.data || payload;

  return {
    system: data?.system || {},
    orders: data?.orders || {},
    entities: data?.entities || {},
    audit: data?.audit || {},
  };
};

const buildQuickStats = ({ users = {}, restaurants = {}, orders = {}, ops = {} }) => [
  {
    key: 'users-total',
    label: 'Utilisateurs',
    value: normalizeNumber(users.total),
    icon: 'people-outline',
    tint: '#1F6F43',
  },
  {
    key: 'restaurants-total',
    label: 'Restaurants',
    value: normalizeNumber(restaurants.total),
    icon: 'storefront-outline',
    tint: '#8A6500',
  },
  {
    key: 'drivers-total',
    label: 'Livreurs',
    value: normalizeNumber(users.drivers),
    icon: 'bicycle-outline',
    tint: '#7C3AED',
  },
  {
    key: 'orders-total',
    label: 'Commandes',
    value: normalizeNumber(orders.total),
    icon: 'receipt-outline',
    tint: '#B45309',
  },
  {
    key: 'users-active',
    label: 'Comptes actifs',
    value: normalizeNumber(users.active),
    icon: 'checkmark-done-outline',
    tint: '#15803D',
  },
  {
    key: 'orders-unassigned',
    label: 'Sans livreur',
    value: normalizeNumber(ops?.orders?.unassignedOrders),
    icon: 'alert-circle-outline',
    tint: '#B83232',
  },
];

const buildUserStats = (users = {}) => [
  { key: 'users-active', label: 'Actifs', value: normalizeNumber(users.active) },
  { key: 'users-pending', label: 'En attente', value: normalizeNumber(users.pending) },
  { key: 'users-suspended', label: 'Suspendus', value: normalizeNumber(users.suspended) },
  { key: 'users-admins', label: 'Admins', value: normalizeNumber(users.admins) },
  { key: 'users-clients', label: 'Clients', value: normalizeNumber(users.clients) },
  { key: 'users-restaurants', label: 'Comptes resto', value: normalizeNumber(users.restaurants) },
];

const buildOrderStats = (orders = {}, ops = {}) => [
  { key: 'orders-pending', label: 'En attente', value: normalizeNumber(orders.pending) },
  { key: 'orders-delivering', label: 'En livraison', value: normalizeNumber(orders.delivering) },
  { key: 'orders-delivered', label: 'Livrées', value: normalizeNumber(orders.delivered) },
  { key: 'orders-cancelled', label: 'Annulées', value: normalizeNumber(orders.cancelled) },
  { key: 'orders-unassigned', label: 'Sans livreur', value: normalizeNumber(ops?.orders?.unassignedOrders) },
  { key: 'orders-unpaid', label: 'Impayées', value: normalizeNumber(ops?.orders?.unpaidOrders) },
];

const buildOpsHighlights = (ops = {}) => [
  {
    key: 'ops-new-users',
    label: 'Nouveaux comptes (7j)',
    value: normalizeNumber(ops?.entities?.newUsers7d),
    icon: 'person-add-outline',
  },
  {
    key: 'ops-new-restaurants',
    label: 'Nouveaux restaurants (7j)',
    value: normalizeNumber(ops?.entities?.newRestaurants7d),
    icon: 'add-circle-outline',
  },
  {
    key: 'ops-new-orders-24h',
    label: 'Nouvelles commandes (24h)',
    value: normalizeNumber(ops?.orders?.newOrders24h),
    icon: 'time-outline',
  },
  {
    key: 'ops-audit-24h',
    label: 'Logs admin (24h)',
    value: normalizeNumber(ops?.audit?.recentAuditLogs24h),
    icon: 'document-text-outline',
  },
];

const navigationItems = [
  {
    key: 'hub',
    title: 'Hub admin',
    text: 'Entrée centrale du bloc admin.',
    icon: <Ionicons name="grid-outline" size={22} color="#1F6F43" />,
    route: '/admin',
  },
  {
    key: 'users',
    title: 'Utilisateurs',
    text: 'Voir, filtrer et gérer tous les comptes.',
    icon: <Ionicons name="people-outline" size={22} color="#1F6F43" />,
    route: '/admin/users',
  },
  {
    key: 'restaurants',
    title: 'Restaurants',
    text: 'Superviser les partenaires restaurants.',
    icon: <Ionicons name="storefront-outline" size={22} color="#1F6F43" />,
    route: '/admin/restaurants',
  },
  {
    key: 'drivers',
    title: 'Livreurs',
    text: 'Contrôler l’activité et les statuts livreurs.',
    icon: <Ionicons name="bicycle-outline" size={22} color="#1F6F43" />,
    route: '/admin/drivers',
  },
  {
    key: 'orders',
    title: 'Commandes',
    text: 'Voir le flux complet des commandes.',
    icon: <Ionicons name="receipt-outline" size={22} color="#1F6F43" />,
    route: '/admin/orders',
  },
  {
    key: 'audit-logs',
    title: 'Audit Logs',
    text: 'Tracer les actions sensibles de l’administration.',
    icon: <Ionicons name="document-text-outline" size={22} color="#1F6F43" />,
    route: '/admin/audit-logs',
  },
  {
    key: 'live-ops',
    title: 'Live Ops / Health',
    text: 'Surveiller l’état opérationnel de la plateforme.',
    icon: (
      <MaterialCommunityIcons
        name="chart-timeline-variant"
        size={22}
        color="#1F6F43"
      />
    ),
    route: '/admin/live-ops',
  },
  {
    key: 'analytics',
    title: 'Analytics',
    text: 'Lire la performance business et les signaux de croissance.',
    icon: <Ionicons name="stats-chart-outline" size={22} color="#1F6F43" />,
    route: '/admin/analytics',
  },
];

/**
 * =========================================================
 * UI COMPONENTS
 * =========================================================
 */

const StatCard = ({ label, value, iconName, tint }) => (
  <View style={styles.statCard}>
    <View style={styles.statCardTop}>
      <View
        style={[
          styles.statIconWrap,
          { backgroundColor: `${tint || '#1F6F43'}14` },
        ]}
      >
        <Ionicons name={iconName} size={18} color={tint || '#1F6F43'} />
      </View>
    </View>
    <Text style={styles.statValue}>{normalizeNumber(value)}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const CompactStatCard = ({ label, value }) => (
  <View style={styles.compactStatCard}>
    <Text style={styles.compactStatValue}>{normalizeNumber(value)}</Text>
    <Text style={styles.compactStatLabel}>{label}</Text>
  </View>
);

const HighlightCard = ({ label, value, iconName }) => (
  <View style={styles.highlightCard}>
    <View style={styles.highlightIconWrap}>
      <Ionicons name={iconName} size={18} color="#1F6F43" />
    </View>
    <View style={styles.highlightTextBlock}>
      <Text style={styles.highlightValue}>{normalizeNumber(value)}</Text>
      <Text style={styles.highlightLabel}>{label}</Text>
    </View>
  </View>
);

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function AdminDashboardScreen() {
  const auth = useAuth() || {};

  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const role = auth.role;
  const user = auth.user ?? null;
  const authLoading = Boolean(auth.loading);

  const [dashboard, setDashboard] = useState(null);
  const [ops, setOps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role);
  }, [role, user]);

  const currentStatus = useMemo(() => {
    return getAccountStatus(user, auth);
  }, [user, auth]);

  const hasValidSession = Boolean(isAuthenticated && token);

  const fetchDashboard = useCallback(
    async (manual = false) => {
      if (!hasValidSession || !isAdminRole(currentRole)) {
        setDashboard(null);
        setOps(null);
        setErrorMessage('');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        setErrorMessage('');

        if (manual) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const [dashboardData, opsData] = await Promise.all([
          getAdminDashboard(token),
          getAdminOpsOverview(token),
        ]);

        setDashboard(normalizeDashboardPayload(dashboardData));
        setOps(normalizeOpsPayload(opsData));
      } catch (error) {
        console.log('Erreur dashboard admin :', error);

        const message =
          error?.message || 'Impossible de charger le dashboard admin.';

        setErrorMessage(message);
        setDashboard(null);
        setOps(null);

        if (manual) {
          Alert.alert('Erreur', message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [hasValidSession, token, currentRole]
  );

  useFocusEffect(
    useCallback(() => {
      fetchDashboard(false);
    }, [fetchDashboard])
  );

  const users = dashboard?.users || {};
  const restaurants = dashboard?.restaurants || {};
  const orders = dashboard?.orders || {};
  const system = ops?.system || {};

  const healthStyle = useMemo(
    () => getHealthStyle(system?.healthStatus),
    [system]
  );

  const quickStats = useMemo(
    () => buildQuickStats({ users, restaurants, orders, ops }),
    [users, restaurants, orders, ops]
  );

  const userStats = useMemo(() => buildUserStats(users), [users]);
  const orderStats = useMemo(() => buildOrderStats(orders, ops), [orders, ops]);
  const opsHighlights = useMemo(() => buildOpsHighlights(ops), [ops]);
  const healthFlags = Array.isArray(system?.flags) ? system.flags : [];

  /**
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (authLoading || loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#1F6F43" />
        <Text style={styles.loaderText}>Chargement du centre admin...</Text>
      </View>
    );
  }

  /**
   * =========================================================
   * AUTH GUARDS
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

  if (!dashboard || !ops) {
    return (
      <FadeInView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={56} color="#D8B28A" />
          <Text style={styles.emptyTitle}>Dashboard indisponible</Text>
          <Text style={styles.emptyText}>
            {errorMessage || 'Impossible de charger les données du centre admin.'}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={() => fetchDashboard(true)}
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
            onRefresh={() => fetchDashboard(true)}
          />
        }
      >
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <View style={styles.adminPill}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color="#1F6F43"
              />
              <Text style={styles.adminPillText}>Zone sécurisée admin</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.topButton,
              pressed && styles.topButtonPressed,
              refreshing && styles.topButtonDisabled,
            ]}
            onPress={() => fetchDashboard(true)}
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
          <Text style={styles.title}>Centre de contrôle</Text>
          <Text style={styles.subtitle}>
            Pilote les utilisateurs, partenaires, livreurs, commandes et l’état
            global de la plateforme.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>Vue d’ensemble opérationnelle</Text>
            <Text style={styles.heroText}>
              Un espace central pour surveiller AFROEAT, contrôler les comptes,
              anticiper les incidents et sécuriser l’exploitation.
            </Text>

            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaItem}>
                <Ionicons name="time-outline" size={15} color="#7A7268" />
                <Text style={styles.heroMetaText}>
                  Généré le {formatDateTime(system?.generatedAt)}
                </Text>
              </View>
            </View>
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
            <Ionicons name={healthStyle.icon} size={16} color={healthStyle.text} />
            <Text style={[styles.healthBadgeText, { color: healthStyle.text }]}>
              {healthStyle.label}
            </Text>
          </View>
        </View>

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
              <Ionicons name={healthStyle.icon} size={18} color={healthStyle.text} />
              <Text style={[styles.healthCardTitle, { color: healthStyle.text }]}>
                État système : {healthStyle.label}
              </Text>
            </View>
          </View>
          <Text style={[styles.healthCardDescription, { color: healthStyle.text }]}>
            {healthStyle.description}
          </Text>
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
                    {normalizeText(flag?.message, 'Signal opérationnel détecté.')}
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

        <Text style={styles.sectionTitle}>Indicateurs plateforme</Text>
        <View style={styles.grid}>
          {quickStats.map((item) => (
            <StatCard
              key={item.key}
              label={item.label}
              value={item.value}
              iconName={item.icon}
              tint={item.tint}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Utilisateurs</Text>
        <View style={styles.compactGrid}>
          {userStats.map((item) => (
            <CompactStatCard
              key={item.key}
              label={item.label}
              value={item.value}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Commandes</Text>
        <View style={styles.compactGrid}>
          {orderStats.map((item) => (
            <CompactStatCard
              key={item.key}
              label={item.label}
              value={item.value}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Highlights ops</Text>
        <View style={styles.highlightGrid}>
          {opsHighlights.map((item) => (
            <HighlightCard
              key={item.key}
              label={item.label}
              value={item.value}
              iconName={item.icon}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Navigation admin</Text>
        <View style={styles.navList}>
          {navigationItems.map((item) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.navCard,
                pressed && styles.navCardPressed,
              ]}
              onPress={() => router.push(item.route)}
            >
              {item.icon}
              <View style={styles.navCardTextBlock}>
                <Text style={styles.navCardTitle}>{item.title}</Text>
                <Text style={styles.navCardText}>{item.text}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#777777" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </FadeInView>
  );
}

/**
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 60,
  },

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
    alignItems: 'center',
    marginBottom: 18,
  },

  topLeft: {
    flex: 1,
    paddingRight: 12,
  },

  adminPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5ED',
    borderWidth: 1,
    borderColor: '#CFE8D8',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },

  adminPillText: {
    marginLeft: 6,
    color: '#1F6F43',
    fontSize: 12,
    fontWeight: '800',
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

  topButtonPressed: {
    opacity: 0.85,
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
    marginBottom: 12,
  },

  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  heroMetaText: {
    marginLeft: 6,
    color: '#7A7268',
    fontSize: 12,
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

  compactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 18,
  },

  compactStatCard: {
    width: '31.33%',
    marginHorizontal: '1%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    marginBottom: 10,
    elevation: 2,
    minHeight: 92,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },

  compactStatValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 6,
  },

  compactStatLabel: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '700',
    lineHeight: 17,
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
    backgroundColor: '#E8F5ED',
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

  navList: {
    marginBottom: 20,
  },

  navCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },

  navCardPressed: {
    opacity: 0.88,
  },

  navCardTextBlock: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },

  navCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 4,
  },

  navCardText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
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