import React, { useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

const getRedirectRouteBySession = (user, authRole, authHomeRoute) => {
  const safeRole = normalizeRole(authRole || user?.role);
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

  return authHomeRoute || '/(tabs)';
};

const ROLE_CARDS = [
  {
    id: 'client',
    title: 'Client',
    subtitle: 'Commander sur AFROEAT',
    description:
      'Découvre les restaurants, ajoute au panier, commande facilement et suis tes livraisons.',
    iconType: 'ionicons',
    iconName: 'restaurant-outline',
    accent: '#D4A017',
    soft: '#FFF3D8',
    dark: '#8A6500',
  },
  {
    id: 'restaurant',
    title: 'Restaurant partenaire',
    subtitle: 'Piloter ton activité',
    description:
      'Gère ton menu, tes commandes, ton activité et ton espace partenaire AFROEAT.',
    iconType: 'material',
    iconName: 'storefront-outline',
    accent: '#1F6F43',
    soft: '#E8F5ED',
    dark: '#1F6F43',
  },
  {
    id: 'livreur',
    title: 'Livreur',
    subtitle: 'Gérer tes missions',
    description:
      'Accède à tes missions, à ton suivi terrain, à tes statuts de livraison et à ton activité.',
    iconType: 'ionicons',
    iconName: 'bicycle-outline',
    accent: '#D96C2D',
    soft: '#FFF0E8',
    dark: '#A6501A',
  },
];

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function RoleSelectionScreen() {
  const auth = useAuth() || {};

  const loading = Boolean(auth.loading);
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const user = auth.user ?? null;
  const authRole = auth.role;
  const homeRoute = auth.homeRoute;
  const setSelectedRole = auth.setSelectedRole;
  const clearAllLocalAppData = auth.clearAllLocalAppData;

  const headline = useMemo(
    () => ({
      title: 'Bienvenue sur AFROEAT',
      subtitle:
        'Choisis ton espace pour accéder à un parcours dédié, premium et sécurisé.',
      description:
        'Restaurants, livraison et expérience client haut de gamme dans une seule plateforme internationale.',
    }),
    []
  );

  useEffect(() => {
    if (!loading && isAuthenticated && user?._id) {
      router.replace(getRedirectRouteBySession(user, authRole, homeRoute));
    }
  }, [loading, isAuthenticated, user, authRole, homeRoute]);

  const renderRoleIcon = useCallback((item) => {
    if (item.iconType === 'material') {
      return (
        <MaterialCommunityIcons
          name={item.iconName}
          size={26}
          color={item.accent}
        />
      );
    }

    return <Ionicons name={item.iconName} size={26} color={item.accent} />;
  }, []);

  const handleLogin = useCallback(
    async (role) => {
      try {
        if (typeof setSelectedRole === 'function') {
          await setSelectedRole(role);
        }
      } catch (error) {
        console.log('Erreur handleLogin role:', error);
      } finally {
        router.push({
          pathname: '/auth/login',
          params: { role },
        });
      }
    },
    [setSelectedRole]
  );

  const handleRegister = useCallback(
    async (role) => {
      try {
        if (typeof setSelectedRole === 'function') {
          await setSelectedRole(role);
        }
      } catch (error) {
        console.log('Erreur handleRegister role:', error);
      }

      if (role === 'client') {
        router.push('/auth/register-client');
        return;
      }

      if (role === 'restaurant') {
        router.push('/auth/register-restaurant');
        return;
      }

      router.push('/auth/register-driver');
    },
    [setSelectedRole]
  );

  const handleResetLocalData = useCallback(async () => {
    try {
      if (typeof clearAllLocalAppData === 'function') {
        await clearAllLocalAppData();
      }
    } catch (error) {
      console.log('Erreur handleResetLocalData:', error);
    } finally {
      router.replace('/auth/role');
    }
  }, [clearAllLocalAppData]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F3" />
        <View style={styles.loaderLogoWrap}>
          <Image source={LOGO_IMAGE} style={styles.loaderLogo} resizeMode="cover" />
        </View>
        <ActivityIndicator size="large" color="#D4A017" />
        <Text style={styles.loaderText}>Chargement de votre espace...</Text>
      </View>
    );
  }

  if (isAuthenticated && user?._id) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F3" />
        <View style={styles.loaderLogoWrap}>
          <Image source={LOGO_IMAGE} style={styles.loaderLogo} resizeMode="cover" />
        </View>
        <ActivityIndicator size="large" color="#D4A017" />
        <Text style={styles.loaderText}>Ouverture de votre espace...</Text>
      </View>
    );
  }

  return (
    <FadeInView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F3" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        bounces={false}
      >
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />

        <View style={styles.heroCard}>
          <View style={styles.logoWrap}>
            <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="cover" />
          </View>

          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>AFROEAT</Text>
          </View>

          <Text style={styles.title}>{headline.title}</Text>
          <Text style={styles.subtitle}>{headline.subtitle}</Text>
          <Text style={styles.description}>{headline.description}</Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>Client</Text>
              <Text style={styles.heroStatLabel}>Commande</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>Resto</Text>
              <Text style={styles.heroStatLabel}>Pilotage</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>Livreur</Text>
              <Text style={styles.heroStatLabel}>Mission</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Choisir un espace</Text>
            <Text style={styles.sectionSubtitle}>
              Connecte-toi ou inscris-toi dans le bloc qui correspond à ton activité.
            </Text>
          </View>

          {ROLE_CARDS.map((item) => (
            <View key={item.id} style={styles.roleCard}>
              <View
                style={[
                  styles.roleIconWrap,
                  {
                    backgroundColor: item.soft,
                    borderColor: `${item.accent}22`,
                  },
                ]}
              >
                {renderRoleIcon(item)}
              </View>

              <View style={styles.roleTextWrap}>
                <Text style={styles.roleTitle}>{item.title}</Text>
                <Text style={[styles.roleSubtitle, { color: item.dark }]}>
                  {item.subtitle}
                </Text>
                <Text style={styles.roleDescription}>{item.description}</Text>

                <View style={styles.actionsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryButton,
                      { backgroundColor: item.accent },
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => handleLogin(item.id)}
                  >
                    <Ionicons
                      name="log-in-outline"
                      size={16}
                      color="#FFFFFF"
                      style={styles.primaryButtonIcon}
                    />
                    <Text style={styles.primaryButtonText}>Connexion</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => handleRegister(item.id)}
                  >
                    <Text style={styles.secondaryButtonText}>Inscription</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.infoPanel}>
          <Text style={styles.infoTitle}>Expérience d’entrée premium</Text>
          <Text style={styles.infoText}>
            Cette page est le point d’accès principal de l’application avant toute
            navigation interne.
          </Text>
          <Text style={styles.infoText}>
            Aucun utilisateur ne doit arriver directement sur un dashboard sans
            être passé par la logique de session ou de connexion.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.resetButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleResetLocalData}
        >
          <Ionicons name="refresh-outline" size={18} color="#B63B3B" />
          <Text style={styles.resetButtonText}>Vider les comptes locaux</Text>
        </Pressable>
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
    backgroundColor: '#FFF8F3',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 48,
  },

  loader: {
    flex: 1,
    backgroundColor: '#FFF8F3',
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
    marginTop: 14,
    color: '#666666',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },

  heroGlowOne: {
    position: 'absolute',
    top: 10,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(212,160,23,0.10)',
  },

  heroGlowTwo: {
    position: 'absolute',
    top: 160,
    left: -25,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(31,111,67,0.08)',
  },

  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 18,
    marginBottom: 26,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },

  logoWrap: {
    width: 90,
    height: 90,
    borderRadius: 26,
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

  brandBadge: {
    backgroundColor: '#1F6F43',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 16,
  },

  brandBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 10,
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F1F1F',
    lineHeight: 25,
    marginBottom: 10,
    textAlign: 'center',
  },

  description: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 18,
  },

  heroStatsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },

  heroStatCard: {
    flex: 1,
    backgroundColor: '#FAF8F4',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#F0E5D9',
  },

  heroStatValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 4,
  },

  heroStatLabel: {
    fontSize: 11,
    color: '#7A7268',
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  section: {
    marginBottom: 24,
  },

  sectionHeader: {
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 6,
  },

  sectionSubtitle: {
    fontSize: 13,
    color: '#6F6F6F',
    lineHeight: 20,
  },

  roleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  roleIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
  },

  roleTextWrap: {
    flex: 1,
  },

  roleTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 4,
  },

  roleSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
    marginBottom: 5,
  },

  roleDescription: {
    fontSize: 12.5,
    color: '#666666',
    lineHeight: 18,
    marginBottom: 14,
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
  },

  primaryButtonIcon: {
    marginRight: 6,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },

  secondaryButton: {
    flex: 1,
    minHeight: 46,
    backgroundColor: '#F7F7F7',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ECE6DD',
  },

  secondaryButtonText: {
    color: '#444444',
    fontWeight: '800',
    fontSize: 14,
  },

  infoPanel: {
    backgroundColor: '#111111',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },

  infoTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },

  infoText: {
    color: '#E1E1E1',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
  },

  resetButton: {
    backgroundColor: '#FFF0F0',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#F3C9C9',
  },

  resetButtonText: {
    color: '#B63B3B',
    fontWeight: '900',
    fontSize: 14,
    marginLeft: 8,
  },

  buttonPressed: {
    opacity: 0.88,
  },
});