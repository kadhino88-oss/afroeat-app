import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../context/AuthContext';
import {
  getVerificationFile,
  listVerificationDocuments,
  reviewVerificationDocument,
} from '../../services/verificationService';

const FILTERS = ['pending', 'approved', 'rejected'];

export default function AdminVerificationScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const token = auth.token;

  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [images, setImages] = useState({});
  const [reasons, setReasons] = useState({});
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      setItems(await listVerificationDocuments(status, token));
    } catch (e) {
      setError(e?.message || t('admin.verification.loadError'));
    } finally {
      setLoading(false);
    }
  }, [token, status, t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!auth.isAuthenticated) return <Redirect href="/auth/login?role=admin" />;

  const view = async (id) => {
    try {
      setBusyId(id);
      const dataUrl = await getVerificationFile(id, token);
      setImages((previous) => ({ ...previous, [id]: dataUrl }));
    } catch (e) {
      setError(e?.message || t('admin.verification.fileDeleted'));
    } finally {
      setBusyId('');
    }
  };

  const decide = async (id, decision) => {
    const reason = String(reasons[id] || '').trim();
    if (decision === 'rejected' && reason.length < 3) {
      setError(t('admin.verification.reasonRequired'));
      return;
    }
    try {
      setBusyId(id);
      setError('');
      await reviewVerificationDocument(id, decision, reason, token);
      setImages((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      await load();
    } catch (e) {
      setError(e?.message || t('admin.verification.loadError'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>AFROEAT · ADMIN</Text>
      <Text style={styles.title}>{t('admin.verification.title')}</Text>
      <Text style={styles.subtitle}>{t('admin.verification.subtitle')}</Text>

      <View style={styles.filters}>
        {FILTERS.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            onPress={() => setStatus(value)}
            style={[styles.chip, status === value && styles.chipActive]}
          >
            <Text style={[styles.chipText, status === value && styles.chipTextActive]}>
              {t(`admin.verification.filter.${value}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator style={{ marginTop: 24 }} color="#084424" /> : null}

      {!loading && items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('admin.verification.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('admin.verification.emptyBody')}</Text>
        </View>
      ) : null}

      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>{t(`verification.kind.${item.kind}`)}</Text>
          <Text style={styles.owner}>
            {item.user?.name || '—'} · {item.user?.role} · {item.user?.email}
            {item.user?.phone ? ` · ${item.user.phone}` : ''}
          </Text>
          <Text style={styles.meta}>
            {t('admin.verification.sentOn', { date: new Date(item.createdAt).toLocaleDateString() })}
          </Text>
          {item.status === 'rejected' && item.rejectionReason ? (
            <Text style={styles.meta}>{t('verification.rejectedReason', { reason: item.rejectionReason })}</Text>
          ) : null}

          {!item.fileAvailable ? (
            <Text style={styles.meta}>{t('admin.verification.fileDeleted')}</Text>
          ) : images[item.id] ? (
            <Image source={{ uri: images[item.id] }} style={styles.image} resizeMode="contain" />
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={busyId === item.id}
              onPress={() => view(item.id)}
              style={styles.viewButton}
            >
              {busyId === item.id ? (
                <ActivityIndicator color="#084424" />
              ) : (
                <>
                  <Ionicons name="eye-outline" size={18} color="#084424" />
                  <Text style={styles.viewText}>{t('admin.verification.view')}</Text>
                </>
              )}
            </Pressable>
          )}
          {item.fileAvailable && !images[item.id] ? (
            <Text style={styles.meta}>{t('admin.verification.viewLogged')}</Text>
          ) : null}

          {item.status === 'pending' ? (
            <View style={styles.decision}>
              <TextInput
                value={reasons[item.id] || ''}
                onChangeText={(value) => setReasons((previous) => ({ ...previous, [item.id]: value }))}
                placeholder={t('admin.verification.reasonPlaceholder')}
                placeholderTextColor="#606D5D"
                maxLength={500}
                style={styles.input}
              />
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busyId === item.id}
                  onPress={() => decide(item.id, 'approved')}
                  style={styles.approve}
                >
                  <Text style={styles.approveText}>{t('admin.verification.approve')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busyId === item.id}
                  onPress={() => decide(item.id, 'rejected')}
                  style={styles.reject}
                >
                  <Text style={styles.rejectText}>{t('admin.verification.reject')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBF6EC' },
  content: { padding: 22, paddingBottom: 56, maxWidth: 900, width: '100%', alignSelf: 'center' },
  eyebrow: { color: '#C8331A', fontWeight: '900', letterSpacing: 2, fontSize: 12 },
  title: { marginTop: 6, fontSize: 28, color: '#0D1C11', fontWeight: '900' },
  subtitle: { marginTop: 8, color: '#4A5A50', fontSize: 15, lineHeight: 22 },
  filters: { marginTop: 18, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#F3E7CA' },
  chipActive: { backgroundColor: '#084424' },
  chipText: { color: '#301904', fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: '#FBF6EC' },
  error: { marginTop: 12, color: '#8A2412', fontWeight: '700' },
  empty: { marginTop: 18, padding: 20, borderRadius: 14, backgroundColor: '#FFFFFF' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0D1C11' },
  emptyBody: { marginTop: 6, color: '#4A5A50', lineHeight: 20 },
  card: { marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3DECF' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0D1C11' },
  owner: { marginTop: 6, color: '#0D1C11', fontSize: 14 },
  meta: { marginTop: 6, color: '#606D5D', fontSize: 12 },
  image: { marginTop: 12, width: '100%', height: 420, borderRadius: 10, backgroundColor: '#F2ECE0' },
  viewButton: { marginTop: 12, minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#084424' },
  viewText: { color: '#084424', fontWeight: '800' },
  decision: { marginTop: 14 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#E3DECF', borderRadius: 10, paddingHorizontal: 12, color: '#0D1C11' },
  row: { marginTop: 10, flexDirection: 'row', gap: 10 },
  approve: { flex: 1, minHeight: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#084424' },
  approveText: { color: '#FBF6EC', fontWeight: '800' },
  reject: { flex: 1, minHeight: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7DDD7' },
  rejectText: { color: '#8A2412', fontWeight: '800' },
});
