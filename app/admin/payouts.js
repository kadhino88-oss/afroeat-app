import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { useAuth } from '../../context/AuthContext';
import {
  getPayoutReconciliation,
  retryPayoutReconciliation,
  resolvePayoutReconciliation,
} from '../../services/stripeConnectService';

const formatMoney = (amount, currency) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return String(amount || 0) + ' ' + currency;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return value.toFixed(2) + ' ' + currency;
  }
};

export default function AdminPayoutsScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState({});

  const loadOrders = useCallback(async () => {
    if (!auth.token) return;
    try {
      setLoading(true);
      const result = await getPayoutReconciliation(auth.token);
      setOrders(Array.isArray(result?.orders) ? result.orders : []);
    } catch (error) {
      Alert.alert(t('common.error'), error?.message || t('payouts.reconciliationLoadError'));
    } finally {
      setLoading(false);
    }
  }, [auth.token, t]);

  useFocusEffect(useCallback(() => { loadOrders(); }, [loadOrders]));

  if (auth.loading) return <View style={styles.center}><ActivityIndicator color="#084424" size="large" /></View>;
  if (!auth.isAuthenticated || !auth.token) return <Redirect href="/auth/login?role=admin" />;
  if (String(auth.role || auth.user?.role || '').toLowerCase() !== 'admin') return <Redirect href="/(tabs)" />;

  const retry = async (orderId) => {
    try {
      setRetryingId(orderId);
      const result = await retryPayoutReconciliation(orderId, auth.token);
      if (result?.success) {
        Alert.alert(t('payouts.reconciliationTitle'), t('payouts.retryDone'));
      } else {
        Alert.alert(t('payouts.reconciliationTitle'), t('payouts.retryFailed'));
      }
      await loadOrders();
    } catch (error) {
      Alert.alert(t('payouts.reconciliationTitle'), error?.message || t('payouts.retryFailed'));
    } finally {
      setRetryingId('');
    }
  };

  const resolve = async (orderId) => {
    const note = String(resolutionNotes[orderId] || '').trim();
    if (note.length < 10) {
      Alert.alert(t('payouts.reconciliationTitle'), t('payouts.resolutionNoteError'));
      return;
    }
    try {
      setRetryingId(orderId);
      await resolvePayoutReconciliation(orderId, note, auth.token);
      setResolutionNotes((previous) => ({ ...previous, [orderId]: '' }));
      await loadOrders();
    } catch (error) {
      Alert.alert(t('payouts.reconciliationTitle'), error?.message || t('payouts.retryFailed'));
    } finally {
      setRetryingId('');
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading && orders.length > 0} onRefresh={loadOrders} />}
    >
      <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
        <Ionicons name="arrow-back" size={21} color="#0D1C11" />
      </Pressable>
      <Text style={styles.eyebrow}>AFROEAT · ADMIN</Text>
      <Text style={styles.title}>{t('payouts.reconciliationTitle')}</Text>
      <Text style={styles.subtitle}>{t('payouts.reconciliationSubtitle')}</Text>

      {loading && orders.length === 0 ? (
        <ActivityIndicator color="#084424" size="large" style={styles.loader} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="checkmark-circle-outline" size={32} color="#084424" />
          <Text style={styles.emptyText}>{t('payouts.reconciliationEmpty')}</Text>
        </View>
      ) : orders.map((order) => (
        <View key={order.orderId} style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.orderId}>{t('payouts.orderRef')} {order.orderId.slice(-8).toUpperCase()}</Text>
            <Text style={styles.amount}>{formatMoney(order.totalPrice, order.currency)}</Text>
          </View>
          <Text style={styles.reason}>{order.reason || t('payouts.retryFailed')}</Text>
          <Text style={styles.meta}>{order.status} · {order.paymentStatus} · {order.payoutStatus}</Text>
          <TextInput
            value={resolutionNotes[order.orderId] || ''}
            onChangeText={(value) => setResolutionNotes((previous) => ({ ...previous, [order.orderId]: value }))}
            placeholder={t('payouts.resolutionNotePlaceholder')}
            placeholderTextColor="#606D5D"
            multiline
            maxLength={500}
            editable={retryingId !== order.orderId}
            style={styles.noteInput}
          />
          <Pressable
            accessibilityRole="button"
            disabled={retryingId === order.orderId}
            onPress={() => retry(order.orderId)}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed, retryingId === order.orderId && styles.disabled]}
          >
            {retryingId === order.orderId ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="refresh-outline" size={17} color="#FFFFFF" />}
            <Text style={styles.retryText}>{t('payouts.reconciliationRetry')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={retryingId === order.orderId}
            onPress={() => resolve(order.orderId)}
            style={styles.resolveButton}
          >
            <Text style={styles.resolveText}>{t('payouts.reconciliationResolve')}</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F2ECE0' },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2ECE0' },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  eyebrow: { color: '#084424', fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  title: { color: '#084424', fontSize: 26, fontWeight: '900', marginBottom: 6 },
  subtitle: { color: '#606D5D', fontSize: 14, lineHeight: 21, marginBottom: 18 },
  loader: { marginTop: 34 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 22, alignItems: 'center', gap: 10 },
  emptyText: { color: '#0D1C11', textAlign: 'center', fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 15, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F2ECE0' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  orderId: { color: '#0D1C11', fontWeight: '900' },
  amount: { color: '#084424', fontWeight: '900' },
  reason: { color: '#C8331A', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  meta: { color: '#606D5D', fontSize: 12, marginBottom: 14 },
  retryButton: { backgroundColor: '#084424', borderRadius: 10, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  retryText: { color: '#FFFFFF', fontWeight: '800' },
  noteInput: { borderWidth: 1, borderColor: '#E3DECF', borderRadius: 10, minHeight: 76, padding: 11, color: '#0D1C11', marginBottom: 10, textAlignVertical: 'top' },
  resolveButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  resolveText: { color: '#084424', fontWeight: '800' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
});
