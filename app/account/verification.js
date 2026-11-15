import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../context/AuthContext';
import {
  deleteMyDocument,
  getMyVerification,
  pickAndUploadDocument,
} from '../../services/verificationService';

const STATUS_STYLE = {
  approved: { bg: '#E3F0E8', fg: '#084424', icon: 'checkmark-circle' },
  pending: { bg: '#F3E7CA', fg: '#301904', icon: 'time-outline' },
  rejected: { bg: '#F7DDD7', fg: '#8A2412', icon: 'close-circle' },
  missing: { bg: '#EFEFEA', fg: '#4A5A50', icon: 'cloud-upload-outline' },
};

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

export default function VerificationScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const token = auth.token;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyKind, setBusyKind] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setData(await getMyVerification(token));
    } catch (e) {
      setError(e?.message || t('verification.loadError'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!auth.isAuthenticated) return <Redirect href="/auth/role" />;

  const send = async (kind) => {
    if (!consent) {
      setError(t('verification.consentRequired'));
      return;
    }
    setError('');
    setBusyKind(kind);
    try {
      const document = await pickAndUploadDocument(token, kind, true);
      if (document) await load();
    } catch (e) {
      setError(
        e?.code === 'PERMISSION'
          ? t('verification.permissionError')
          : e?.code === 'TOO_LARGE'
          ? t('verification.tooLargeError')
          : e?.message || t('verification.uploadError')
      );
    } finally {
      setBusyKind('');
    }
  };

  const remove = (doc) => {
    Alert.alert(t('verification.removeTitle'), t('verification.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('verification.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMyDocument(doc.id, token);
            await load();
          } catch (e) {
            setError(e?.message || t('verification.uploadError'));
          }
        },
      },
    ]);
  };

  const required = data?.required || [];
  const documents = data?.documents || [];
  const byKind = Object.fromEntries(documents.map((doc) => [doc.kind, doc]));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('nav.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={styles.back}
      >
        <Ionicons name="arrow-back" size={20} color="#0D1C11" />
      </Pressable>

      <Text style={styles.eyebrow}>AFROEAT</Text>
      <Text style={styles.title}>{t('verification.title')}</Text>
      <Text style={styles.subtitle}>{t('verification.subtitle')}</Text>

      {loading && !data ? <ActivityIndicator style={{ marginTop: 24 }} color="#084424" /> : null}

      {data && data.available === false ? (
        <View style={[styles.banner, { backgroundColor: '#F3E7CA' }]}>
          <Text style={styles.bannerText}>{t('verification.unavailable')}</Text>
        </View>
      ) : null}

      {data?.verified ? (
        <View style={[styles.banner, { backgroundColor: '#E3F0E8' }]}>
          <Ionicons name="shield-checkmark" size={22} color="#084424" />
          <Text style={[styles.bannerText, { color: '#084424' }]}>{t('verification.verifiedBanner')}</Text>
        </View>
      ) : null}

      {required.map((kind) => {
        const doc = byKind[kind];
        const state = doc ? doc.status : 'missing';
        const look = STATUS_STYLE[state];
        const busy = busyKind === kind;
        return (
          <View key={kind} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{t(`verification.kind.${kind}`)}</Text>
              <View style={[styles.badge, { backgroundColor: look.bg }]}>
                <Ionicons name={look.icon} size={14} color={look.fg} />
                <Text style={[styles.badgeText, { color: look.fg }]}>{t(`verification.status.${state}`)}</Text>
              </View>
            </View>
            <Text style={styles.help}>{t(`verification.kindHelp.${kind}`)}</Text>

            {state === 'rejected' && doc?.rejectionReason ? (
              <Text style={styles.reason}>{t('verification.rejectedReason', { reason: doc.rejectionReason })}</Text>
            ) : null}
            {doc?.fileExpiresAt && state !== 'approved' ? (
              <Text style={styles.meta}>{t('verification.deletedOn', { date: formatDate(doc.fileExpiresAt) })}</Text>
            ) : null}

            {state !== 'approved' ? (
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || data?.available === false}
                  onPress={() => send(kind)}
                  style={[styles.primary, (busy || data?.available === false) && styles.disabled]}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryText}>
                      {doc ? t('verification.replace') : t('verification.send')}
                    </Text>
                  )}
                </Pressable>
                {doc ? (
                  <Pressable accessibilityRole="button" onPress={() => remove(doc)} style={styles.secondary}>
                    <Text style={styles.secondaryText}>{t('verification.remove')}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        onPress={() => setConsent((value) => !value)}
        style={styles.consent}
      >
        <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={24} color="#084424" />
        <Text style={styles.consentText}>{t('verification.consentLabel')}</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={18} color="#301904" />
        <View style={{ flex: 1 }}>
          <Text style={styles.privacyTitle}>{t('verification.privacyTitle')}</Text>
          <Text style={styles.privacyText}>
            {t('verification.privacyBody', {
              pending: data?.retention?.pendingDays || 90,
              decided: data?.retention?.decidedDays || 30,
            })}
          </Text>
          <Pressable accessibilityRole="link" onPress={() => router.push('/legal/privacy')}>
            <Text style={styles.link}>{t('verification.privacyLink')}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBF6EC' },
  content: { padding: 22, paddingBottom: 56, maxWidth: 720, width: '100%', alignSelf: 'center' },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFDF9', borderWidth: 1, borderColor: '#E3DECF', marginBottom: 14 },
  eyebrow: { color: '#084424', fontWeight: '900', letterSpacing: 2, fontSize: 12 },
  title: { marginTop: 6, fontSize: 28, lineHeight: 34, color: '#0D1C11', fontWeight: '900' },
  subtitle: { marginTop: 8, color: '#4A5A50', fontSize: 15, lineHeight: 22 },
  banner: { marginTop: 16, flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 12 },
  bannerText: { flex: 1, color: '#301904', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  card: { marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: '#FFFDF9', borderWidth: 1, borderColor: '#E3DECF' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  cardTitle: { color: '#0D1C11', fontWeight: '800', fontSize: 16, flexShrink: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  help: { marginTop: 8, color: '#4A5A50', fontSize: 14, lineHeight: 20 },
  reason: { marginTop: 10, color: '#8A2412', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  meta: { marginTop: 8, color: '#606D5D', fontSize: 12 },
  actions: { marginTop: 14, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  primary: { minHeight: 46, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#084424' },
  primaryText: { color: '#FBF6EC', fontWeight: '800', fontSize: 14 },
  secondary: { minHeight: 46, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E3DECF' },
  secondaryText: { color: '#8A2412', fontWeight: '700', fontSize: 14 },
  disabled: { opacity: 0.5 },
  consent: { marginTop: 20, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  consentText: { flex: 1, color: '#0D1C11', fontSize: 14, lineHeight: 20 },
  error: { marginTop: 12, color: '#8A2412', fontWeight: '700', fontSize: 14 },
  privacy: { marginTop: 22, flexDirection: 'row', gap: 10, padding: 14, borderRadius: 12, backgroundColor: '#F3E7CA' },
  privacyTitle: { color: '#301904', fontWeight: '800', fontSize: 14 },
  privacyText: { marginTop: 4, color: '#301904', fontSize: 13, lineHeight: 19 },
  link: { marginTop: 8, color: '#084424', fontWeight: '800', fontSize: 13 },
});
