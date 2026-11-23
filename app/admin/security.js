import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getTwoFactorStatus, startTwoFactorSetup, confirmTwoFactor, disableTwoFactor } from '../../services/adminService';
import { isAllowedPaymentUrl } from '../../services/inputGuards';

/** Sécurité du compte administrateur : double authentification par application. */
export default function AdminSecurityScreen() {
  const { t } = useTranslation();
  const { token, role, isAuthenticated } = useAuth() || {};
  const [state, setState] = useState({ loading: true, enabled: false, available: true });
  const [setup, setSetup] = useState(null); // { secret, otpauthUrl }
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await getTwoFactorStatus(token);
      setState({ loading: false, enabled: Boolean(r?.enabled), available: r?.available !== false });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [token]);

  useEffect(() => {
    if (token && role === 'admin') {
      const timer = setTimeout(refresh, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [token, role, refresh]);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      Alert.alert(t('common.error'), error?.status === 401 ? t('admin.security.wrongCode') : error?.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthenticated || role !== 'admin') return <Redirect href="/" />;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={18} color="#084424" />
        </Pressable>
        <Ionicons name="shield-checkmark-outline" size={36} color="#084424" />
        <Text accessibilityRole="header" style={styles.title}>{t('admin.security.title')}</Text>
        <Text style={styles.text}>{t('admin.security.intro')}</Text>

        {state.loading ? (
          <ActivityIndicator color="#084424" />
        ) : backupCodes ? (
          <View style={styles.box}>
            <Text style={styles.strong}>{t('admin.security.backupTitle')}</Text>
            <Text style={styles.text}>{t('admin.security.backupText')}</Text>
            <Text selectable style={styles.codes}>{backupCodes.join('\n')}</Text>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setBackupCodes(null); refresh(); }}>
              <Text style={styles.buttonText}>{t('admin.security.backupDone')}</Text>
            </Pressable>
          </View>
        ) : state.enabled ? (
          <View style={styles.box}>
            <Text style={styles.ok}>● {t('admin.security.enabled')}</Text>
            <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder={t('admin.security.password')} autoCapitalize="none" />
            <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder={t('admin.security.codePlaceholder')} autoCapitalize="none" maxLength={12} />
            <Pressable accessibilityRole="button" disabled={busy} style={[styles.danger, busy && { opacity: 0.6 }]} onPress={() => run(async () => { await disableTwoFactor({ password, code }, token); setPassword(''); setCode(''); await refresh(); })}>
              <Text style={styles.dangerText}>{t('admin.security.disable')}</Text>
            </Pressable>
          </View>
        ) : !state.available ? (
          <Text style={styles.text}>{t('admin.security.unavailable')}</Text>
        ) : setup ? (
          <View style={styles.box}>
            <Text style={styles.strong}>{t('admin.security.step1')}</Text>
            <Pressable accessibilityRole="button" style={styles.ghost} onPress={() => {
              if (isAllowedPaymentUrl(setup.otpauthUrl, { allowOtpauth: true })) {
                Linking.openURL(setup.otpauthUrl).catch(() => {});
              }
            }}>
              <Text style={styles.ghostText}>{t('admin.security.openApp')}</Text>
            </Pressable>
            <Text style={styles.text}>{t('admin.security.manualKey')}</Text>
            <Text selectable style={styles.secret}>{setup.secret}</Text>
            <Text style={styles.strong}>{t('admin.security.step2')}</Text>
            <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" maxLength={6} />
            <Pressable accessibilityRole="button" disabled={busy} style={[styles.button, busy && { opacity: 0.6 }]} onPress={() => run(async () => { const r = await confirmTwoFactor(code, token); setBackupCodes(r?.backupCodes || []); setSetup(null); setCode(''); })}>
              <Text style={styles.buttonText}>{t('admin.security.confirm')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" disabled={busy} style={[styles.button, busy && { opacity: 0.6 }]} onPress={() => run(async () => { setSetup(await startTwoFactorSetup(token)); })}>
            <Text style={styles.buttonText}>{t('admin.security.enable')}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: '#FBF6EC', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 520, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, gap: 12, alignItems: 'center' },
  back: { alignSelf: 'flex-start' },
  title: { fontSize: 22, fontWeight: '900', color: '#0D1C11', textAlign: 'center' },
  text: { color: '#606D5D', lineHeight: 21, textAlign: 'center' },
  strong: { color: '#0D1C11', fontWeight: '800' },
  box: { width: '100%', gap: 10, alignItems: 'stretch' },
  ok: { color: '#007E4B', fontWeight: '900', textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#E3DECF', borderRadius: 14, padding: 14, fontSize: 16, color: '#0D1C11' },
  secret: { fontFamily: 'monospace', fontSize: 16, letterSpacing: 2, textAlign: 'center', backgroundColor: '#F2ECE0', padding: 12, borderRadius: 12 },
  codes: { fontFamily: 'monospace', fontSize: 16, textAlign: 'center', backgroundColor: '#F2ECE0', padding: 14, borderRadius: 12, lineHeight: 26 },
  button: { backgroundColor: '#084424', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '900' },
  ghost: { borderWidth: 1, borderColor: '#084424', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  ghostText: { color: '#084424', fontWeight: '800' },
  danger: { backgroundColor: '#C8331A', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  dangerText: { color: '#FFFFFF', fontWeight: '900' },
});
