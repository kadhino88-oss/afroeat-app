import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  Redirect,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../context/AuthContext';
import {
  getPayoutReconciliation,
  retryPayoutReconciliation,
  resolvePayoutReconciliation,
} from '../../services/stripeConnectService';

const formatMoney = (amount, currency) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return String(amount || 0) + ' ' + String(currency || '');
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: String(currency || 'EUR').toUpperCase(),
    }).format(value);
  } catch {
    return value.toFixed(2) + ' ' + String(currency || 'EUR');
  }
};

export default function AdminPayoutsScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [notes, setNotes] = useState({});

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (!auth.token) {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await getPayoutReconciliation(auth.token);
      setOrders(Array.isArray(result?.orders) ? result.orders : []);
    } catch (error) {
      Alert.alert(t('common.error'), error?.message || t('payouts.reconciliationLoadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [auth.token, t]);

  useFocusEffect(useCallback(() => { loadOrders(); }, [loadOrders]));

  if (auth.loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#5A32A3" /></View>;
  }
  if (!auth.isAuthenticated || !auth.token) return <Redirect href="/auth/login?role=admin" />;
  if (!['admin', 'administrator', 'superadmin', 'super-admin'].includes(String(auth.role || auth.user?.role || '').toLowerCase())) {
    return <Redirect href="/(tabs)" />;
  }

  const retry = async (orderId) => {
    try {
      setBusyId(orderId);
      const result = await retryPayoutReconciliation(orderId, auth.token);
      Alert.alert('AFROEAT', result?.success ? t('payouts.retryDone') : t('payouts.retryFailed'));
      await loadOrders(true);
    } catch (error) {
      Alert.alert(t('common.error'), error?.message || t('payouts.retryFailed'));
      await loadOrders(true);
    } finally {
      setBusyId('');
    }
  };

  const resolve = async (orderId) => {
    const note = String(notes[orderId] || '').trim();
    if (note.length < 10 || note.length > 500) {
      Alert.alert(t('common.error'), t('payouts.resolutionNoteError'));
      return;
    }
    try {
      setBusyId(orderId);
      await resolvePayoutReconciliation(orderId, note, auth.token);
      setNotes((current) => ({ ...current, [orderId]: '' }));
      Alert.alert('AFROEAT', t('payouts.retryDone'));
      await loadOrders(true);
    } catch (error) {
      Alert.alert(t('common.error'), error?.message || t('payouts.retryFailed'));
      await loadOrders(true);
    } finally {
      setBusyId('');
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadOrders(true)} />}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={21} color="#28212F" />
      </Pressable>
      <Text style={styles.eyebrow}>AFROEAT · ADMIN</Text>
      <Text style={styles.title}>{t('payouts.reconciliationTitle')}</Text>
      <Text style={styles.subtitle}>{t('payouts.reconciliationSubtitle')}</Text>

      {loading ? <ActivityIndicator size="large" color="#5A32A3" /> : orders.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={30} color="#1F6F43" />
          <Text style={styles.emptyText}>{t('payouts.reconciliationEmpty')}</Text>
        </View>
      ) : orders.map((order) => {
        const orderId = String(order.orderId || order._id || '');
        const busy = busyId === orderId;
        return (
          <View key={orderId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderId} numberOfLines={1}>{orderId}</Text>
              <Text style={styles.amount}>{formatMoney(order.totalPrice, order.currency)}</Text>
            </View>
            <Text style={styles.meta}>{order.paymentMethod || '—'} · {order.paymentStatus || '—'} · {order.status || '—'}</Text>
            {!!order.reason && <Text style={styles.reason}>{order.reason}</Text>}

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => retry(orderId)}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="refresh-outline" size={18} color="#fff" />}
              <Text style={styles.primaryText}>{t('payouts.reconciliationRetry')}</Text>
            </Pressable>

            <TextInput
              value={notes[orderId] || ''}
              onChangeText={(value) => setNotes((current) => ({ ...current, [orderId]: value.slice(0, 500) }))}
              multiline
              maxLength={500}
              placeholder={t('payouts.resolutionNotePlaceholder')}
              placeholderTextColor="#8A8494"
              style={styles.note}
              accessibilityLabel={t('payouts.resolutionNotePlaceholder')}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => resolve(orderId)}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed, busy && styles.disabled]}
            >
              <Text style={styles.secondaryText}>{t('payouts.reconciliationResolve')}</Text>
            </Pressable>
          </View>
        );
      })}
      <Pressable accessibilityRole="button" disabled={loading || refreshing} onPress={() => loadOrders(true)} style={styles.refresh}>
        <Ionicons name="refresh-outline" size={18} color="#5A32A3" />
        <Text style={styles.refreshText}>{t('payouts.refreshButton')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F4FB' },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F4FB' },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  eyebrow: { color: '#5A32A3', fontSize: 11, letterSpacing: 1.1, fontWeight: '900', marginBottom: 8 },
  title: { color: '#2B2238', fontSize: 25, lineHeight: 31, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: '#665D72', fontSize: 14, lineHeight: 20, marginBottom: 18 },
  empty: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', gap: 10 },
  emptyText: { color: '#3E3748', textAlign: 'center', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  orderId: { color: '#4C4359', fontSize: 12, flex: 1, fontWeight: '700' },
  amount: { color: '#2B2238', fontWeight: '900', fontSize: 15 },
  meta: { color: '#777083', fontSize: 12, marginTop: 8, marginBottom: 10 },
  reason: { color: '#8D3B2F', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  primary: { minHeight: 45, borderRadius: 11, backgroundColor: '#5A32A3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  primaryText: { color: '#fff', fontWeight: '800' },
  note: { borderWidth: 1, borderColor: '#DDD6E8', borderRadius: 10, minHeight: 72, padding: 10, color: '#2B2238', marginTop: 12, textAlignVertical: 'top' },
  secondary: { borderWidth: 1, borderColor: '#5A32A3', minHeight: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingHorizontal: 12 },
  secondaryText: { color: '#5A32A3', fontWeight: '800', fontSize: 13 },
  refresh: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, minHeight: 46 },
  refreshText: { color: '#5A32A3', fontWeight: '800' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.82 },
});
