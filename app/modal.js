import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../components/FadeInView';
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

  if (role === 'restaurant' || role === 'resto') return 'restaurant';
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
    role === 'superadmin'
  ) {
    return 'admin';
  }

  return 'client';
};

const getRoleRedirect = (currentRole) => {
  if (currentRole === 'restaurant') {
    return '/restaurant/RestaurantDashboard';
  }

  if (currentRole === 'livreur') {
    return '/livraison';
  }

  if (currentRole === 'admin') {
    return '/admin';
  }

  return null;
};

/**
 * =========================================================
 * DATA
 * =========================================================
 */

const NOTIFICATIONS_META = [
  {
    id: '1',
    titleKey: 'modal.demoNotifications.welcomeTitle',
    descriptionKey: 'modal.demoNotifications.welcomeDescription',
    icon: 'sparkles-outline',
    color: '#D4A017',
    bg: '#FFF3D8',
  },
  {
    id: '2',
    titleKey: 'modal.demoNotifications.orderTrackingTitle',
    descriptionKey: 'modal.demoNotifications.orderTrackingDescription',
    icon: 'receipt-outline',
    color: '#1F6F43',
    bg: '#E8F5ED',
  },
  {
    id: '3',
    titleKey: 'modal.demoNotifications.upcomingOffersTitle',
    descriptionKey: 'modal.demoNotifications.upcomingOffersDescription',
    icon: 'gift-outline',
    color: '#D96C2D',
    bg: '#FFF0E8',
  },
];

/**
 * =========================================================
 * SCREEN
 * =========================================================
 * Cet écran appartient au bloc client / visiteur.
 * Les rôles métier séparés ne doivent pas y rester.
 */

export default function ModalScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const user = auth.user ?? null;
  const currentRole = normalizeRole(auth.role || user?.role);

  const roleRedirect = isAuthenticated ? getRoleRedirect(currentRole) : null;

  const safeNotifications = useMemo(
    () =>
      NOTIFICATIONS_META.map((item) => ({
        ...item,
        title: t(item.titleKey),
        description: t(item.descriptionKey),
      })),
    [t]
  );

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/index');
  }, []);

  if (roleRedirect) {
    return <Redirect href={roleRedirect} />;
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{t('notifications.title')}</Text>
          <Text style={styles.subtitle}>{t('modal.subtitle')}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('modal.close')}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleClose}
        >
          <Ionicons name="close" size={22} color="#1E1E1E" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Ionicons name="notifications-outline" size={14} color="#A36A00" />
            <Text style={styles.heroBadgeText}>{t('modal.premiumBadge')}</Text>
          </View>

          <Text style={styles.heroTitle}>{t('modal.heroTitle')}</Text>
          <Text style={styles.heroText}>
            {t('modal.heroText')}
          </Text>
        </View>

        {safeNotifications.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDescription}>{item.description}</Text>
            </View>
          </View>
        ))}
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
    paddingTop: 24,
    paddingHorizontal: 16,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  titleBlock: {
    flex: 1,
    paddingRight: 12,
  },

  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 13,
    color: '#777777',
    fontWeight: '700',
  },

  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  content: {
    paddingBottom: 80,
  },

  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3D8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },

  heroBadgeText: {
    marginLeft: 6,
    color: '#A36A00',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  heroTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 8,
  },

  heroText: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 22,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  cardContent: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 6,
  },

  cardDescription: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 20,
  },

  buttonPressed: {
    opacity: 0.84,
  },
});
