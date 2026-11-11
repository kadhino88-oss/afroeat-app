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
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { apiPost } from '../../services/apiClient';
import { API_ENDPOINTS } from '../../constants/api';

const isStrong = (value) =>
  value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const token = String(params?.token || '').trim();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const tokenValid = /^[a-f0-9]{64}$/.test(token);

  const submit = async () => {
    if (busy) return;
    if (!isStrong(password)) return setError(t('changePassword.errorWeak'));
    if (password !== confirm) return setError(t('changePassword.errorMismatch'));
    setError('');
    try {
      setBusy(true);
      await apiPost(API_ENDPOINTS.auth.resetPassword, { token, password });
      setDone(true);
    } catch (e) {
      setError(e?.status === 400 ? t('resetPassword.invalidLink') : e?.message || t('changePassword.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const goLogin = () => router.replace('/auth/role');

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('resetPassword.title')}</Text>

        {!tokenValid ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{t('resetPassword.invalidLink')}</Text>
            <Pressable style={styles.button} onPress={() => router.replace('/auth/forgot-password')} accessibilityRole="button">
              <Text style={styles.buttonText}>{t('resetPassword.requestNew')}</Text>
            </Pressable>
          </View>
        ) : done ? (
          <View style={styles.success}>
            <Text style={styles.successText}>{t('resetPassword.success')}</Text>
            <Pressable style={styles.button} onPress={goLogin} accessibilityRole="button">
              <Text style={styles.buttonText}>{t('resetPassword.goLogin')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>{t('changePassword.newLabel')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              autoCapitalize="none"
            />
            <Text style={styles.hint}>{t('changePassword.rules')}</Text>
            <Text style={styles.label}>{t('changePassword.confirmLabel')}</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              autoCapitalize="none"
              onSubmitEditing={submit}
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={styles.button} onPress={submit} disabled={busy} accessibilityRole="button">
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{t('changePassword.submit')}</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EC' },
  content: { padding: 20, paddingTop: 48, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { color: '#0D1C11', fontSize: 26, fontWeight: '900', marginBottom: 18 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16 },
  label: { color: '#0D1C11', fontWeight: '800', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E3DECF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#FFFDF9' },
  hint: { color: '#606D5D', fontSize: 12, marginTop: 6, lineHeight: 17 },
  error: { color: '#C8331A', marginTop: 12, fontSize: 13 },
  button: { backgroundColor: '#084424', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  success: { backgroundColor: '#E3F0E8', borderRadius: 18, padding: 18 },
  successText: { color: '#084424', fontWeight: '700', lineHeight: 21 },
  errorBox: { backgroundColor: '#F8E1DD', borderRadius: 18, padding: 18 },
  errorBoxText: { color: '#C8331A', fontWeight: '700', lineHeight: 21 },
});
