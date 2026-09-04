import React from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, Image } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../context/AuthContext';

/**
 * =========================================================
 * ASSETS
 * =========================================================
 */

const LOGO_IMAGE = require('../../assets/images/icon.png');

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeRole = (role) => {
  const normalized = normalizeText(role, 'client').toLowerCase();

  if (normalized === 'restaurant' || normalized === 'resto') {
    return 'restaurant';
  }

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
    normalized === 'superadmin' ||
    normalized === 'super-admin' ||
    normalized === 'ops'
  ) {
    return 'admin';
  }

  return 'client';
};

const isClientRole = (role) => {
  return normalizeRole(role) === 'client';
};

const normalizeAccountStatus = (status, role) => {
  const normalizedStatus = normalizeText(status).toLowerCase();
  const normalizedRole = normalizeRole(role);

  if (
    normalizedStatus === 'approved' ||
    normalizedStatus === 'validated' ||
    normalizedStatus === 'enabled'
  ) {
    return normalizedRole === 'client' ? 'active' : 'approved';
  }

  if (normalizedStatus === 'active' || normalizedStatus === 'completed') {
    return normalizedRole === 'client' ? 'active' : 'approved';
  }

  if (
    normalizedStatus === 'pending' ||
    normalizedStatus === 'pending_approval' ||
    normalizedStatus === 'pending_verification' ||
    normalizedStatus === 'submitted' ||
    normalizedStatus === 'under_review' ||
    normalizedStatus === 'in_review' ||
    normalizedStatus === 'draft'
  ) {
    return 'pending';
  }

  if (
    normalizedStatus === 'blocked' ||
    normalizedStatus === 'suspended' ||
    normalizedStatus === 'disabled' ||
    normalizedStatus === 'banned'
  ) {
    return 'blocked';
  }

  if (
    normalizedStatus === 'rejected' ||
    normalizedStatus === 'refused' ||
    normalizedStatus === 'denied'
  ) {
    return 'rejected';
  }

  return normalizedRole === 'client' ? 'active' : 'pending';
};

const getRoleRedirect = (role, accountStatus) => {
  const normalizedRole = normalizeRole(role);
  const normalizedStatus = normalizeAccountStatus(accountStatus, normalizedRole);

  if (normalizedRole === 'restaurant') {
    return normalizedStatus === 'approved'
      ? '/restaurant/RestaurantDashboard'
      : '/auth/pending-approval';
  }

  if (normalizedRole === 'livreur') {
    return normalizedStatus === 'approved'
      ? '/livraison'
      : '/auth/pending-approval';
  }

  if (normalizedRole === 'admin') {
    return '/admin';
  }

  return null;
};

const TabBarLogo = () => {
  return (
    <View style={styles.logoWrap}>
      <Image source={LOGO_IMAGE} style={styles.logoImage} />
    </View>
  );
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 * Tabs strictement réservés :
 * - au client connecté
 * - ou au visiteur non connecté
 *
 * Tous les autres rôles sont redirigés hors du bloc client.
 */

export default function TabsLayout() {
  const { user, loading, isAuthenticated, role, accountStatus } = useAuth();
  const { t } = useTranslation();

  /**
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#D4A017" />
      </View>
    );
  }

  const safeRole = normalizeRole(role || user?.role);
  const safeAccountStatus = normalizeAccountStatus(
    accountStatus || user?.accountStatus || user?.status,
    safeRole
  );

  /**
   * =========================================================
   * REDIRECTION RÔLES NON CLIENTS
   * =========================================================
   */

  if (isAuthenticated) {
    const redirectPath = getRoleRedirect(safeRole, safeAccountStatus);

    if (redirectPath) {
      return <Redirect href={redirectPath} />;
    }

    if (!isClientRole(safeRole)) {
      return <Redirect href="/auth/role" />;
    }
  }

  /**
   * =========================================================
   * TABS CLIENT / VISITEUR
   * =========================================================
   */

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#D4A017',
        tabBarInactiveTintColor: '#8C8C8C',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        sceneStyle: styles.scene,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size}
              color={color}
            />
          ),
          headerTitle: () => <TabBarLogo />,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: t('nav.explore'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={size}
              color={color}
            />
          ),
          headerTitle: () => <TabBarLogo />,
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: t('nav.orders'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'receipt' : 'receipt-outline'}
              size={size}
              color={color}
            />
          ),
          headerTitle: () => <TabBarLogo />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color}
            />
          ),
          headerTitle: () => <TabBarLogo />,
        }}
      />
    </Tabs>
  );
}

/**
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  scene: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },

  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    height: Platform.OS === 'ios' ? 84 : 70,
    paddingBottom: Platform.OS === 'ios' ? 18 : 10,
    paddingTop: 8,
    elevation: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: -2,
    },
  },

  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
  },

  logoWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1E1A6',
    overflow: 'hidden',
  },

  logoImage: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
});