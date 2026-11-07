import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const LANGUAGE_FLAGS = {
  fr: '🇫🇷',
  en: '🇬🇧',
  de: '🇩🇪',
  es: '🇪🇸',
  it: '🇮🇹',
  zh: '🇨🇳',
};

/**
 * =========================================================
 * ASSETS LOCAUX
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

const normalizeRole = (value) => {
  const normalized = normalizeText(value, 'client').toLowerCase();

  if (
    normalized === 'restaurant' ||
    normalized === 'resto' ||
    normalized === 'partner_restaurant'
  ) {
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

const normalizeStatus = (value) => {
  return normalizeText(value).toLowerCase();
};

const getDisplayName = (user) => {
  const fullName = `${normalizeText(user?.firstName)} ${normalizeText(
    user?.lastName
  )}`.trim();

  return (
    normalizeText(user?.name) ||
    normalizeText(user?.fullName) ||
    normalizeText(fullName) ||
    normalizeText(user?.prenom) ||
    i18n.t('profile.menu.accountSectionTitle')
  );
};

const getDisplayEmail = (user) => {
  return normalizeText(user?.email);
};

const getDisplayPhone = (user) => {
  return normalizeText(user?.phone);
};

const getDisplayAddress = (user) => {
  return normalizeText(
    user?.address ||
      user?.adresse ||
      user?.deliveryAddress ||
      user?.profile?.address
  );
};

const getRoleRedirect = (role) => {
  const normalized = normalizeRole(role);

  if (normalized === 'restaurant') {
    return '/restaurant/RestaurantDashboard';
  }

  if (normalized === 'livreur') {
    return '/livraison';
  }

  if (normalized === 'admin') {
    return '/admin';
  }

  return null;
};

const getAvatarUri = (user) => {
  return normalizeText(
    user?.avatar || user?.photo || user?.profileImage || user?.image
  );
};

const getInitials = (user) => {
  const name = getDisplayName(user);

  if (!name) return 'A';

  const parts = name
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return 'A';

  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
};

const getAccountStatus = (user, auth) => {
  return normalizeStatus(
    user?.status ||
      user?.approvalStatus ||
      user?.accountStatus ||
      user?.clientStatus ||
      auth?.accountStatus ||
      'active'
  );
};

const getAccountStatusStyle = (status, t) => {
  switch (normalizeStatus(status)) {
    case 'active':
    case 'approved':
      return {
        label: t('profile.menu.statusActiveLabel'),
        bg: '#E8F5ED',
        text: '#1F6F43',
        icon: 'checkmark-circle-outline',
      };

    case 'pending':
    case 'pending_verification':
    case 'pending-approval':
    case 'pending_approval':
      return {
        label: t('order.status.pending'),
        bg: '#FFF3D8',
        text: '#8A6500',
        icon: 'time-outline',
      };

    case 'suspended':
    case 'blocked':
    case 'disabled':
      return {
        label: t('admin.users.statusSuspendedLabel'),
        bg: '#FDECEC',
        text: '#B83232',
        icon: 'ban-outline',
      };

    default:
      return {
        label: t('profile.menu.statusClientDefaultLabel'),
        bg: '#F3ECE4',
        text: '#555555',
        icon: 'person-outline',
      };
  }
};

/**
 * =========================================================
 * COMPOSANTS UI
 * =========================================================
 */

const QuickActionCard = ({ icon, label, onPress }) => (
  <Pressable
    style={({ pressed }) => [styles.quickCard, pressed && styles.buttonPressed]}
    onPress={onPress}
  >
    <View style={styles.quickIconWrap}>
      <Ionicons name={icon} size={24} color="#D4A017" />
    </View>
    <Text style={styles.quickText}>{label}</Text>
  </Pressable>
);

