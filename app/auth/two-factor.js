import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { completeTwoFactorLogin } from '../../services/authService';
import { takePendingChallenge, clearPendingChallenge } from '../../services/twoFactorChallenge';

/** Deuxième étape de connexion de l'administrateur : code de l'application d'authentification. */
export default function TwoFactorScreen() {
  const { t } = useTranslation();
  const { login } = useAuth() || {};
  const [challenge] = useState(() => takePendingChallenge());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    if (busy || !code.trim()) return;
    try {
      setBusy(true);
      const { user, token } = await completeTwoFactorLogin({ challengeToken: challenge, code });
      clearPendingChallenge();
      const ok = typeof login === 'function' ? await login(user, token) : false;
      if (!ok) throw new Error(t('auth.login.sessionSaveFailed'));
      router.replace('/admin');
    } catch (error) {
      const expired = error?.data?.code === 'CHALLENGE_EXPIRED';
      Alert.alert(
        t('auth.login.failedTitle'),
        expired ? t('auth.twoFactor.expired') : error?.status === 401 ? t('auth.twoFactor.invalid') : error?.message || t('auth.login.serverErrorFallback')
      );
      if (expired) router.replace('/auth/login?role=admin');
    } finally {
      setBusy(false);
    }
  }, [busy, code, challenge, login, t]);

  if (!challenge) return <Redirect href="/auth/login?role=admin" />;

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Ionicons name="shield-checkmark-outline" size={40} color="#084424" />
        <Text accessibilityRole="header" style={styles.title}>{t('auth.twoFactor.title')}</Text>
        <Text style={styles.hint}>{t('auth.twoFactor.hint')}</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          placeholderTextColor="#9AA597"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          keyboardType="default"
          maxLength={12}
          onSubmitEditing={submit}
          accessibilityLabel={t('auth.twoFactor.title')}
        />
        <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={[styles.button, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{t('auth.twoFactor.submit')}</Text>}
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => { clearPendingChallenge(); router.replace('/auth/login?role=admin'); }}>
          <Text style={styles.link}>{t('auth.twoFactor.cancel')}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FBF6EC', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '900', color: '#0D1C11', textAlign: 'center' },
  hint: { color: '#606D5D', textAlign: 'center', lineHeight: 21 },
  input: { width: '100%', borderWidth: 1, borderColor: '#E3DECF', borderRadius: 14, padding: 14, fontSize: 22, letterSpacing: 4, textAlign: 'center', color: '#0D1C11' },
  button: { width: '100%', backgroundColor: '#084424', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  link: { color: '#606D5D', fontWeight: '700', paddingVertical: 6 },
});
