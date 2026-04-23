import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../../components/FadeInView';
import { registerRestaurant } from '../../services/authService';

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const isValidEmail = (value) => {
  const email = normalizeText(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const sanitizePhone = (value) => {
  return String(value ?? '').replace(/[^\d+]/g, '').trim();
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function RegisterRestaurantScreen() {
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantLogo, setRestaurantLogo] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [siret, setSiret] = useState('');
  const [identityFront, setIdentityFront] = useState('');
  const [identityBack, setIdentityBack] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);

  const isValid = useMemo(() => {
    return (
      normalizeText(restaurantName).length >= 2 &&
      normalizeText(restaurantLogo).length >= 5 &&
      normalizeText(firstName).length >= 2 &&
      normalizeText(lastName).length >= 2 &&
      sanitizePhone(phone).length >= 6 &&
      normalizeText(address).length >= 5 &&
      normalizeText(siret).length >= 5 &&
      normalizeText(identityFront).length >= 5 &&
      normalizeText(identityBack).length >= 5 &&
      normalizeText(payoutMethod).length >= 3 &&
      isValidEmail(email) &&
      normalizeText(password).length >= 6
    );
  }, [
    restaurantName,
    restaurantLogo,
    firstName,
    lastName,
    phone,
    address,
    siret,
    identityFront,
    identityBack,
    payoutMethod,
    email,
    password,
  ]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/auth/role');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (loading) return;

    const safeRestaurantName = normalizeText(restaurantName);
    const safeRestaurantLogo = normalizeText(restaurantLogo);
    const safeFirstName = normalizeText(firstName);
    const safeLastName = normalizeText(lastName);
    const safePhone = sanitizePhone(phone);
    const safeAddress = normalizeText(address);
    const safeSiret = normalizeText(siret);
    const safeIdentityFront = normalizeText(identityFront);
    const safeIdentityBack = normalizeText(identityBack);
    const safePayoutMethod = normalizeText(payoutMethod);
    const safeEmail = normalizeText(email).toLowerCase();
    const safePassword = normalizeText(password);

    if (safeRestaurantName.length < 2) {
      Alert.alert('Nom du restaurant invalide', 'Merci de saisir un nom de restaurant valide.');
      return;
    }
    if (safeRestaurantLogo.length < 5) {
      Alert.alert('Logo invalide', 'Merci de renseigner un logo ou un lien de logo valide.');
      return;
    }
    if (safeFirstName.length < 2) {
      Alert.alert('Prénom invalide', 'Merci de saisir le prénom du responsable.');
      return;
    }
    if (safeLastName.length < 2) {
      Alert.alert('Nom invalide', 'Merci de saisir le nom du responsable.');
      return;
    }
    if (safePhone.length < 6) {
      Alert.alert('Téléphone invalide', 'Merci de saisir un numéro de téléphone valide.');
      return;
    }
    if (safeAddress.length < 5) {
      Alert.alert('Adresse invalide', 'Merci de saisir une adresse valide.');
      return;
    }
    if (safeSiret.length < 5) {
      Alert.alert('SIRET invalide', 'Merci de saisir un identifiant légal valide.');
      return;
    }
    if (safeIdentityFront.length < 5) {
      Alert.alert('Document recto invalide', 'Merci de renseigner le document recto.');
      return;
    }
    if (safeIdentityBack.length < 5) {
      Alert.alert('Document verso invalide', 'Merci de renseigner le document verso.');
      return;
    }
    if (safePayoutMethod.length < 3) {
      Alert.alert('Compte de versement invalide', 'Merci de renseigner un moyen de versement valide.');
      return;
    }
    if (!isValidEmail(safeEmail)) {
      Alert.alert('Email invalide', 'Merci de saisir une adresse email valide.');
      return;
    }
    if (safePassword.length < 6) {
      Alert.alert('Mot de passe invalide', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    try {
      setLoading(true);

      await registerRestaurant({
        restaurantName: safeRestaurantName,
        restaurantLogo: safeRestaurantLogo,
        firstName: safeFirstName,
        lastName: safeLastName,
        phone: safePhone,
        address: safeAddress,
        siret: safeSiret,
        identityFront: safeIdentityFront,
        identityBack: safeIdentityBack,
        payoutMethod: safePayoutMethod,
        email: safeEmail,
        password: safePassword,
        role: 'restaurant',
        accountStatus: 'pending_verification',
      });

      Alert.alert(
        'Compte restaurant créé',
        'Le dossier partenaire a bien été envoyé. Il est maintenant en attente de validation.',
        [
          {
            text: 'OK',
            onPress: () =>
              router.replace({
                pathname: '/auth/pending-approval',
                params: { role: 'restaurant' },
              }),
          },
        ]
      );
    } catch (error) {
      console.log('Erreur register restaurant :', error);
      Alert.alert(
        'Inscription impossible',
        error?.message || 'Impossible de créer le compte restaurant.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    restaurantName,
    restaurantLogo,
    firstName,
    lastName,
    phone,
    address,
    siret,
    identityFront,
    identityBack,
    payoutMethod,
    email,
    password,
  ]);

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F3" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topRow}>
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleBack}
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={22} color="#111111" />
            </Pressable>
          </View>

          <View style={styles.header}>
            <View style={styles.iconWrapper}>
              <Ionicons name="storefront-outline" size={30} color="#1F6F43" />
            </View>

            <Text style={styles.eyebrow}>AFROEAT PARTNER</Text>
            <Text style={styles.title}>Inscription restaurant</Text>
            <Text style={styles.subtitle}>
              Complète le dossier partenaire pour accéder à l'espace restaurant
              AFROEAT après validation.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Nom du restaurant</Text>
            <TextInput
              style={styles.input}
              value={restaurantName}
              onChangeText={setRestaurantName}
              placeholder="Nom du restaurant"
              placeholderTextColor="#888888"
              editable={!loading}
            />

            <Text style={styles.label}>Logo du restaurant</Text>
            <TextInput
              style={styles.input}
              value={restaurantLogo}
              onChangeText={setRestaurantLogo}
              placeholder="Lien logo / upload"
              placeholderTextColor="#888888"
              editable={!loading}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Prénom du responsable</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Prénom"
              placeholderTextColor="#888888"
              editable={!loading}
            />

            <Text style={styles.label}>Nom du responsable</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Nom"
              placeholderTextColor="#888888"
              editable={!loading}
            />

            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Téléphone"
              placeholderTextColor="#888888"
              keyboardType="phone-pad"
              editable={!loading}
            />

            <Text style={styles.label}>Adresse</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={address}
              onChangeText={setAddress}
              placeholder="Adresse du restaurant"
              placeholderTextColor="#888888"
              multiline
              textAlignVertical="top"
              editable={!loading}
            />

            <Text style={styles.label}>SIRET / Identifiant légal</Text>
            <TextInput
              style={styles.input}
              value={siret}
              onChangeText={setSiret}
              placeholder="Numéro SIRET ou identifiant légal"
              placeholderTextColor="#888888"
              editable={!loading}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Pièce d'identité recto</Text>
            <TextInput
              style={styles.input}
              value={identityFront}
              onChangeText={setIdentityFront}
              placeholder="Lien fichier / upload"
              placeholderTextColor="#888888"
              editable={!loading}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Pièce d'identité verso</Text>
            <TextInput
              style={styles.input}
              value={identityBack}
              onChangeText={setIdentityBack}
              placeholder="Lien fichier / upload"
              placeholderTextColor="#888888"
              editable={!loading}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Compte de versement</Text>
            <TextInput
              style={styles.input}
              value={payoutMethod}
              onChangeText={setPayoutMethod}
              placeholder="IBAN / compte bancaire / carte"
              placeholderTextColor="#888888"
              editable={!loading}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#888888"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Mot de passe"
                placeholderTextColor="#888888"
                secureTextEntry={secure}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <Pressable
                onPress={() => setSecure((prev) => !prev)}
                disabled={loading}
                style={({ pressed }) => pressed && styles.buttonPressed}
              >
                <Ionicons
                  name={secure ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#666666"
                />
              </Pressable>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Validation partenaire</Text>
              <Text style={styles.infoText}>
                Le compte restaurant sera placé en attente de validation avant
                l'accès complet au dashboard partenaire.
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                (!isValid || loading) && styles.buttonDisabled,
                pressed && !loading && isValid && styles.buttonPressed,
              ]}
              onPress={handleSubmit}
              disabled={!isValid || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>
                  Envoyer mon dossier restaurant
                </Text>
              )}
            </Pressable>
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

  container: {
    flex: 1,
    backgroundColor: '#FFF8F3',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 48,
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

  header: {
    alignItems: 'center',
    marginBottom: 24,
  },

  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F6F43',
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  iconWrapper: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#E8F5ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 8,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 22,
    textAlign: 'center',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
  },

  label: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 8,
    marginTop: 6,
  },

  input: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#ECE7DF',
    color: '#1E1E1E',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderRadius: 16,
    marginBottom: 14,
    fontSize: 15,
  },

  textarea: {
    minHeight: 90,
  },

  passwordWrapper: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#ECE7DF',
    borderRadius: 16,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },

  passwordInput: {
    flex: 1,
    color: '#1E1E1E',
    paddingVertical: 15,
    fontSize: 15,
  },

  infoBox: {
    backgroundColor: '#E8F5ED',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },

  infoTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 6,
  },

  infoText: {
    fontSize: 13,
    color: '#2F5C41',
    lineHeight: 20,
  },

  button: {
    backgroundColor: '#1F6F43',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },

  buttonPressed: {
    opacity: 0.84,
  },
});
