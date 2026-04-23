import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { updateMyProfile } from '../../services/authService';

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

const sanitizeCardBrand = (value) => {
  return normalizeText(value).slice(0, 40);
};

const sanitizeHolderName = (value) => {
  return normalizeText(value).slice(0, 120);
};

const sanitizeLast4 = (value) => {
  return String(value ?? '').replace(/\D/g, '').slice(0, 4);
};

const sanitizeExpiry = (value) => {
  const raw = String(value ?? '')
    .replace(/[^\d]/g, '')
    .slice(0, 4);

  if (raw.length <= 2) {
    return raw;
  }

  return `${raw.slice(0, 2)}/${raw.slice(2)}`;
};

const isValidExpiry = (value) => {
  const normalized = normalizeText(value);

  if (!/^\d{2}\/\d{2}$/.test(normalized)) {
    return false;
  }

  const [monthStr, yearStr] = normalized.split('/');
  const month = Number(monthStr);
  const year = Number(yearStr);

  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return false;
  }

  if (!Number.isFinite(year) || year < 0) {
    return false;
  }

  return true;
};

const getMaskedCardPreview = (brand, last4) => {
  const safeBrand = sanitizeCardBrand(brand);
  const safeLast4 = sanitizeLast4(last4);

  if (!safeBrand && !safeLast4) {
    return 'Aucun moyen de paiement enregistré';
  }

  if (!safeBrand) {
    return `•••• ${safeLast4}`;
  }

  if (!safeLast4) {
    return safeBrand;
  }

  return `${safeBrand} •••• ${safeLast4}`;
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function ProfilePaymentScreen() {
  const auth = useAuth() || {};

  const user = auth.user ?? null;
  const role = auth.role;
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role || 'client');
  }, [role, user]);

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
        <Text style={styles.loaderText}>Chargement du moyen de paiement...</Text>
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

  const initialData = useMemo(() => {
    return user?.paymentMethod && typeof user.paymentMethod === 'object'
      ? user.paymentMethod
      : {};
  }, [user]);

  const [holderName, setHolderName] = useState('');
  const [brand, setBrand] = useState('');
  const [last4, setLast4] = useState('');
  const [expiry, setExpiry] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHolderName(normalizeText(initialData?.holderName));
    setBrand(normalizeText(initialData?.brand));
    setLast4(sanitizeLast4(initialData?.last4));
    setExpiry(sanitizeExpiry(initialData?.expiry));
  }, [initialData]);

  const canSave = useMemo(() => {
    return (
      sanitizeHolderName(holderName).length >= 2 &&
      sanitizeCardBrand(brand).length >= 2 &&
      sanitizeLast4(last4).length === 4 &&
      isValidExpiry(expiry)
    );
  }, [holderName, brand, last4, expiry]);

  const paymentPreview = useMemo(() => {
    return getMaskedCardPreview(brand, last4);
  }, [brand, last4]);

  const hasSavedPaymentMethod = useMemo(() => {
    return Boolean(
      sanitizeHolderName(holderName) ||
        sanitizeCardBrand(brand) ||
        sanitizeLast4(last4)
    );
  }, [holderName, brand, last4]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/profile');
  }, []);

  const handleSave = useCallback(async () => {
    if (!isAuthenticated || !token) {
      Alert.alert('Connexion requise', 'Tu dois être connecté.');
      return;
    }

    const safeHolderName = sanitizeHolderName(holderName);
    const safeBrand = sanitizeCardBrand(brand);
    const safeLast4 = sanitizeLast4(last4);
    const safeExpiry = sanitizeExpiry(expiry);

    if (safeHolderName.length < 2) {
      Alert.alert('Champ requis', 'Le nom du titulaire est invalide.');
      return;
    }

    if (safeBrand.length < 2) {
      Alert.alert('Champ requis', 'Le type de carte est invalide.');
      return;
    }

    if (safeLast4.length !== 4) {
      Alert.alert(
        'Carte invalide',
        'Les 4 derniers chiffres de la carte sont requis.'
      );
      return;
    }

    if (!isValidExpiry(safeExpiry)) {
      Alert.alert(
        'Expiration invalide',
        'La date d’expiration doit être au format MM/AA.'
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        paymentMethod: {
          holderName: safeHolderName,
          brand: safeBrand,
          last4: safeLast4,
          expiry: safeExpiry,
        },
      };

      await updateMyProfile(payload, token);

      Alert.alert('Succès', 'Le moyen de paiement a bien été enregistré.');
    } catch (error) {
      console.log('Erreur update payment :', error);
      Alert.alert(
        'Enregistrement impossible',
        error?.message || 'Impossible de sauvegarder les informations.'
      );
    } finally {
      setSaving(false);
    }
  }, [isAuthenticated, token, holderName, brand, last4, expiry]);

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
            accessibilityLabel="Retour au profil"
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

          <Text style={styles.title}>Paiements</Text>
          <Text style={styles.subtitle}>
            Gère ton moyen de paiement client AFROEAT. Cet écran est prêt pour
            accueillir ensuite un branchement Stripe sans casser le bloc client.
          </Text>
        </View>

        <View style={styles.previewCard}>
          <View style={styles.previewTopRow}>
            <View style={styles.previewBadge}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color="#2457C5"
              />
              <Text style={styles.previewBadgeText}>Préparation paiement</Text>
            </View>
          </View>

          <Text style={styles.previewTitle}>Moyen de paiement</Text>
          <Text style={styles.previewValue}>{paymentPreview}</Text>
          <Text style={styles.previewMeta}>
            {hasSavedPaymentMethod
              ? `Expiration ${normalizeText(expiry, '--/--')}`
              : 'Aucune carte client enregistrée pour le moment.'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Nom du titulaire</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color="#8B8B8B" />
            <TextInput
              style={styles.input}
              placeholder="Nom du titulaire"
              placeholderTextColor="#999999"
              value={holderName}
              onChangeText={(value) => setHolderName(sanitizeHolderName(value))}
              editable={!saving}
              maxLength={120}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>Type de carte</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="card-outline" size={20} color="#8B8B8B" />
            <TextInput
              style={styles.input}
              placeholder="Visa / Mastercard"
              placeholderTextColor="#999999"
              value={brand}
              onChangeText={(value) => setBrand(sanitizeCardBrand(value))}
              editable={!saving}
              maxLength={40}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>4 derniers chiffres</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="keypad-outline" size={20} color="#8B8B8B" />
            <TextInput
              style={styles.input}
              placeholder="1234"
              placeholderTextColor="#999999"
              value={last4}
              onChangeText={(value) => setLast4(sanitizeLast4(value))}
              keyboardType="number-pad"
              maxLength={4}
              editable={!saving}
            />
          </View>

          <Text style={styles.label}>Expiration</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="calendar-outline" size={20} color="#8B8B8B" />
            <TextInput
              style={styles.input}
              placeholder="MM/AA"
              placeholderTextColor="#999999"
              value={expiry}
              onChangeText={(value) => setExpiry(sanitizeExpiry(value))}
              keyboardType="number-pad"
              maxLength={5}
              editable={!saving}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enregistrer mon moyen de paiement"
            style={({ pressed }) => [
              styles.button,
              (!canSave || saving) && styles.buttonDisabled,
              pressed && canSave && !saving && styles.buttonPressed,
            ]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? (
              <ActivityIndicator color="#111111" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#111111" />
                <Text style={styles.buttonText}>
                  Enregistrer mon moyen de paiement
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Structure prête pour Stripe</Text>
          <Text style={styles.infoText}>
            Cette version enregistre une structure client propre côté profil.
          </Text>
          <Text style={styles.infoText}>
            Le branchement Stripe pourra être ajouté ensuite sans refaire
            l’écran, les routes ou la logique du bloc client.
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