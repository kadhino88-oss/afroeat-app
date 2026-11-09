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
import { registerClient } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
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

const isValidEmail = (value) => {
  const email = normalizeText(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isStrongPassword = (value) => {
  const password = normalizeText(value);
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
};

const sanitizePhone = (value) => {
  return String(value ?? '').replace(/[^\d+]/g, '').trim();
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function RegisterClientScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const setSelectedRole = auth.setSelectedRole;
  const login = auth.login;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);

  const isValid = useMemo(() => {
    return (
      normalizeText(firstName).length >= 2 &&
      normalizeText(lastName).length >= 2 &&
      sanitizePhone(phone).length >= 8 &&
      normalizeText(address).length >= 5 &&
      normalizeText(country).length >= 2 &&
      isValidEmail(email) &&
      isStrongPassword(password)
    );
  }, [firstName, lastName, phone, address, country, email, password]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/auth/role');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (loading) return;

    const safeFirstName = normalizeText(firstName);
    const safeLastName = normalizeText(lastName);
    const safePhone = sanitizePhone(phone);
    const safeAddress = normalizeText(address);
    const safeCountry = normalizeText(country);
    const safeEmail = normalizeText(email).toLowerCase();
    const safePassword = normalizeText(password);

    if (!safeFirstName || safeFirstName.length < 2) {
      Alert.alert(t('auth.validation.firstNameInvalidTitle'), t('auth.validation.firstNameInvalidBody'));
      return;
    }

    if (!safeLastName || safeLastName.length < 2) {
      Alert.alert(t('auth.validation.lastNameInvalidTitle'), t('auth.validation.lastNameInvalidBody'));
      return;
    }

    if (!safePhone || safePhone.length < 8) {
      Alert.alert(t('auth.validation.phoneInvalidTitle'), t('auth.validation.phoneInvalidBody'));
      return;
    }

    if (!safeAddress || safeAddress.length < 5) {
      Alert.alert(t('auth.validation.addressInvalidTitle'), t('auth.validation.addressInvalidBody'));
      return;
    }

    if (!safeCountry || safeCountry.length < 2) {
      Alert.alert(t('auth.validation.countryInvalidTitle'), t('auth.validation.countryInvalidBody'));
      return;
    }

    if (!isValidEmail(safeEmail)) {
      Alert.alert(t('auth.login.invalidEmailTitle'), t('auth.login.invalidEmailBody'));
      return;
    }

    if (!isStrongPassword(safePassword)) {
      Alert.alert(
        t('auth.login.invalidPasswordTitle'),
        t('auth.validation.passwordTooShortBody')
      );
      return;
    }

    try {
      setLoading(true);

      if (typeof setSelectedRole === 'function') {
        await setSelectedRole('client');
      }

      const registration = await registerClient({
        firstName: safeFirstName,
        lastName: safeLastName,
        phone: safePhone,
        address: safeAddress,
        country: safeCountry,
        email: safeEmail,
        password: safePassword,
        role: 'client',
      });

      const sessionReady =
        typeof login === 'function' &&
        (await login(registration?.user, registration?.token));

      if (!sessionReady) {
        Alert.alert(
          t('auth.registerClient.successTitle'),
          t('auth.registerClient.successBody'),
          [
            {
              text: t('auth.validation.ok'),
              onPress: () =>
                router.replace({
                  pathname: '/auth/login',
                  params: { role: 'client' },
                }),
            },
          ]
        );
        return;
      }

      Alert.alert(
        t('profile.payment.signupPromptTitle'),
        t('profile.payment.signupPromptText'),
        [
          {
            text: t('profile.payment.signupSkipButton'),
            onPress: () => router.replace('/(tabs)/explore'),
          },
          {
            text: t('profile.payment.signupAddNowButton'),
            onPress: () =>
              router.replace({
                pathname: '/profile/payment',
                params: { fromSignup: 'true' },
              }),
          },
        ]
      );
    } catch (error) {
      console.log('Erreur register client :', error);
      Alert.alert(
        t('auth.registerClient.failedTitle'),
        error?.message || t('auth.registerClient.failedFallback')
      );
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    firstName,
    lastName,
    phone,
    address,
    country,
    email,
    password,
    setSelectedRole,
    login,
    t,
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
              <Ionicons name="arrow-back" size={22} color="#0D1C11" />
            </Pressable>
          </View>

          <View style={styles.header}>
            <View style={styles.iconWrapper}>
              <Ionicons name="person-outline" size={30} color="#EAB02F" />
            </View>

            <Text style={styles.eyebrow}>AFROEAT</Text>
            <Text style={styles.title}>{t('auth.registerClient.title')}</Text>
            <Text style={styles.subtitle}>
              {t('auth.registerClient.subtitle')}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{t('auth.fields.firstName')}</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder={t('auth.fields.firstName')}
              placeholderTextColor="#888888"
              editable={!loading}
            />

            <Text style={styles.label}>{t('auth.fields.lastName')}</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder={t('auth.fields.lastName')}
              placeholderTextColor="#888888"
              editable={!loading}
            />

            <Text style={styles.label}>{t('auth.fields.phone')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('auth.fields.phone')}
              placeholderTextColor="#888888"
              keyboardType="phone-pad"
              editable={!loading}
            />

            <Text style={styles.label}>{t('auth.fields.address')}</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={address}
              onChangeText={setAddress}
              placeholder={t('auth.fields.addressPlaceholder')}
              placeholderTextColor="#888888"
              multiline
              textAlignVertical="top"
              editable={!loading}
            />

            <Text style={styles.label}>{t('auth.fields.country')}</Text>
            <TextInput
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder={t('auth.fields.country')}
              placeholderTextColor="#888888"
              editable={!loading}
            />

            <Text style={styles.label}>{t('auth.fields.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.fields.email')}
              placeholderTextColor="#888888"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Text style={styles.label}>{t('auth.fields.password')}</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.fields.password')}
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
              <Text style={styles.infoTitle}>{t('auth.registerClient.paymentLaterTitle')}</Text>
              <Text style={styles.infoText}>
                {t('auth.registerClient.paymentLaterText')}
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
                <ActivityIndicator color="#0D1C11" />
              ) : (
                <Text style={styles.buttonText}>{t('auth.registerClient.submit')}</Text>
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
    color: '#084424',
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  iconWrapper: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#FFF3D8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0D1C11',
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
    color: '#0D1C11',
    marginBottom: 8,
    marginTop: 6,
  },

  input: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#ECE7DF',
    color: '#0D1C11',
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
    color: '#0D1C11',
    paddingVertical: 15,
    fontSize: 15,
  },

  infoBox: {
    backgroundColor: '#FFF3D8',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },

  infoTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 6,
  },

  infoText: {
    fontSize: 13,
    color: '#5D5246',
    lineHeight: 20,
  },

  button: {
    backgroundColor: '#EAB02F',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#0D1C11',
    fontWeight: '900',
    fontSize: 16,
  },

  buttonPressed: {
    opacity: 0.84,
  },
});