const MenuRow = ({ icon, label, subtitle, onPress, danger = false }) => (
  <Pressable
    style={({ pressed }) => [styles.menuItem, pressed && styles.buttonPressed]}
    onPress={onPress}
  >
    <View style={styles.menuLeft}>
      <View
        style={[
          styles.menuIconWrap,
          danger && styles.menuIconWrapDanger,
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={danger ? '#B63B3B' : '#1F6F43'}
        />
      </View>

      <View style={styles.menuTextWrap}>
        <Text style={[styles.menuText, danger && styles.menuTextDanger]}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={styles.menuSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>

    <Ionicons
      name="chevron-forward-outline"
      size={18}
      color={danger ? '#B63B3B' : '#AAAAAA'}
    />
  </Pressable>
);

/**
 * =========================================================
 * COMPOSANT PRINCIPAL
 * =========================================================
 */

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { language, setLanguage, supportedLanguages } = useLanguage();
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const auth = useAuth() || {};

  const user = auth.user ?? null;
  const loading = Boolean(auth.loading);
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const logout = auth.logout;
  const currentRole = normalizeRole(auth.role || user?.role);

  const displayName = useMemo(() => getDisplayName(user), [user]);
  const displayEmail = useMemo(() => getDisplayEmail(user), [user]);
  const displayPhone = useMemo(() => getDisplayPhone(user), [user]);
  const displayAddress = useMemo(() => getDisplayAddress(user), [user]);
  const avatarUri = useMemo(() => getAvatarUri(user), [user]);
  const initials = useMemo(() => getInitials(user), [user]);
  const accountStatus = useMemo(() => getAccountStatus(user, auth), [user, auth]);
  const statusStyle = useMemo(
    () => getAccountStatusStyle(accountStatus, t),
    [accountStatus, t]
  );

  const roleRedirect = useMemo(() => getRoleRedirect(currentRole), [currentRole]);

  const handleLogout = useCallback(async () => {
    try {
      if (typeof logout === 'function') {
        await logout();
      }
    } catch (error) {
      console.log('Erreur logout profile :', error);
    } finally {
      router.replace('/auth/role');
    }
  }, [logout]);

  const handleGoLogin = useCallback(() => {
    router.push({
      pathname: '/auth/login',
      params: { role: 'client' },
    });
  }, []);

  const handleGoRegister = useCallback(() => {
    router.push('/auth/register-client');
  }, []);

  /**
   * =========================================================
   * STATES
   * =========================================================
   */

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAFAF7" />
        <ActivityIndicator size="large" color="#D4A017" />
      </View>
    );
  }

  if (isAuthenticated && roleRedirect) {
    return <Redirect href={roleRedirect} />;
  }

  if (!isAuthenticated) {
    return (
      <FadeInView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAFAF7" />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
          </View>

          <View style={styles.guestCard}>
            <View style={styles.guestIconWrap}>
              <Ionicons name="person-circle-outline" size={68} color="#111111" />
            </View>

            <Text style={styles.guestTitle}>{t('profile.menu.guestTitle')}</Text>
            <Text style={styles.guestText}>
              {t('profile.menu.guestText')}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.primaryGuestButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleGoLogin}
            >
              <Text style={styles.primaryGuestButtonText}>{t('auth.login.submit')}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryGuestButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleGoRegister}
            >
              <Text style={styles.secondaryGuestButtonText}>{t('auth.login.createAccount')}</Text>
            </Pressable>
          </View>
        </ScrollView>
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
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAF7" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
          </View>

          <Text style={styles.profileName}>{displayName}</Text>

          {!!displayEmail && (
            <Text style={styles.profileEmail}>{displayEmail}</Text>
          )}

          <View
            style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}
          >
            <Ionicons name={statusStyle.icon} size={14} color={statusStyle.text} />
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {statusStyle.label}
            </Text>
          </View>
        </View>

        <View style={styles.quickActions}>
          <QuickActionCard
            icon="receipt-outline"
            label={t('orders.title')}
            onPress={() => router.push('/(tabs)/orders')}
          />
          <QuickActionCard
            icon="heart-outline"
            label={t('nav.favorites')}
            onPress={() => router.push('/favorites')}
          />
          <QuickActionCard
            icon="location-outline"
            label={t('profile.home.quickAddressTitle')}
            onPress={() => router.push('/profile/address')}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>{t('profile.menu.accountSectionTitle')}</Text>

          <MenuRow
            icon="person-outline"
            label={t('profile.menu.personalInfoLabel')}
            subtitle={displayEmail || undefined}
            onPress={() => router.push('/profile/info')}
          />

          {!!displayPhone && (
            <MenuRow
              icon="call-outline"
              label={t('restaurant.profile.phoneLabel')}
              subtitle={displayPhone}
              onPress={() => router.push('/profile/info')}
            />
          )}

          {!!displayAddress && (
            <MenuRow
              icon="location-outline"
              label={t('restaurant.profile.addressLabel')}
              subtitle={displayAddress}
              onPress={() => router.push('/profile/address')}
            />
          )}

          <MenuRow
            icon="card-outline"
            label={t('profile.home.quickPaymentTitle')}
            subtitle={t('profile.menu.paymentSubtitle')}
            onPress={() => router.push('/profile/payment')}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>{t('profile.menu.preferencesSectionTitle')}</Text>

          <MenuRow
            icon="language-outline"
            label={t('profile.language')}
            subtitle={t(`languages.${language}`)}
            onPress={() => setLanguageModalVisible(true)}
          />

          <MenuRow
            icon="help-circle-outline"
            label={t('profile.help.topTitle')}
            subtitle={t('profile.menu.helpSubtitle')}
            onPress={() => router.push('/profile/help')}
          />
        </View>

        <View style={styles.menuSection}>
          <MenuRow
            icon="log-out-outline"
            label={t('profile.menu.logoutLabel')}
            onPress={handleLogout}
            danger
          />
        </View>
      </ScrollView>

      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <Pressable
          style={styles.languageModalOverlay}
          onPress={() => setLanguageModalVisible(false)}
        >
          <Pressable style={styles.languageModalCard} onPress={() => {}}>
            <Text style={styles.languageModalTitle}>{t('profile.language')}</Text>
            <Text style={styles.languageModalSubtitle}>
              {t('profile.languageSubtitle')}
            </Text>

            {supportedLanguages.map((code) => {
              const isActive = language === code;
              return (
                <Pressable
                  key={code}
                  style={[
                    styles.languageOption,
                    isActive && styles.languageOptionActive,
                  ]}
                  onPress={() => {
                    setLanguage(code);
                    setLanguageModalVisible(false);
                  }}
                >
                  <Text style={styles.languageOptionText}>
                    {LANGUAGE_FLAGS[code]}  {t(`languages.${code}`)}
                  </Text>
                  {isActive ? (
                    <Ionicons name="checkmark" size={18} color="#1F6F43" />
                  ) : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
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
    backgroundColor: '#FAFAF7',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAF7',
  },

  scrollContent: {
    paddingBottom: 40,
  },

  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },

  logo: {
    width: 80,
    height: 40,
  },

  guestCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  guestIconWrap: {
    marginBottom: 12,
  },

  guestTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 10,
    textAlign: 'center',
  },

  guestText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 22,
  },

  primaryGuestButton: {
    width: '100%',
    backgroundColor: '#D4A017',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
  },

  primaryGuestButtonText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '800',
  },

  secondaryGuestButton: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6E6E6',
  },

  secondaryGuestButtonText: {
    color: '#444444',
    fontSize: 14,
    fontWeight: '700',
  },

  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  avatarContainer: {
    marginBottom: 12,
  },

  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },

  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D4A017',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarInitials: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },

  profileEmail: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 12,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },

  statusText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },

  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 20,
  },

  quickCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginHorizontal: 5,
  },

  quickIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF8E7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  quickText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
  },

  menuSection: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#AAAAAA',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F2',
  },

  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8F5ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  menuIconWrapDanger: {
    backgroundColor: '#FDECEC',
  },

  menuTextWrap: {
    flex: 1,
  },

  menuText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
  },

  menuTextDanger: {
    color: '#B63B3B',
  },

  menuSubtitle: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },

  buttonPressed: {
    opacity: 0.7,
  },

  languageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  languageModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
  },

  languageModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  languageModalSubtitle: {
    fontSize: 13,
    color: '#8A8A8A',
    marginTop: 4,
    marginBottom: 14,
  },

  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },

  languageOptionActive: {
    backgroundColor: '#F1F7F3',
  },

  languageOptionText: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
  },
});
