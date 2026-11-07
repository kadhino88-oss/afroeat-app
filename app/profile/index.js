import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import FadeInView from '../../components/FadeInView';
import AccountPrivacyLink from '../../components/AccountPrivacyLink';
import { useAuth } from '../../context/AuthContext';
import i18n from '../../i18n';

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
  const normalized = String(value ?? 'client').trim().toLowerCase();

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
    normalized === 'superadmin'
  ) {
    return 'admin';
  }

  return 'client';
};

const getRoleRedirect = (role) => {
  const normalizedRole = normalizeRole(role);

  switch (normalizedRole) {
    case 'admin':
      return '/admin';
    case 'restaurant':
      return '/restaurant/RestaurantDashboard';
    case 'livreur':
      return '/livraison';
    case 'client':
    default:
      return null;
  }
};

const getDisplayName = (user) => {
  return (
    normalizeText(user?.name) ||
    normalizeText(user?.fullName) ||
    normalizeText(
      `${normalizeText(user?.firstName)} ${normalizeText(user?.lastName)}`
    ) ||
    normalizeText(user?.firstName) ||
    normalizeText(user?.prenom) ||
    i18n.t('profile.home.defaultClientName')
  );
};

/**
 * =========================================================
 * SMALL COMPONENTS
 * =========================================================
 */

