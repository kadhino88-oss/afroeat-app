import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
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

const normalizeRole = (value) => {
  const role = normalizeText(value, 'client').toLowerCase();

  if (
    role === 'restaurant' ||
    role === 'resto' ||
    role === 'partner_restaurant'
  ) {
    return 'restaurant';
  }

  if (
    role === 'livreur' ||
    role === 'driver' ||
    role === 'delivery' ||
    role === 'courier'
  ) {
    return 'livreur';
  }

  if (
    role === 'admin' ||
    role === 'administrator' ||
    role === 'superadmin' ||
    role === 'super-admin' ||
    role === 'ops'
  ) {
    return 'admin';
  }

  return 'client';
};

const normalizeAccountStatus = (value, role = 'client') => {
  const status = normalizeText(value).toLowerCase();
  const safeRole = normalizeRole(role);

  if (
    status === 'approved' ||
    status === 'active' ||
    status === 'validated' ||
    status === 'enabled' ||
    status === 'completed'
  ) {
    return safeRole === 'client' ? 'active' : 'approved';
  }

  if (
    status === 'pending' ||
    status === 'pending_approval' ||
    status === 'pending-verification' ||
    status === 'pending_verification' ||
    status === 'under_review' ||
    status === 'in_review' ||
    status === 'review' ||
    status === 'submitted' ||
    status === 'draft'
  ) {
    return 'pending';
  }

  if (
    status === 'rejected' ||
    status === 'refused' ||
    status === 'denied'
  ) {
    return 'rejected';
  }

  if (
    status === 'blocked' ||
    status === 'suspended' ||
    status === 'disabled' ||
    status === 'banned'
  ) {
    return 'blocked';
  }

  return safeRole === 'client' ? 'active' : 'pending';
};

const getRedirectRoute = (user, roleFromAuth, homeRoute) => {
  const safeRole = normalizeRole(roleFromAuth || user?.role);
  const safeStatus = normalizeAccountStatus(user?.accountStatus, safeRole);

  if (safeRole === 'restaurant') {
    return safeStatus === 'approved'
      ? '/restaurant/RestaurantDashboard'
      : '/auth/pending-approval';
  }

  if (safeRole === 'livreur') {
    return safeStatus === 'approved'
      ? '/livraison'
      : '/auth/pending-approval';
  }

  if (safeRole === 'admin') {
    return '/admin';
  }

  return homeRoute || '/(tabs)';
};

/**
 * =========================================================
 * ROOT ENTRY — AFROEAT
 * =========================================================
 */

export default function IndexEntry() {
  const { t } = useTranslation();
  const auth = useAuth() || {};

  const loading = Boolean(auth.loading);
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const user = auth.user ?? null;
  const role = auth.role;
  const homeRoute = auth.homeRoute;

  const redirectHref = useMemo(() => {
    if (!isAuthenticated || !user?._id) {
      return '/auth/role';
    }

    return getRedirectRoute(user, role, homeRoute);
  }, [isAuthenticated, user, role, homeRoute]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

        <View style={styles.loaderCard}>
          <View style={styles.logoWrap}>
            <Image
              source={require('./assets/images/icon.png')}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>

          <Text style={styles.loaderTitle}>AFROEAT</Text>
          <Text style={styles.loaderSubtitle}>
            {t('entry.loadingExperience')}
          </Text>

          <ActivityIndicator
            size="large"
            color="#EAB02F"
            style={styles.loaderSpinner}
          />
        </View>
      </View>
    );
  }

  return <Redirect href={redirectHref} />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#FBF6EC',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  loaderCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },

  logoWrap: {
    width: 82,
    height: 82,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F3E7CA',
    borderWidth: 1,
    borderColor: '#F3E7CA',
    marginBottom: 16,
  },

  logo: {
    width: '100%',
    height: '100%',
  },

  loaderTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0D1C11',
    letterSpacing: 0.4,
    marginBottom: 6,
  },

  loaderSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#606D5D',
    fontWeight: '700',
    textAlign: 'center',
  },

  loaderSpinner: {
    marginTop: 20,
  },
});