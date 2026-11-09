import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { router, useLocalSearchParams, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { loginUser } from '../../services/authService';
import { useTranslation } from 'react-i18next';

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

const ROLE_CONFIG = {
  client: {
    label: 'Client',
    description:
      'Connecte-toi pour commander, suivre tes commandes et gérer ton compte AFROEAT.',
    color: '#EAB02F',
    soft: '#FFF3D8',
    dark: '#8A6500',
    icon: 'restaurant-outline',
  },
  restaurant: {
    label: 'Restaurant',
    description:
      'Connecte-toi à ton espace partenaire pour gérer ton menu, tes commandes et ton activité.',
    color: '#084424',
    soft: '#E8F5ED',
    dark: '#084424',
    icon: 'storefront-outline',
  },
  livreur: {
    label: 'Livreur',
    description:
      'Connecte-toi à ton espace livraison pour gérer tes missions, ton suivi et ton activité.',
    color: '#C8331A',
    soft: '#FFF0E8',
    dark: '#A6501A',
    icon: 'bicycle-outline',
  },
  admin: {
    label: 'Admin',
    description:
      'Connexion sécurisée à l’espace de supervision et de pilotage AFROEAT.',
    color: '#5A32A3',
    soft: '#F1EAFE',
    dark: '#5A32A3',
    icon: 'shield-checkmark-outline',
  },
};

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

const isValidEmail = (value) => {
  const email = normalizeText(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const getRegisterRouteByRole = (role) => {
  const normalized = normalizeRole(role);

  if (normalized === 'restaurant') {
    return '/auth/register-restaurant';
  }

  if (normalized === 'livreur') {
    return '/auth/register-driver';
  }

  return '/auth/register-client';
};

const getRedirectRouteByUser = (user) => {
  const safeRole = normalizeRole(user?.role);
  const safeStatus = normalizeAccountStatus(
    user?.accountStatus || user?.status || user?.approvalStatus,
    safeRole
  );

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

  return '/(tabs)';
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function LoginScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const auth = useAuth() || {};

  const user = auth.user ?? null;
  const loading = Boolean(auth.loading);
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const login = auth.login;
  const setSelectedRole = auth.setSelectedRole;

  const requestedRole = Array.isArray(params?.role) ? params.role[0] : params?.role;

  const currentRole = useMemo(() => normalizeRole(requestedRole), [requestedRole]);
  const roleConfig = ROLE_CONFIG[currentRole] || ROLE_CONFIG.client;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const redirectHref = useMemo(() => {
    if (!loading && isAuthenticated && user?._id) {
      return getRedirectRouteByUser(user);
    }

    return null;
  }, [loading, isAuthenticated, user]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/auth/role');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    const safeEmail = normalizeText(email).toLowerCase();
    const safePassword = String(password ?? '').trim();

    if (!isValidEmail(safeEmail)) {
      Alert.alert(t('auth.login.invalidEmailTitle'), t('auth.login.invalidEmailBody'));
      return;
    }

    if (!safePassword || safePassword.length < 6) {
      Alert.alert(
        t('auth.login.invalidPasswordTitle'),
        t('auth.login.invalidPasswordBody')
      );
      return;
    }

    try {
      setSubmitting(true);

      if (typeof setSelectedRole === 'function') {
        await setSelectedRole(currentRole);
      }

      const response = await loginUser({
        email: safeEmail,
        password: safePassword,
        role: currentRole,
      });

      const safeUser = response?.user || null;
      const safeToken = response?.token || '';

      if (!safeUser?._id || !safeToken) {
        throw new Error(t('auth.login.invalidLoginResponse'));
      }

      const normalizedLoggedRole = normalizeRole(safeUser?.role);

      if (currentRole !== 'admin' && normalizedLoggedRole !== currentRole) {
        throw new Error(t('auth.login.wrongSpaceError'));
      }

      if (currentRole === 'admin' && normalizedLoggedRole !== 'admin') {
        throw new Error(t('auth.login.adminAccessDenied'));
      }

      if (typeof login !== 'function') {
        throw new Error(t('auth.login.sessionUnavailable'));
      }

      const success = await login(safeUser, safeToken);

      if (!success) {
        throw new Error(t('auth.login.sessionSaveFailed'));
      }

      router.replace(getRedirectRouteByUser(safeUser));
    } catch (error) {
      console.log('Erreur login :', error);

      Alert.alert(
        t('auth.login.failedTitle'),
        error?.message || t('auth.login.serverErrorFallback')
      );
    } finally {
      setSubmitting(false);
    }
  }, [email, password, currentRole, login, setSelectedRole, submitting]);

  const handleGoToRegister = useCallback(async () => {
    try {
      if (typeof setSelectedRole === 'function') {
        await setSelectedRole(currentRole);
      }
    } catch (error) {
      console.log('Erreur handleGoToRegister:', error);
    } finally {
      router.push(getRegisterRouteByRole(currentRole));
    }
  }, [currentRole, setSelectedRole]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <View style={styles.loaderLogoWrap}>
          <Image source={LOGO_IMAGE} style={styles.loaderLogo} resizeMode="cover" />
        </View>
        <ActivityIndicator size="large" color="#EAB02F" />
        <Text style={styles.loaderText}>Chargement...</Text>
      </View>
    );
  }

  if (redirectHref) {
    return <Redirect href={redirectHref} />;
  }

  return (
    <FadeInView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <View style={styles.topRow}>
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleBack}
            >
              <Ionicons name="arrow-back" size={22} color="#0D1C11" />
            </Pressable>
          </View>

          <View style={styles.headerCard}>
            <View style={styles.logoWrap}>
              <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="cover" />
            </View>

            <Text style={styles.eyebrow}>AFROEAT</Text>
            <Text style={styles.title}>{t('auth.login.title')}</Text>
            <Text style={styles.subtitle}>{t(`auth.roles.${currentRole}.description`, roleConfig.description)}</Text>

            <View
              style={[
                styles.roleBadge,
                { backgroundColor: roleConfig.soft },
              ]}
            >
              <Ionicons
                name={roleConfig.icon}
                size={14}
                color={roleConfig.color}
                style={styles.roleBadgeIcon}
              />
              <Text style={[styles.roleBadgeText, { color: roleConfig.color }]}>
                {t(`auth.roles.${currentRole}.label`, roleConfig.label)}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{t('auth.login.emailLabel')}</Text>
            <View style={styles.inputWrap}>
              <Ionicons
                name="mail-outline"
                size={18}
                color="#7A7268"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="nom@email.com"
                placeholderTextColor="#9A948D"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
              />
            </View>

            <Text style={styles.label}>{t('auth.login.passwordLabel')}</Text>
            <View style={styles.inputWrap}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color="#7A7268"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.login.passwordPlaceholder')}
                placeholderTextColor="#9A948D"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
              />

              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                style={({ pressed }) => [styles.eyeButton, pressed && styles.buttonPressed]}
                disabled={submitting}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#777777"
                />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: roleConfig.color },
                submitting && styles.primaryButtonDisabled,
                pressed && !submitting && styles.buttonPressed,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>{t('auth.login.submit')}</Text>
                </>
              )}
            </Pressable>

            {currentRole !== 'admin' && (
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleGoToRegister}
                disabled={submitting}
              >
                <Text style={styles.secondaryButtonText}>{t('auth.login.createAccount')}</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>{t('auth.login.infoTitle')}</Text>
            <Text style={styles.infoText}>
              {t('auth.login.infoText1')}
            </Text>
            <Text style={styles.infoText}>
              {t('auth.login.infoText2')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </FadeInView>
  );
}

