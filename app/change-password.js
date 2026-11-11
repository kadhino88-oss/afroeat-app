import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../context/AuthContext';
import { apiPut } from '../services/apiClient';

const isStrong = (value) =>
  value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const { token, isAuthenticated } = useAuth() || {};
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!isAuthenticated) return <Redirect href="/auth/role" />;

  const submit = async () => {
    if (busy) return;
    setError('');
    if (!current || !next || !confirm) return setError(t('changePassword.errorRequired'));
    if (!isStrong(next)) return setError(t('changePassword.errorWeak'));
    if (next !== confirm) return setError(t('changePassword.errorMismatch'));
    if (next === current) return setError(t('changePassword.errorSame'));

    try {
      setBusy(true);
      await apiPut('/users/me/password', { currentPassword: current, newPassword: next }, token);
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e) {
      setError(e?.status === 401 ? t('changePassword.errorIncorrect') : e?.message || t('changePassword.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.back} onPress={goBack} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={21} color="#0D1C11" />
        </Pressable>
        <Text style={styles.title}>{t('changePassword.title')}</Text>
        <Text style={styles.subtitle}>{t('changePassword.subtitle')}</Text>

        {done ? (
          <View style={styles.success}>
            <Ionicons name="checkmark-circle" size={26} color="#084424" />
            <Text style={styles.successText}>{t('changePassword.success')}</Text>
            <Pressable style={styles.button} onPress={goBack} accessibilityRole="button">
              <Text style={styles.buttonText}>{t('changePassword.done')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>{t('changePassword.currentLabel')}</Text>
            <TextInput
              style={styles.input}
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              autoCapitalize="none"
            />
            <Text style={styles.label}>{t('changePassword.newLabel')}</Text>
            <TextInput
              style={styles.input}
              value={next}
              onChangeText={setNext}
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
  content: { padding: 20, maxWidth: 560, width: '100%', alignSelf: 'center' },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFFDF9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E3DECF', marginBottom: 16 },
  title: { color: '#0D1C11', fontSize: 26, fontWeight: '900' },
  subtitle: { color: '#606D5D', fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16 },
  label: { color: '#0D1C11', fontWeight: '800', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E3DECF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#FFFDF9' },
  hint: { color: '#606D5D', fontSize: 12, marginTop: 6, lineHeight: 17 },
  error: { color: '#C8331A', marginTop: 12, fontSize: 13 },
  button: { backgroundColor: '#084424', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  success: { backgroundColor: '#E3F0E8', borderRadius: 18, padding: 20, alignItems: 'center', gap: 8 },
  successText: { color: '#084424', fontWeight: '800', textAlign: 'center' },
});
