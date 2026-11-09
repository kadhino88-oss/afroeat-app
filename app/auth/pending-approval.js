import React, { useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  ScrollView,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import FadeInView from '../../components/FadeInView';
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

const getRoleConfig = (role) => {
  switch (role) {
    case 'restaurant':
      return {
        title: 'Dossier restaurant en attente',
        subtitle:
          'Ton dossier partenaire a bien été reçu. Il doit être vérifié avant l’activation complète de ton espace restaurant.',
        accent: '#084424',
        soft: '#E3F0E8',
        icon: 'storefront-outline',
        loginRole: 'restaurant',
        primaryLabel: 'Retour à la connexion restaurant',
      };

    case 'livreur':
      return {
        title: 'Dossier livreur en attente',
        subtitle:
          'Ton dossier livreur a bien été reçu. La vérification d’identité et des éléments d’adhésion doit être validée avant activation.',
        accent: '#C8331A',
        soft: '#F3E7CA',
        icon: 'bicycle-outline',
        loginRole: 'livreur',
        primaryLabel: 'Retour à la connexion livreur',
      };

    case 'admin':
      return {
        title: 'Accès administrateur contrôlé',
        subtitle:
          'Ton espace administrateur nécessite une validation et un accès sécurisé avant ouverture complète.',
        accent: '#084424',
        soft: '#F2ECE0',
        icon: 'shield-checkmark-outline',
        loginRole: 'admin',
        primaryLabel: 'Retour à la connexion admin',
      };

    default:
      return {
        title: 'Compte en attente',
        subtitle: 'Ton compte est en attente de traitement.',
        accent: '#EAB02F',
        soft: '#F3E7CA',
        icon: 'time-outline',
        loginRole: 'client',
        primaryLabel: 'Retour à la connexion',
      };
  }
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function PendingApprovalScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const auth = useAuth() || {};

  const user = auth.user ?? null;
  const authRole = auth.role;
  const accountStatus = auth.accountStatus;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const logout = auth.logout;
  const clearAllLocalAppData = auth.clearAllLocalAppData;
  const setSelectedRole = auth.setSelectedRole;

  const rawRole = Array.isArray(params?.role) ? params.role[0] : params?.role;

  const safeRole = useMemo(() => {
    return normalizeRole(rawRole || authRole || user?.role);
  }, [rawRole, authRole, user]);

  const safeStatus = useMemo(() => {
    return normalizeAccountStatus(
      accountStatus ||
        user?.accountStatus ||
        user?.status ||
        user?.approvalStatus,
      safeRole
    );
  }, [accountStatus, user, safeRole]);

  const config = useMemo(() => getRoleConfig(safeRole), [safeRole]);

  useEffect(() => {
    if (!isAuthenticated || !user?._id) {
      return;
    }

    if (safeRole === 'restaurant') {
      if (safeStatus === 'approved') {
        router.replace('/restaurant/RestaurantDashboard');
      }
      return;
    }

    if (safeRole === 'livreur') {
      if (safeStatus === 'approved') {
        router.replace('/livraison');
      }
      return;
    }

    if (safeRole === 'admin') {
      if (safeStatus === 'approved' || safeStatus === 'active') {
        router.replace('/admin');
      }
      return;
    }

    if (safeRole === 'client') {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, user, safeRole, safeStatus]);

  const handleBackToLogin = useCallback(async () => {
    try {
      if (typeof logout === 'function') {
        await logout();
      }

      if (typeof setSelectedRole === 'function') {
        await setSelectedRole(config.loginRole);
      }
    } catch (error) {
      console.log('Erreur handleBackToLogin:', error);
    } finally {
      router.replace({
        pathname: '/auth/login',
        params: { role: config.loginRole },
      });
    }
  }, [logout, setSelectedRole, config.loginRole]);

  const handleChangeSpace = useCallback(async () => {
    try {
      if (typeof logout === 'function') {
        await logout();
      }

      if (typeof setSelectedRole === 'function') {
        await setSelectedRole('client');
      }
    } catch (error) {
      console.log('Erreur handleChangeSpace:', error);
    } finally {
      router.replace('/auth/role');
    }
  }, [logout, setSelectedRole]);

  const handleResetEverything = useCallback(async () => {
    try {
      if (typeof clearAllLocalAppData === 'function') {
        await clearAllLocalAppData();
      } else if (typeof logout === 'function') {
        await logout();
      }
    } catch (error) {
      console.log('Erreur handleResetEverything:', error);
    } finally {
      router.replace('/auth/role');
    }
  }, [clearAllLocalAppData, logout]);

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F2ECE0" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.logoHeader}>
          <View style={styles.logoWrap}>
            <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="cover" />
          </View>
          <Text style={styles.brand}>AFROEAT</Text>
        </View>

        <View style={styles.header}>
          <View style={[styles.iconWrapper, { backgroundColor: config.soft }]}>
            <Ionicons name={config.icon} size={34} color={config.accent} />
          </View>

          <Text style={styles.eyebrow}>{t('auth.pendingApproval.eyebrow')}</Text>
          <Text style={styles.title}>{t(`auth.pendingApproval.roles.${safeRole}.title`, config.title)}</Text>
          <Text style={styles.subtitle}>{t(`auth.pendingApproval.roles.${safeRole}.subtitle`, config.subtitle)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('auth.pendingApproval.stepsTitle')}</Text>

          <View style={styles.stepRow}>
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color="#084424"
            />
            <Text style={styles.stepText}>{t('auth.pendingApproval.step1')}</Text>
          </View>

          <View style={styles.stepRow}>
            <Ionicons name="time-outline" size={18} color="#EAB02F" />
            <Text style={styles.stepText}>{t('auth.pendingApproval.step2')}</Text>
          </View>

          <View style={styles.stepRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color="#606D5D"
            />
            <Text style={styles.stepText}>
              {t('auth.pendingApproval.step3')}
            </Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>{t('auth.pendingApproval.infoTitle')}</Text>
          <Text style={styles.infoText}>{t('auth.pendingApproval.infoText1')}</Text>
          <Text style={styles.infoText}>{t('auth.pendingApproval.infoText2')}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: config.accent },
            pressed && styles.buttonPressed,
          ]}
          onPress={handleBackToLogin}
        >
          <Text style={styles.buttonText}>{t(`auth.pendingApproval.roles.${safeRole}.primaryLabel`, config.primaryLabel)}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleChangeSpace}
        >
          <Text style={styles.secondaryButtonText}>{t('auth.pendingApproval.changeSpace')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.resetButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleResetEverything}
        >
          <Ionicons name="refresh-outline" size={18} color="#C8331A" />
          <Text style={styles.resetButtonText}>{t('auth.pendingApproval.resetAccounts')}</Text>
        </Pressable>
      </ScrollView>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2ECE0',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 48,
  },

  logoHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },

  logoWrap: {
    width: 78,
    height: 78,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#F3E7CA',
    borderWidth: 1,
    borderColor: '#F3E7CA',
    marginBottom: 10,
  },

  logo: {
    width: '100%',
    height: '100%',
  },

  brand: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D1C11',
    letterSpacing: 0.3,
  },

  header: {
    alignItems: 'center',
    marginBottom: 24,
  },

  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    color: '#084424',
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  iconWrapper: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 10,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    color: '#606D5D',
    lineHeight: 22,
    textAlign: 'center',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 14,
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  stepText: {
    marginLeft: 10,
    color: '#606D5D',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },

  infoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  infoTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 8,
  },

  infoText: {
    fontSize: 13.5,
    color: '#606D5D',
    lineHeight: 21,
    marginBottom: 6,
  },

  button: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },

  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },

  secondaryButtonText: {
    color: '#606D5D',
    fontWeight: '800',
    fontSize: 14,
  },

  resetButton: {
    backgroundColor: '#F8E1DD',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#F8E1DD',
  },

  resetButtonText: {
    color: '#C8331A',
    fontWeight: '900',
    fontSize: 14,
    marginLeft: 8,
  },

  buttonPressed: {
    opacity: 0.84,
  },
});