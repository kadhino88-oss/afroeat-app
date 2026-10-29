import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';

import { useAuth } from '../../context/AuthContext';
import {
  createStripeConnectDashboardLink,
  createStripeConnectOnboardingLink,
  getStripeConnectStatus,
} from '../../services/stripeConnectService';

export default function PayoutsScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const [countryCode, setCountryCode] = useState(String(auth.user?.countryCode || '').toUpperCase());
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!auth.token) {
      setLoading(false);
      return;
    }
    try {
      const result = await getStripeConnectStatus(auth.token);
      setStatus(result);
      if (result?.countryCode) setCountryCode(String(result.countryCode).toUpperCase());
    } catch (error) {
      Alert.alert(t('common.error'), error?.message || t('payouts.statusError'));
    } finally {
      setLoading(false);
    }
  }, [auth.token, t]);

  useFocusEffect(useCallback(() => { loadStatus(); }, [loadStatus]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadStatus();
    });
    return () => subscription.remove();
  }, [loadStatus]);

  if (auth.loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1F6F43" /></View>;
  }
  if (!auth.isAuthenticated || !auth.token) return <Redirect href="/auth/role" />;
  if (!['restaurant', 'livreur'].includes(String(auth.role || auth.user?.role || '').toLowerCase())) {
    return <Redirect href="/(tabs)" />;
  }

  const startOnboarding = async () => {
    const normalizedCountry = countryCode.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalizedCountry)) {
      Alert.alert(t('common.error'), t('payouts.countryCodeError'));
      return;
    }
    try {
      setOpening(true);
      const result = await createStripeConnectOnboardingLink(normalizedCountry, auth.token);
      if (!result?.url) throw new Error(t('payouts.statusError'));
      await WebBrowser.openBrowserAsync(result.url);
      await loadStatus();
    } catch (error) {
      Alert.alert(t('common.error'), error?.message || t('payouts.statusError'));
    } finally {
      setOpening(false);
    }
  };

  const openDashboard = async () => {
    try {
      setOpening(true);
      const result = await createStripeConnectDashboardLink(auth.token);
      if (!result?.url) throw new Error(t('payouts.statusError'));
      await WebBrowser.openBrowserAsync(result.url);
      await loadStatus();
    } catch (error) {
      Alert.alert(t('common.error'), error?.message || t('payouts.statusError'));
    } finally {
      setOpening(false);
    }
  };

  const statusLabel = status?.connected
    ? t('payouts.statusConnected')
    : status?.detailsSubmitted
      ? t('payouts.statusReview')
      : t('payouts.statusIncomplete');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={21} color="#222" />
      </Pressable>
      <Text style={styles.eyebrow}>AFROEAT</Text>
      <Text style={styles.title}>{t('payouts.title')}</Text>
      <Text style={styles.body}>{t('payouts.intro')}</Text>

      <View style={styles.card}>
        {loading ? <ActivityIndicator color="#1F6F43" /> : (
          <>
            <View style={styles.statusRow}>
              <Ionicons name={status?.connected ? 'checkmark-circle' : 'time-outline'} size={23} color={status?.connected ? '#1F6F43' : '#A65D17'} />
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
            {Number(status?.requirementsDueCount) > 0 && (
              <Text style={styles.small}>{t('payouts.requirementsDue', { count: status.requirementsDueCount })}</Text>
            )}
          </>
        )}
      </View>

      {!status?.connected && (
        <View style={styles.card}>
          <Text style={styles.label}>{t('payouts.countryLabel')}</Text>
          <TextInput
            value={countryCode}
            onChangeText={(value) => setCountryCode(value.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={2}
            placeholder={t('payouts.countryPlaceholder')}
            placeholderTextColor="#8C8984"
            editable={!opening}
            accessibilityLabel={t('payouts.countryLabel')}
            style={styles.input}
          />
          <Text style={styles.small}>{t('payouts.countryHelp')}</Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={loading || opening || Boolean(status?.connected)}
        onPress={startOnboarding}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed, (loading || opening || status?.connected) && styles.disabled]}
      >
        {opening ? <ActivityIndicator color="#fff" /> : <Ionicons name="wallet-outline" size={19} color="#fff" />}
        <Text style={styles.primaryText}>{status?.detailsSubmitted ? t('payouts.continueButton') : t('payouts.connectButton')}</Text>
      </Pressable>

      {status?.connected && (
        <Pressable accessibilityRole="link" disabled={opening} onPress={openDashboard} style={styles.link}>
          <Ionicons name="open-outline" size={18} color="#1F6F43" />
          <Text style={styles.linkText}>{t('payouts.manageButton')}</Text>
        </Pressable>
      )}
      <Pressable accessibilityRole="button" disabled={loading || opening} onPress={loadStatus} style={styles.link}>
        <Ionicons name="refresh-outline" size={18} color="#1F6F43" />
        <Text style={styles.linkText}>{t('payouts.refreshButton')}</Text>
      </Pressable>
      <View style={styles.notice}>
        <Ionicons name="lock-closed-outline" size={19} color="#8A4B12" />
        <Text style={styles.noticeText}>{t('payouts.secureNotice')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { padding: 22, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8F0' },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 22 },
  eyebrow: { color: '#1F6F43', fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  title: { fontSize: 28, lineHeight: 34, color: '#1E1E1E', fontWeight: '900', marginBottom: 10 },
  body: { color: '#615D57', fontSize: 15, lineHeight: 22, marginBottom: 18 },
  small: { color: '#6B655E', fontSize: 13, lineHeight: 19, marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { color: '#22221F', fontSize: 16, fontWeight: '800', flex: 1 },
  label: { color: '#282621', fontWeight: '800', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#DDD8D0', borderRadius: 11, minHeight: 50, paddingHorizontal: 14, fontSize: 16, color: '#22221F' },
  primary: { minHeight: 54, borderRadius: 13, backgroundColor: '#1F6F43', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.82 },
  link: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  linkText: { color: '#1F6F43', fontWeight: '800' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFF1DD', borderRadius: 12, padding: 14, marginTop: 8 },
  noticeText: { flex: 1, color: '#6D4A1A', fontSize: 13, lineHeight: 19 },
});
