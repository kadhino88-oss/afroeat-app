import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeRole = (value) => normalizeText(value, 'client').toLowerCase();

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

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function AdminIndexScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};

  const user = auth.user ?? null;
  const role = auth.role;
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const loading = Boolean(auth.loading);

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role);
  }, [role, user]);

  const currentStatus = useMemo(() => {
    return getAccountStatus(user, auth);
  }, [user, auth]);

  const hasValidSession = Boolean(isAuthenticated && token);

  const adminName = useMemo(() => {
    return normalizeText(user?.name, t('admin.index.adminFallbackName'));
  }, [user, t]);

  const adminSections = useMemo(() => ([
    {
      key: 'dashboard',
      title: t('admin.common.dashboardTitle'),
      subtitle: t('admin.index.dashboardSubtitle'),
      iconType: 'ionicons',
      iconName: 'grid-outline',
      accent: '#5A32A3',
      soft: '#F1EAFE',
      route: '/admin/AdminDashboard',
    },
    {
      key: 'ops',
      title: t('admin.common.opsTitle'),
      subtitle: t('admin.index.opsSubtitle'),
      iconType: 'ionicons',
      iconName: 'pulse-outline',
      accent: '#D96C2D',
      soft: '#FFF0E8',
      route: '/admin/ops',
    },
    {
      key: 'users',
      title: t('admin.common.usersTitle'),
      subtitle: t('admin.index.usersSubtitle'),
      iconType: 'ionicons',
      iconName: 'people-outline',
      accent: '#1F6F43',
      soft: '#E8F5ED',
      route: '/admin/users',
    },
    {
      key: 'restaurants',
      title: t('admin.common.restaurantsTitle'),
      subtitle: t('admin.index.restaurantsSubtitle'),
      iconType: 'material',
      iconName: 'storefront-outline',
      accent: '#D4A017',
      soft: '#FFF3D8',
      route: '/admin/restaurants',
    },
    {
      key: 'drivers',
      title: t('admin.common.driversTitle'),
      subtitle: t('admin.index.driversSubtitle'),
      iconType: 'ionicons',
      iconName: 'bicycle-outline',
      accent: '#246BFD',
      soft: '#EAF1FF',
      route: '/admin/drivers',
    },
    {
      key: 'orders',
      title: t('admin.common.ordersTitle'),
      subtitle: t('admin.index.ordersSubtitle'),
      iconType: 'ionicons',
      iconName: 'receipt-outline',
      accent: '#111111',
      soft: '#F2F2F2',
      route: '/admin/orders',
    },
    {
      key: 'audit',
      title: t('admin.common.auditTitle'),
      subtitle: t('admin.index.auditSubtitle'),
      iconType: 'ionicons',
      iconName: 'shield-checkmark-outline',
      accent: '#8A2D3B',
      soft: '#FCECEF',
      route: '/admin/audit-logs',
    },
  ]), [t]);

  const quickActions = useMemo(() => ([
    {
      key: 'dashboard',
      label: t('admin.common.dashboardTitle'),
      icon: 'grid-outline',
      route: '/admin/AdminDashboard',
    },
    {
      key: 'ops',
      label: t('admin.common.opsShort'),
      icon: 'pulse-outline',
      route: '/admin/ops',
    },
    {
      key: 'orders',
      label: t('admin.common.ordersTitle'),
      icon: 'receipt-outline',
      route: '/admin/orders',
    },
    {
      key: 'audit',
      label: t('admin.common.auditShort'),
      icon: 'shield-checkmark-outline',
      route: '/admin/audit-logs',
    },
  ]), [t]);

  const handleNavigate = useCallback((route) => {
    if (!route) return;
    router.push(route);
  }, []);

  const renderAdminIcon = useCallback((item) => {
    if (item.iconType === 'material') {
      return (
        <MaterialCommunityIcons
          name={item.iconName}
          size={24}
          color={item.accent}
        />
      );
    }

    return (
      <Ionicons
        name={item.iconName}
        size={24}
        color={item.accent}
      />
    );
  }, []);

  /**
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7F4FB" />
        <ActivityIndicator size="large" color="#5A32A3" />
        <Text style={styles.loaderText}>{t('admin.index.loaderText')}</Text>
      </View>
    );
  }

  /**
   * =========================================================
   * AUTH GUARDS
   * =========================================================
   */

  if (!hasValidSession || !user) {
    return <Redirect href="/auth/login?role=admin" />;
  }

  if (!isAdminRole(currentRole)) {
    if (currentRole === 'restaurant') {
      return <Redirect href="/restaurant/RestaurantDashboard" />;
    }

    if (isDriverRole(currentRole)) {
      return <Redirect href="/livraison" />;
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

  /**
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <FadeInView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F4FB" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.eyebrow}>{t('admin.index.eyebrow')}</Text>
              <Text style={styles.title}>{t('admin.index.title')}</Text>
              <Text style={styles.subtitle}>
                {t('admin.index.subtitleWelcome', { name: adminName })}
              </Text>
            </View>

            <View style={styles.heroIconWrap}>
              <Ionicons
                name="shield-checkmark-outline"
                size={64}
                color="#5A32A3"
              />
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatText}>{t('admin.index.heroStatUsers')}</Text>
            </View>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatText}>{t('admin.index.heroStatRestaurants')}</Text>
            </View>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatText}>{t('admin.index.heroStatDrivers')}</Text>
            </View>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatText}>{t('admin.index.heroStatOrders')}</Text>
            </View>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatText}>{t('admin.index.heroStatOps')}</Text>
            </View>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatText}>{t('admin.index.heroStatAudit')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.index.quickAccessTitle')}</Text>

          <View style={styles.quickActions}>
            {quickActions.map((item) => (
              <Pressable
                key={item.key}
                style={styles.quickCard}
                onPress={() => handleNavigate(item.route)}
              >
                <Ionicons name={item.icon} size={26} color="#5A32A3" />
                <Text style={styles.quickText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.index.controlSpacesTitle')}</Text>

          {adminSections.map((item) => (
            <Pressable
              key={item.key}
              style={styles.card}
              onPress={() => handleNavigate(item.route)}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: item.soft },
                ]}
              >
                {renderAdminIcon(item)}
              </View>

              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              </View>

              <Ionicons
                name="chevron-forward-outline"
                size={20}
                color="#8A8A8A"
              />
            </Pressable>
          ))}
        </View>

        <View style={styles.bottomPanel}>
          <Text style={styles.bottomTitle}>{t('admin.index.bottomTitle')}</Text>
          <Text style={styles.bottomText}>
            {t('admin.index.bottomText')}
          </Text>
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
  screen: {
    flex: 1,
    backgroundColor: '#F7F4FB',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 36,
  },

  loader: {
    flex: 1,
    backgroundColor: '#F7F4FB',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  loaderText: {
    marginTop: 14,
    color: '#666666',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },

  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  heroTextWrap: {
    flex: 1,
    paddingRight: 14,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    color: '#5A32A3',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#151515',
    marginBottom: 10,
  },

  subtitle: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 22,
  },

  heroIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: '#F3EDFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  heroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 18,
  },

  heroStatPill: {
    backgroundColor: '#F6F2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },

  heroStatText: {
    color: '#5A32A3',
    fontWeight: '800',
    fontSize: 12,
  },

  section: {
    marginBottom: 24,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 14,
  },

  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },

  quickCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  quickText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
    textAlign: 'center',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  cardTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#131313',
    marginBottom: 4,
  },

  cardSubtitle: {
    fontSize: 13,
    color: '#6C6C6C',
    lineHeight: 19,
  },

  bottomPanel: {
    backgroundColor: '#111111',
    borderRadius: 24,
    padding: 18,
    marginTop: 4,
  },

  bottomTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },

  bottomText: {
    color: '#DFDFDF',
    fontSize: 14,
    lineHeight: 22,
  },
});