const FeatureCard = ({ icon, title, text }) => (
  <View style={styles.featureCard}>
    <View style={styles.featureIconWrap}>
      <MaterialCommunityIcons name={icon} size={22} color="#1F6F43" />
    </View>
    <Text style={styles.featureTitle}>{title}</Text>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const QuickCard = ({ icon, title, text, onPress }) => (
  <Pressable
    style={({ pressed }) => [styles.quickCard, pressed && styles.buttonPressed]}
    onPress={onPress}
  >
    <Ionicons name={icon} size={22} color="#1F6F43" />
    <View style={styles.quickCardTextBlock}>
      <Text style={styles.quickCardTitle}>{title}</Text>
      <Text style={styles.quickCardText}>{text}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color="#777777" />
  </Pressable>
);

/**
 * =========================================================
 * SCREEN
 * =========================================================
 * /profile/index
 * Hub privé du compte client connecté
 */

export default function ProfileHomeScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};

  const isAuthenticated = Boolean(auth.isAuthenticated);
  const user = auth.user ?? null;
  const token = auth.token;
  const loading = Boolean(auth.loading);
  const currentRole = normalizeRole(auth.role || user?.role);

  const isLoggedIn = Boolean(isAuthenticated || token || user?._id);
  const displayName = useMemo(() => getDisplayName(user), [user]);

  const handleBackToProfileTab = useCallback(() => {
    router.replace('/(tabs)/profile');
  }, []);

  const handleOpenRestaurants = useCallback(() => {
    router.push('/(tabs)/explore');
  }, []);

  const handleOpenOrders = useCallback(() => {
    router.push('/(tabs)/orders');
  }, []);

  const handleOpenProfileInfo = useCallback(() => {
    router.push('/profile/info');
  }, []);

  const handleOpenAddress = useCallback(() => {
    router.push('/profile/address');
  }, []);

  const handleOpenPayment = useCallback(() => {
    router.push('/profile/payment');
  }, []);

  const handleOpenHelp = useCallback(() => {
    router.push('/profile/help');
  }, []);

  /**
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#D4A017" />
        <Text style={styles.loaderText}>{t('profile.home.loaderText')}</Text>
      </View>
    );
  }

  /**
   * =========================================================
   * AUTH / ROLE GATE
   * =========================================================
   */

  if (!isLoggedIn) {
    return <Redirect href="/auth/role" />;
  }

  const roleRedirect = getRoleRedirect(currentRole);

  if (roleRedirect) {
    return <Redirect href={roleRedirect} />;
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.topRow}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleBackToProfileTab}
          >
            <Ionicons name="arrow-back" size={22} color="#111111" />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>AFROEAT</Text>
            </View>

            <View style={styles.connectedBadge}>
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color="#1F6F43"
              />
              <Text style={styles.connectedBadgeText}>{t('profile.home.sessionActive')}</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{t('profile.home.welcome', { name: displayName })}</Text>

          <Text style={styles.heroSubtitle}>{t('profile.home.heroSubtitle')}</Text>

          <View style={styles.heroActions}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleOpenRestaurants}
            >
              <Ionicons name="restaurant-outline" size={18} color="#111111" />
              <Text style={styles.primaryButtonText}>{t('profile.home.exploreButton')}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleOpenOrders}
            >
              <Ionicons
                name="receipt-outline"
                size={18}
                color="#1E1E1E"
              />
              <Text style={styles.secondaryButtonText}>{t('profile.home.myOrdersButton')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.home.whyTitle')}</Text>

          <View style={styles.featuresGrid}>
            <FeatureCard
              icon="silverware-fork-knife"
              title={t('profile.home.feature1Title')}
              text={t('profile.home.feature1Text')}
            />
            <FeatureCard
              icon="shield-check-outline"
              title={t('profile.home.feature2Title')}
              text={t('profile.home.feature2Text')}
            />
            <FeatureCard
              icon="truck-delivery-outline"
              title={t('profile.home.feature3Title')}
              text={t('profile.home.feature3Text')}
            />
            <FeatureCard
              icon="earth"
              title={t('profile.home.feature4Title')}
              text={t('profile.home.feature4Text')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.home.quickAccessTitle')}</Text>

          <View style={styles.quickList}>
            <QuickCard
              icon="storefront-outline"
              title={t('profile.home.quickRestaurantsTitle')}
              text={t('profile.home.quickRestaurantsText')}
              onPress={handleOpenRestaurants}
            />

            <QuickCard
              icon="receipt-outline"
              title={t('profile.home.quickOrdersTitle')}
              text={t('profile.home.quickOrdersText')}
              onPress={handleOpenOrders}
            />

            <QuickCard
              icon="person-circle-outline"
              title={t('profile.home.quickInfoTitle')}
              text={t('profile.home.quickInfoText')}
              onPress={handleOpenProfileInfo}
            />

            <QuickCard
              icon="location-outline"
              title={t('profile.home.quickAddressTitle')}
              text={t('profile.home.quickAddressText')}
              onPress={handleOpenAddress}
            />

            <QuickCard
              icon="card-outline"
              title={t('profile.home.quickPaymentTitle')}
              text={t('profile.home.quickPaymentText')}
              onPress={handleOpenPayment}
            />

            <QuickCard
              icon="help-circle-outline"
              title={t('profile.home.quickHelpTitle')}
              text={t('profile.home.quickHelpText')}
              onPress={handleOpenHelp}
            />
            <AccountPrivacyLink />
          </View>
        </View>

        <View style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>{t('profile.home.ctaTitle')}</Text>
          <Text style={styles.ctaText}>{t('profile.home.ctaText')}</Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButtonFull,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleOpenOrders}
          >
            <Ionicons name="arrow-forward-outline" size={18} color="#111111" />
            <Text style={styles.primaryButtonText}>{t('profile.home.ctaButton')}</Text>
          </Pressable>
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
    backgroundColor: '#FFF8F0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  loaderText: {
    marginTop: 12,
    color: '#555555',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },

  topRow: {
    marginBottom: 14,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },

  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 20,
    marginBottom: 18,
    elevation: 2,
  },

  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    alignItems: 'center',
  },

  brandBadge: {
    backgroundColor: '#FFF3D8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  brandBadgeText: {
    color: '#8A6500',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5ED',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },

  connectedBadgeText: {
    marginLeft: 6,
    color: '#1F6F43',
    fontSize: 12,
    fontWeight: '800',
  },

  heroTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#111111',
    lineHeight: 36,
    marginBottom: 10,
  },

  heroSubtitle: {
    color: '#6B655E',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },

  heroActions: {
    flexDirection: 'row',
  },

  primaryButton: {
    flex: 1,
    minHeight: 50,
    backgroundColor: '#D4A017',
    borderRadius: 16,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginRight: 8,
  },

  primaryButtonFull: {
    minHeight: 50,
    backgroundColor: '#D4A017',
    borderRadius: 16,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },

  primaryButtonText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
  },

  secondaryButton: {
    flex: 1,
    minHeight: 50,
    backgroundColor: '#F4EEE6',
    borderRadius: 16,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },

  secondaryButtonText: {
    color: '#1E1E1E',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
  },

  section: {
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 12,
  },

  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },

  featureCard: {
    width: '48%',
    marginHorizontal: '1%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
  },

  featureIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F5FBF7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  featureTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 6,
  },

  featureText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
  },

  quickList: {},

  quickCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },

  quickCardTextBlock: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },

  quickCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 4,
  },

  quickCardText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
  },

  ctaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    elevation: 2,
  },

  ctaTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 8,
  },

  ctaText: {
    color: '#6B655E',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },

  buttonPressed: {
    opacity: 0.84,
  },
});
