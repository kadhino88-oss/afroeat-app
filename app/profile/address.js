import React, { useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';

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
  const normalized = String(role ?? 'client').trim().toLowerCase();

  if (normalized === 'restaurant' || normalized === 'resto') return 'restaurant';
  if (
    normalized === 'livreur' ||
    normalized === 'driver' ||
    normalized === 'delivery' ||
    normalized === 'courier'
  )
    return 'livreur';
  if (
    normalized === 'admin' ||
    normalized === 'administrator' ||
    normalized === 'superadmin'
  )
    return 'admin';

  return 'client';
};

const getRoleRedirect = (role) => {
  const r = normalizeRole(role);

  if (r === 'restaurant') return '/restaurant/RestaurantDashboard';
  if (r === 'livreur') return '/livraison';
  if (r === 'admin') return '/admin';

  return null;
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function ProfileAddressScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const user = auth.user ?? null;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const loading = Boolean(auth.loading);
  const role = normalizeRole(auth.role || user?.role);
  const roleRedirect = getRoleRedirect(role);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) return router.back();
    router.replace('/(tabs)/profile');
  }, []);

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5EFE8" />
        <ActivityIndicator size="large" color="#D4A017" />
        <Text style={styles.loaderText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login?role=client" />;
  }

  if (roleRedirect) return <Redirect href={roleRedirect} />;

  const address =
    normalizeText(
      user?.address ||
        user?.adresse ||
        user?.deliveryAddress ||
        user?.profile?.address
    ) || t('profile.address.noAddress');

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5EFE8" />

      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>{t('profile.address.title')}</Text>
          <Text style={styles.subtitle}>{t('profile.address.subtitle')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="location-outline" size={22} color="#111" />
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.label}>{t('profile.address.primaryAddressLabel')}</Text>
            <Text style={styles.value}>{address}</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color="#777" />
          <Text style={styles.infoText}>{t('profile.address.infoText')}</Text>
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
    backgroundColor: '#F5EFE8',
    paddingTop: 24,
    paddingHorizontal: 16,
  },

  loader: {
    flex: 1,
    backgroundColor: '#F5EFE8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loaderText: {
    marginTop: 12,
    color: '#666',
  },

  topRow: {
    marginBottom: 18,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    paddingBottom: 80,
  },

  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },

  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111',
    marginBottom: 8,
  },

  subtitle: {
    color: '#666',
    fontSize: 14,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F7F1E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  cardContent: {
    flex: 1,
  },

  label: {
    fontSize: 13,
    color: '#777',
    marginBottom: 4,
    fontWeight: '700',
  },

  value: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  infoText: {
    fontSize: 13,
    color: '#777',
    flex: 1,
  },
});