/**
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  screen: {
    flex: 1,
    backgroundColor: '#FBF6EC',
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 60,
  },

  loader: {
    flex: 1,
    backgroundColor: '#FBF6EC',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  loaderLogoWrap: {
    width: 84,
    height: 84,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFF6E3',
    borderWidth: 1,
    borderColor: '#F3E2B5',
    marginBottom: 18,
  },

  loaderLogo: {
    width: '100%',
    height: '100%',
  },

  loaderText: {
    marginTop: 12,
    color: '#555555',
    fontSize: 15,
    fontWeight: '600',
  },

  heroGlowOne: {
    position: 'absolute',
    top: 20,
    right: -10,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(212,160,23,0.08)',
  },

  heroGlowTwo: {
    position: 'absolute',
    top: 180,
    left: -20,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(31,111,67,0.06)',
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
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFF6E3',
    borderWidth: 1,
    borderColor: '#F3E2B5',
    marginBottom: 14,
  },

  logo: {
    width: '100%',
    height: '100%',
  },

  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    color: '#084424',
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 8,
    textAlign: 'center',
  },

  subtitle: {
    color: '#6B655E',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
    textAlign: 'center',
  },

  roleBadge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },

  roleBadgeIcon: {
    marginRight: 6,
  },

  roleBadgeText: {
    fontSize: 12,
    fontWeight: '900',
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

  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#5F584F',
    marginBottom: 8,
    marginTop: 6,
  },

  inputWrap: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#ECE7DF',
    borderRadius: 16,
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  inputIcon: {
    marginRight: 8,
  },

  input: {
    flex: 1,
    color: '#0D1C11',
    fontSize: 15,
    paddingVertical: 14,
  },

  eyeButton: {
    marginLeft: 8,
  },

  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 12,
  },

  primaryButtonDisabled: {
    opacity: 0.75,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 8,
  },

  secondaryButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DED3',
    justifyContent: 'center',
    alignItems: 'center',
  },

  secondaryButtonText: {
    color: '#444444',
    fontSize: 14,
    fontWeight: '800',
  },

  infoBox: {
    backgroundColor: '#FFF3D8',
    borderRadius: 20,
    padding: 18,
  },

  infoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D1C11',
    marginBottom: 10,
  },

  infoText: {
    fontSize: 14,
    color: '#5D5246',
    lineHeight: 20,
    marginBottom: 6,
  },

  buttonPressed: {
    opacity: 0.84,
  },
});