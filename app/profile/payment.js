import React, { useMemo, useCallback } from 'react';
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

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function ProfilePaymentScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};

  const user = auth.user ?? null;
  const role = auth.role;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role || 'client');
  }, [role, user]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/profile');
  }, []);

  /**
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (authLoading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#D4A017" />
        <Text style={styles.loaderText}>{t('profile.payment.loaderText')}</Text>
      </View>
    );
  }

  /**
   * =========================================================
   * SÉPARATION STRUCTURELLE DES BLOCS
   * =========================================================
   * Cette page /profile/payment est strictement réservée au bloc CLIENT.
   */

  if (!isAuthenticated) {
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
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('profile.payment.backAccessibilityLabel')}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={22} color="#1E1E1E" />
          </Pressable>
        </View>

        <View style={styles.header}>
          <View style={styles.iconWrapper}>
            <Ionicons name="card-outline" size={32} color="#D96C2D" />
          </View>

          <Text style={styles.title}>{t('profile.payment.title')}</Text>
          <Text style={styles.subtitle}>{t('profile.payment.subtitle')}</Text>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark-outline" size={28} color="#2457C5" />
          <Text style={styles.infoTitle}>Paiements protégés</Text>
          <Text style={styles.infoText}>
            AFROEAT ne demande pas et ne stocke pas les numéros de carte, les dates d’expiration ou le cryptogramme dans le profil.
          </Text>
          <Text style={styles.infoText}>
            Pour payer par carte, choisis ce moyen de paiement au moment de valider une commande. Le paiement sera traité par l’interface sécurisée de Stripe, si elle est disponible.
          </Text>
          <Text style={styles.infoText}>
            Aucun moyen de paiement enregistré n’est actuellement géré depuis cette page.
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
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 40,
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
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  header: {
    alignItems: 'center',
    marginBottom: 22,
  },

  iconWrapper: {
    width: 78,
    height: 78,
    borderRadius: 39,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#FFF0E8',
  },

  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1E1E1E',
    textAlign: 'center',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 20,
  },

  previewCard: {
    backgroundColor: '#EEF4FF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#DCE7FF',
  },

  previewTopRow: {
    marginBottom: 10,
  },

  previewBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  previewBadgeText: {
    marginLeft: 6,
    color: '#2457C5',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  previewTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2457C5',
    marginBottom: 8,
  },

  previewValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E1E1E',
    marginBottom: 6,
  },

  previewMeta: {
    fontSize: 13,
    color: '#4F5F88',
    lineHeight: 19,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#888888',
    marginBottom: 8,
    marginTop: 10,
    textTransform: 'uppercase',
  },

  inputWrapper: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#ECE7DF',
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  input: {
    flex: 1,
    color: '#1E1E1E',
    fontSize: 15,
    marginLeft: 10,
  },

  button: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    flexDirection: 'row',
    backgroundColor: '#D4A017',
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#111111',
    fontWeight: '900',
    fontSize: 16,
    marginLeft: 8,
  },

  infoBox: {
    backgroundColor: '#FFF3D8',
    borderRadius: 20,
    padding: 18,
  },

  infoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1E1E',
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