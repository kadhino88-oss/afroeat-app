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
import { useTranslation } from 'react-i18next';
import FadeInView from '../../components/FadeInView';
import { registerDriver } from '../../services/authService';

/**
 * =========================================================
 * CONSTANTES
 * =========================================================
 */

const DOCUMENT_OPTIONS = [
  'Passeport',
  'Carte de résident',
  'Carte de séjour',
  'Titre de séjour',
  'Document européen',
];

const DOCUMENT_SLUG_BY_LABEL = {
  'Passeport': 'passeport',
  'Carte de résident': 'carteResident',
  'Carte de séjour': 'carteSejour',
  'Titre de séjour': 'titreSejour',
  'Document européen': 'documentEuropeen',
};

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

export default function RegisterDriverScreen() {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [documentType, setDocumentType] = useState('Passeport');
  const [identityFront, setIdentityFront] = useState('');
  const [identityBack, setIdentityBack] = useState('');
  const [selfie, setSelfie] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('');
  const [membershipPaymentMethod, setMembershipPaymentMethod] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);

  const isValid = useMemo(() => {
    return (
      normalizeText(firstName).length >= 2 &&
      normalizeText(lastName).length >= 2 &&
      sanitizePhone(phone).length >= 6 &&
      normalizeText(address).length >= 5 &&
      normalizeText(country).length >= 2 &&
      normalizeText(documentType).length >= 2 &&
      normalizeText(identityFront).length >= 5 &&
      normalizeText(identityBack).length >= 5 &&
      normalizeText(selfie).length >= 5 &&
      normalizeText(payoutMethod).length >= 3 &&
      normalizeText(membershipPaymentMethod).length >= 3 &&
      isValidEmail(email) &&
      normalizeText(password).length >= 6
    );
  }, [
    firstName,
    lastName,
    phone,
    address,
    country,
    documentType,
    identityFront,
    identityBack,
    selfie,
    payoutMethod,
    membershipPaymentMethod,
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

    const safeFirstName = normalizeText(firstName);
    const safeLastName = normalizeText(lastName);
    const safePhone = sanitizePhone(phone);
    const safeAddress = normalizeText(address);
    const safeCountry = normalizeText(country);
    const safeDocumentType = normalizeText(documentType);
    const safeIdentityFront = normalizeText(identityFront);
    const safeIdentityBack = normalizeText(identityBack);
    const safeSelfie = normalizeText(selfie);
    const safePayoutMethod = normalizeText(payoutMethod);
    const safeMembershipPaymentMethod = normalizeText(membershipPaymentMethod);
    const safeEmail = normalizeText(email).toLowerCase();
    const safePassword = normalizeText(password);

    if (safeFirstName.length < 2) {
      Alert.alert(t('auth.validation.firstNameInvalidTitle'), t('auth.validation.firstNameInvalidBody'));
      return;
    }
    if (safeLastName.length < 2) {
      Alert.alert(t('auth.validation.lastNameInvalidTitle'), t('auth.validation.lastNameInvalidBody'));
      return;
    }
    if (safePhone.length < 6) {
      Alert.alert(t('auth.validation.phoneInvalidTitle'), t('auth.registerDriver.phoneInvalidBody'));
      return;
    }
    if (safeAddress.length < 5) {
      Alert.alert(t('auth.validation.addressInvalidTitle'), t('auth.validation.addressInvalidBody'));
      return;
    }
    if (safeCountry.length < 2) {
      Alert.alert(t('auth.validation.countryInvalidTitle'), t('auth.validation.countryInvalidBody'));
      return;
    }
    if (safeDocumentType.length < 2) {
      Alert.alert(t('auth.registerDriver.documentTypeInvalidTitle'), t('auth.registerDriver.documentTypeInvalidBody'));
      return;
    }
    if (safeIdentityFront.length < 5) {
      Alert.alert(t('auth.registerDriver.idFrontInvalidTitle'), t('auth.registerDriver.idFrontInvalidBody'));
      return;
    }
    if (safeIdentityBack.length < 5) {
      Alert.alert(t('auth.registerDriver.idBackInvalidTitle'), t('auth.registerDriver.idBackInvalidBody'));
      return;
    }
    if (safeSelfie.length < 5) {
      Alert.alert(t('auth.registerDriver.selfieInvalidTitle'), t('auth.registerDriver.selfieInvalidBody'));
      return;
    }
    if (safePayoutMethod.length < 3) {
      Alert.alert(t('auth.registerDriver.payoutInvalidTitle'), t('auth.registerDriver.payoutInvalidBody'));
      return;
    }
    if (safeMembershipPaymentMethod.length < 3) {
      Alert.alert(t('auth.registerDriver.membershipInvalidTitle'), t('auth.registerDriver.membershipInvalidBody'));
      return;
    }
    if (!isValidEmail(safeEmail)) {
      Alert.alert(t('auth.login.invalidEmailTitle'), t('auth.login.invalidEmailBody'));
      return;
    }
    if (safePassword.length < 6) {
      Alert.alert(t('auth.login.invalidPasswordTitle'), t('auth.validation.passwordTooShortBody'));
      return;
    }

    try {
      setLoading(true);

      await registerDriver({
        firstName: safeFirstName,
        lastName: safeLastName,
        phone: safePhone,
        address: safeAddress,
        country: safeCountry,
        documentType: safeDocumentType,
        identityFront: safeIdentityFront,
        identityBack: safeIdentityBack,
        selfie: safeSelfie,
        payoutMethod: safePayoutMethod,
        membershipPaymentMethod: safeMembershipPaymentMethod,
        email: safeEmail,
        password: safePassword,
        role: 'livreur',
        accountStatus: 'pending_verification',
      });

      Alert.alert(
        t('auth.registerDriver.successTitle'),
        t('auth.registerDriver.successBody'),
        [
          {
            text: t('auth.validation.ok'),
            onPress: () =>
              router.replace({
                pathname: '/auth/pending-approval',
                params: { role: 'livreur' },
              }),
          },
        ]
      );
    } catch (error) {
      const msg = error?.message || '';
      const status = error?.status;
      let title = t('auth.registerDriver.failedTitle');
      let body = msg || t('auth.registerDriver.failedFallback');
      if (status === 409 || msg.toLowerCase().includes('exist') || msg.toLowerCase().includes('déjà') || msg.toLowerCase().includes('already')) {
        title = t('auth.registerDriver.emailAlreadyUsedTitle');
        body = t('auth.registerDriver.emailAlreadyUsedBody');
      } else if (status === 0 || msg.toLowerCase().includes('réseau') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('serveur')) {
        title = t('auth.registerDriver.connectionFailedTitle');
        body = t('auth.registerDriver.connectionFailedBody');
      }
      Alert.alert(title, body);
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
    documentType,
    identityFront,
    identityBack,
    selfie,
    payoutMethod,
    membershipPaymentMethod,
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
              <Ionicons name="bicycle-outline" size={30} color="#D96C2D" />
            </View>

            <Text style={styles.eyebrow}>{t('auth.registerDriver.eyebrow')}</Text>
            <Text style={styles.title}>{t('auth.registerDriver.title')}</Text>
            <Text style={styles.subtitle}>{t('auth.registerDriver.subtitle')}</Text>
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

            <Text style={styles.label}>{t('auth.registerDriver.documentTypeLabel')}</Text>
            <View style={styles.chipsWrapper}>
              {DOCUMENT_OPTIONS.map((item) => {
                const active = documentType === item;
                const slug = DOCUMENT_SLUG_BY_LABEL[item];
                return (
                  <Pressable
                    key={item}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && !loading && styles.buttonPressed,
                    ]}
                    onPress={() => setDocumentType(item)}
                    disabled={loading}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {t(`auth.registerDriver.documents.${slug}`, item)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>{t('auth.registerDriver.idFrontLabel')}</Text>
            <TextInput
              style={styles.input}
              value={identityFront}
              onChangeText={setIdentityFront}
              placeholder={t('auth.registerDriver.uploadPlaceholder')}
              placeholderTextColor="#888888"
              editable={!loading}
              autoCapitalize="none"
            />

            <Text style={styles.label}>{t('auth.registerDriver.idBackLabel')}</Text>
            <TextInput
              style={styles.input}
              value={identityBack}
              onChangeText={setIdentityBack}
              placeholder={t('auth.registerDriver.uploadPlaceholder')}
              placeholderTextColor="#888888"
              editable={!loading}
              autoCapitalize="none"
            />

            <Text style={styles.label}>{t('auth.registerDriver.selfieLabel')}</Text>
            <TextInput
              style={styles.input}
              value={selfie}
              onChangeText={setSelfie}
              placeholder={t('auth.registerDriver.selfieUploadPlaceholder')}
              placeholderTextColor="#888888"
              editable={!loading}
              autoCapitalize="none"
            />

            <Text style={styles.label}>{t('auth.registerDriver.payoutAccountLabel')}</Text>
            <TextInput
              style={styles.input}
              value={payoutMethod}
              onChangeText={setPayoutMethod}
              placeholder={t('auth.registerDriver.payoutPlaceholder')}
              placeholderTextColor="#888888"
              editable={!loading}
              autoCapitalize="none"
            />

            <Text style={styles.label}>{t('auth.registerDriver.membershipPaymentLabel')}</Text>
            <TextInput
              style={styles.input}
              value={membershipPaymentMethod}
              onChangeText={setMembershipPaymentMethod}
              placeholder={t('auth.registerDriver.membershipPaymentPlaceholder')}
              placeholderTextColor="#888888"
              editable={!loading}
              autoCapitalize="none"
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
              <Text style={styles.infoTitle}>{t('auth.registerDriver.validationRequiredTitle')}</Text>
              <Text style={styles.infoText}>{t('auth.registerDriver.validationRequiredText')}</Text>
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
                <ActivityIndicator color="#111111" />
              ) : (
                <Text style={styles.buttonText}>{t('auth.registerDriver.submit')}</Text>
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
    color: '#D96C2D',
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  iconWrapper: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#FFF0E8',
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

  chipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },

  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E9E0D4',
  },

  chipActive: {
    backgroundColor: '#D96C2D',
    borderColor: '#D96C2D',
  },

  chipText: {
    color: '#5B5248',
    fontWeight: '700',
    fontSize: 13,
  },

  chipTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: '#FFF0E8',
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
    color: '#6D4A34',
    lineHeight: 20,
  },

  button: {
    backgroundColor: '#D96C2D',
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
