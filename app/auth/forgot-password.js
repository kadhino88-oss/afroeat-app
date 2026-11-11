import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { apiPost } from '../../services/apiClient';
import { API_ENDPOINTS } from '../../constants/api';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (busy) return;
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError(t('forgotPassword.errorEmail'));
      return;
    }
    setError('');
    try {
      setBusy(true);
      await apiPost(API_ENDPOINTS.auth.forgotPassword, { email: value });
      setSent(true);
    } catch (e) {
      setError(e?.message || t('forgotPassword.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/auth/role'));

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('forgotPassword.title')}</Text>
        <Text style={styles.subtitle}>{t('forgotPassword.subtitle')}</Text>

        {sent ? (
          <View style={styles.success}>
            <Text style={styles.successText}>{t('forgotPassword.sent')}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>{t('forgotPassword.emailLabel')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={submit}
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={styles.button} onPress={submit} disabled={busy} accessibilityRole="button">
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{t('forgotPassword.submit')}</Text>}
            </Pressable>
          </View>
        )}

        <Pressable style={styles.link} onPress={goBack} accessibilityRole="button">
          <Text style={styles.linkText}>{t('forgotPassword.backToLogin')}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EC' },
  content: { padding: 20, paddingTop: 48, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { color: '#0D1C11', fontSize: 26, fontWeight: '900' },
  subtitle: { color: '#606D5D', fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16 },
  label: { color: '#0D1C11', fontWeight: '800', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E3DECF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#FFFDF9' },
  error: { color: '#C8331A', marginTop: 10, fontSize: 13 },
  button: { backgroundColor: '#084424', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  success: { backgroundColor: '#E3F0E8', borderRadius: 18, padding: 18 },
  successText: { color: '#084424', fontWeight: '700', lineHeight: 21 },
  link: { alignItems: 'center', marginTop: 18, padding: 8 },
  linkText: { color: '#084424', fontWeight: '800' },
});
