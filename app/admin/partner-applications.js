import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { BrandFonts } from '../../constants/brand';
import {
  getAdminPartnerApplications,
  updatePartnerApplication,
} from '../../services/partnerApplicationService';

const FILTERS = ['all', 'new', 'contacted', 'approved', 'rejected'];

const STATUS_TONE = {
  new: { bg: '#F3E7CA', fg: '#301904' },
  contacted: { bg: '#E3EDF7', fg: '#1F4E79' },
  approved: { bg: '#E3F0E8', fg: '#084424' },
  rejected: { bg: '#F8E1DD', fg: '#8E2415' },
};

const openLink = (url) => {
  Linking.openURL(url).catch(() => {});
};

export default function AdminPartnerApplicationsScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const [filter, setFilter] = useState('new');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(
    async (quiet = false) => {
      if (!auth.token) return;
      if (quiet) setRefreshing(true);
      else setLoading(true);
      try {
        const result = await getAdminPartnerApplications(
          auth.token,
          filter === 'all' ? '' : filter
        );
        setItems(Array.isArray(result?.applications) ? result.applications : []);
      } catch (error) {
        Alert.alert(t('common.error'), error?.message || t('admin.partnerApplications.loadError'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [auth.token, filter, t]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const labels = useMemo(
    () => ({
      type: (value) => t(`partnerApply.type_${value}`, { defaultValue: value }),
      status: (value) => t(`admin.partnerApplications.${value}`, { defaultValue: value }),
    }),
    [t]
  );

  if (auth.loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#084424" size="large" />
      </View>
    );
  }
  if (!auth.isAuthenticated || !auth.token) return <Redirect href="/auth/login?role=admin" />;
  if (String(auth.role || auth.user?.role || '').toLowerCase() !== 'admin') {
    return <Redirect href="/(tabs)" />;
  }

  const setStatus = async (application, status) => {
    try {
      setBusyId(application._id);
      const adminNote = String(notes[application._id] ?? application.adminNote ?? '').trim();
      const result = await updatePartnerApplication(application._id, { status, adminNote }, auth.token);
      if (!result?.application) throw new Error(t('admin.partnerApplications.updateError'));
      // Hors du filtre courant → on retire la carte ; sinon on la met à jour.
      setItems((previous) =>
        previous
          .map((item) => (item._id === application._id ? { ...item, ...result.application } : item))
          .filter((item) => filter === 'all' || item.status === filter)
      );
    } catch (error) {
      Alert.alert(t('common.error'), error?.message || t('admin.partnerApplications.updateError'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button">
        <Ionicons name="arrow-back" size={21} color="#0D1C11" />
      </Pressable>
      <Text style={styles.eyebrow}>AFROEAT · ADMIN</Text>
      <Text style={styles.title}>{t('admin.common.partnerApplicationsTitle')}</Text>
      <Text style={styles.subtitle}>{t('admin.partnerApplications.subtitle')}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((key) => (
          <Pressable
            key={key}
            onPress={() => setFilter(key)}
            style={[styles.chip, filter === key && styles.chipActive]}
            accessibilityRole="button"
          >
            <Text style={[styles.chipText, filter === key && styles.chipTextActive]}>
              {t(`admin.partnerApplications.${key}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading && items.length === 0 ? (
        <ActivityIndicator color="#084424" size="large" style={styles.loader} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="storefront-outline" size={32} color="#606D5D" />
          <Text style={styles.emptyText}>{t('admin.partnerApplications.empty')}</Text>
        </View>
      ) : (
        items.map((application, index) => {
          const tone = STATUS_TONE[application.status] || STATUS_TONE.new;
          const busy = busyId === application._id;
          return (
            <FadeInView key={application._id} delay={Math.min(index, 6) * 60} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardHeading}>
                  <Text style={styles.business}>{application.businessName}</Text>
                  <Text style={styles.meta}>
                    {labels.type(application.businessType)} · {application.city}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.badgeText, { color: tone.fg }]}>
                    {labels.status(application.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.meta}>
                {application.createdAt ? new Date(application.createdAt).toLocaleString() : ''}
              </Text>
              <Text style={styles.line}>{application.address}</Text>

              <View style={styles.contactRow}>
                <Text style={styles.contactName}>{application.contactName}</Text>
                <Pressable onPress={() => openLink(`tel:${application.phone}`)} style={styles.contactBtn}>
                  <Ionicons name="call-outline" size={15} color="#084424" />
                  <Text style={styles.contactText}>{application.phone}</Text>
                </Pressable>
                <Pressable onPress={() => openLink(`mailto:${application.email}`)} style={styles.contactBtn}>
                  <Ionicons name="mail-outline" size={15} color="#084424" />
                  <Text style={styles.contactText}>{application.email}</Text>
                </Pressable>
                {application.website ? (
                  <Pressable onPress={() => openLink(application.website)} style={styles.contactBtn}>
                    <Ionicons name="globe-outline" size={15} color="#084424" />
                    <Text style={styles.contactText}>{t('admin.partnerApplications.website')}</Text>
                  </Pressable>
                ) : null}
              </View>

              {application.message ? <Text style={styles.message}>{application.message}</Text> : null}

              <TextInput
                value={notes[application._id] ?? application.adminNote ?? ''}
                onChangeText={(value) => setNotes((previous) => ({ ...previous, [application._id]: value }))}
                placeholder={t('admin.partnerApplications.notePlaceholder')}
                placeholderTextColor="#8A8F85"
                multiline
                maxLength={1000}
                style={styles.note}
                accessibilityLabel={t('admin.partnerApplications.notePlaceholder')}
              />

              <View style={styles.actions}>
                <Pressable
                  disabled={busy}
                  onPress={() => setStatus(application, 'contacted')}
                  style={[styles.action, styles.actionGhost]}
                >
                  <Text style={styles.actionGhostText}>{t('admin.partnerApplications.markContacted')}</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  onPress={() => setStatus(application, 'rejected')}
                  style={[styles.action, styles.actionReject]}
                >
                  <Text style={styles.actionRejectText}>{t('admin.partnerApplications.reject')}</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  onPress={() => setStatus(application, 'approved')}
                  style={[styles.action, styles.actionApprove]}
                >
                  {busy ? (
                    <ActivityIndicator color="#FBF6EC" />
                  ) : (
                    <Text style={styles.actionApproveText}>{t('admin.partnerApplications.approve')}</Text>
                  )}
                </Pressable>
              </View>
            </FadeInView>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBF6EC' },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FBF6EC' },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFFDF9', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#E3DECF' },
  eyebrow: { color: '#C8331A', fontSize: 11, letterSpacing: 1.5, fontWeight: '900' },
  title: { color: '#0D1C11', fontSize: 28, marginTop: 7, fontFamily: BrandFonts.display },
  subtitle: { color: '#606D5D', fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 16 },
  filters: { gap: 8, paddingBottom: 16 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#F2ECE0', borderWidth: 1, borderColor: '#E3DECF' },
  chipActive: { backgroundColor: '#084424', borderColor: '#084424' },
  chipText: { color: '#606D5D', fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: '#FBF6EC' },
  loader: { marginTop: 42 },
  empty: { backgroundColor: '#FFFDF9', borderRadius: 18, padding: 24, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E3DECF' },
  emptyText: { color: '#606D5D', fontSize: 14, textAlign: 'center' },
  card: { backgroundColor: '#FFFDF9', borderRadius: 24, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E3DECF' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  cardHeading: { flex: 1 },
  business: { fontSize: 19, color: '#0D1C11', fontFamily: BrandFonts.display },
  meta: { fontSize: 12, color: '#606D5D', marginTop: 4 },
  badge: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  line: { color: '#0D1C11', fontSize: 14, marginTop: 10 },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' },
  contactName: { color: '#0D1C11', fontWeight: '800', fontSize: 14, marginRight: 4 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#E3F0E8' },
  contactText: { color: '#084424', fontSize: 12, fontWeight: '700' },
  message: { color: '#0D1C11', fontSize: 14, lineHeight: 21, marginTop: 12, backgroundColor: '#F2ECE0', borderRadius: 12, padding: 12 },
  note: { minHeight: 56, borderWidth: 1, borderColor: '#E3DECF', borderRadius: 12, padding: 11, color: '#0D1C11', marginTop: 12, backgroundColor: '#FFFFFF' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  action: { minHeight: 42, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  actionGhost: { backgroundColor: '#F2ECE0' },
  actionGhostText: { color: '#0D1C11', fontWeight: '800', fontSize: 13 },
  actionReject: { backgroundColor: '#F8E1DD' },
  actionRejectText: { color: '#8E2415', fontWeight: '800', fontSize: 13 },
  actionApprove: { backgroundColor: '#084424', flex: 1 },
  actionApproveText: { color: '#FBF6EC', fontWeight: '800', fontSize: 13 },
});
