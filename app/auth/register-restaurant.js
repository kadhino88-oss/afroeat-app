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
  const { t } = useTranslation();
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
      Alert.alert(t('auth.registerRestaurant.restaurantNameInvalidTitle'), t('auth.registerRestaurant.restaurantNameInvalidBody'));
      return;
    }
    if (safeRestaurantLogo.length < 5) {
      Alert.alert(t('auth.registerRestaurant.logoInvalidTitle'), t('auth.registerRestaurant.logoInvalidBody'));
      return;
    }
    if (safeFirstName.length < 2) {
      Alert.alert(t('auth.validation.firstNameInvalidTitle'), t('auth.registerRestaurant.managerFirstNameInvalidBody'));
      return;
    }
    if (safeLastName.length < 2) {
      Alert.alert(t('auth.validation.lastNameInvalidTitle'), t('auth.registerRestaurant.managerLastNameInvalidBody'));
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
    if (safeSiret.length < 5) {
      Alert.alert(t('auth.registerRestaurant.siretInvalidTitle'), t('auth.registerRestaurant.siretInvalidBody'));
      return;
    }
    if (safeIdentityFront.length < 5) {
      Alert.alert(t('auth.registerDriver.idFrontInvalidTitle'), t('auth.registerRestaurant.idFrontInvalidBody'));
      return;
    }
    if (safeIdentityBack.length < 5) {
      Alert.alert(t('auth.registerDriver.idBackInvalidTitle'), t('auth.registerRestaurant.idBackInvalidBody'));
      return;
    }
    if (safePayoutMethod.length < 3) {
      Alert.alert(t('auth.registerDriver.payoutInvalidTitle'), t('auth.registerDriver.payoutInvalidBody'));
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
        t('auth.registerRestaurant.successTitle'),
        t('auth.registerRestaurant.successBody'),
        [
          {
            text: t('auth.validation.ok'),
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
        t('auth.registerClient.failedTitle'),
        error?.message || t('auth.registerRestaurant.failedFallback')
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

            <Text style={styles.eyebrow}>{t('auth.registerRestaurant.eyebrow')}</Text>
            <Text style={styles.title}>{t('auth.registerRestaurant.title')}</Text>
            <Text style={styles.subtitle}>{t('auth.registerRestaurant.subtitle')}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{t('auth.registerRestaurant.restaurantNameLabel')}</Text>
            <TextInput
              style={styles.input}
              value={restaurantName}
              onChangeText={setRestaurantName}
              placeholder={t('auth.registerRestaurant.restaurantNameLabel')}
              placeholderTextColor="#888888"
              editable={!loading}
            />

            <Text style={styles.label}>{t('auth.registerRestaurant.logoLabel')}</Text>
            <TextInput
              style={styles.input}
              value={restaurantLogo}
              onChangeText={setRestaurantLogo}
              placeholder={t('auth.registerRestaurant.logoPlaceholder')}
              placeholderTextColor="#888888"
              editable={!loading}
              autoCapitalize="none"
            />

            <Text style={styles.label}>{t('auth.registerRestaurant.managerFirstNameLabel')}</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder={t('auth.fields.firstName')}
              placeholderTextColor="#888888"
              editable={!loading}
            />

            <Text style={styles.label}>{t('auth.registerRestaurant.managerLastNameLabel')}</Text>
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
              placeholder={t('auth.registerRestaurant.addressPlaceholder')}
              placeholderTextColor="#888888"
              multiline
              textAlignVertical="top"
              editable={!loading}
            />

            <Text style={styles.label}>{t('auth.registerRestaurant.siretLabel')}</Text>
            <TextInput
              style={styles.input}
              value={siret}
              onChangeText={setSiret}
              placeholder={t('auth.registerRestaurant.siretPlaceholder')}
              placeholderTextColor="#888888"
              editable={!loading}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>{t('auth.registerRestaurant.idFrontLabel')}</Text>
            <TextInput
              style={styles.input}
              value={identityFront}
              onChangeText={setIdentityFront}
              placeholder={t('auth.registerDriver.uploadPlaceholder')}
              placeholderTextColor="#888888"
              editable={!loading}
              autoCapitalize="none"
            />

            <Text style={styles.label}>{t('auth.registerRestaurant.idBackLabel')}</Text>
            <TextInput
              style={styles.input}
              value={identityBack}
              onChangeText={setIdentityBack}
              placeholder={t('auth.registerDriver.uploadPlaceholder')}
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
              <Text style={styles.infoTitle}>{t('auth.registerRestaurant.validationPartnerTitle')}</Text>
              <Text style={styles.infoText}>{t('auth.registerRestaurant.validationPartnerText')}</Text>
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
                  {t('auth.registerRestaurant.submit')}
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
