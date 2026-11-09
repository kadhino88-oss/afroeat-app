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
import { getAdminSupportTickets, updateSupportTicket } from '../../services/supportService';

export default function AdminSupportScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const [tickets, setTickets] = useState([]);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState('');

  const loadTickets = useCallback(async (quiet = false) => {
    if (!auth.token) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await getAdminSupportTickets(auth.token);
      setTickets(Array.isArray(result?.tickets) ? result.tickets : []);
    } catch (error) {
      Alert.alert(t('common.error'), error?.message || t('admin.support.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [auth.token, t]);

  useFocusEffect(useCallback(() => {
    loadTickets();
  }, [loadTickets]));

  if (auth.loading) {
    return <View style={styles.center}><ActivityIndicator color="#5A32A3" size="large" /></View>;
  }
  if (!auth.isAuthenticated || !auth.token) return <Redirect href="/auth/login?role=admin" />;
  if (String(auth.role || auth.user?.role || '').toLowerCase() !== 'admin') return <Redirect href="/(tabs)" />;

  const update = async (ticket, status) => {
    try {
      setUpdatingId(ticket._id);
      const result = await updateSupportTicket(ticket._id, {
        status,
        adminResponse: String(responses[ticket._id] || '').trim(),
      }, auth.token);
      if (!result?.ticket) throw new Error(t('admin.support.updateError'));
      setTickets((previous) => previous.map((item) => item._id === ticket._id ? { ...item, ...result.ticket, user: item.user } : item));
      setResponses((previous) => ({ ...previous, [ticket._id]: '' }));
    } catch (error) {
      Alert.alert(t('common.error'), error?.message || t('admin.support.updateError'));
    } finally {
      setUpdatingId('');
    }
  };

  const categoryLabel = (category) => t(`profile.help.categories.${category}`, { defaultValue: category });
  const statusLabel = (status) => t(`profile.help.status.${status}`, { defaultValue: status });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTickets(true)} />}
    >
      <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
        <Ionicons name="arrow-back" size={21} color="#0D1C11" />
      </Pressable>
      <Text style={styles.eyebrow}>AFROEAT · ADMIN</Text>
      <Text style={styles.title}>{t('admin.common.supportTitle')}</Text>
      <Text style={styles.subtitle}>{t('admin.support.subtitle')}</Text>

      {loading && tickets.length === 0 ? (
        <ActivityIndicator color="#5A32A3" size="large" style={styles.loader} />
      ) : tickets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="chatbubble-ellipses-outline" size={32} color="#8A4B12" />
          <Text style={styles.emptyText}>{t('admin.support.empty')}</Text>
        </View>
      ) : tickets.map((ticket) => (
        <View key={ticket._id} style={styles.ticketCard}>
          <View style={styles.ticketTop}>
            <View style={styles.ticketHeading}>
              <Text style={styles.subject}>{ticket.subject}</Text>
              <Text style={styles.meta}>{ticket.user?.name || t('admin.support.unknownUser')} · {ticket.user?.email || ''}</Text>
            </View>
            <Text style={[styles.status, ticket.status === 'resolved' && styles.statusResolved]}>{statusLabel(ticket.status)}</Text>
          </View>
          <Text style={styles.meta}>{categoryLabel(ticket.category)} · {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : ''}</Text>
          <Text style={styles.message}>{ticket.message}</Text>

          {!!ticket.adminResponse && (
            <View style={styles.existingResponse}>
              <Text style={styles.responseLabel}>{t('admin.support.currentResponse')}</Text>
              <Text style={styles.responseText}>{ticket.adminResponse}</Text>
            </View>
          )}

          {ticket.status !== 'resolved' && (
            <>
              <TextInput
                value={responses[ticket._id] || ''}
                onChangeText={(value) => setResponses((previous) => ({ ...previous, [ticket._id]: value }))}
                placeholder={t('admin.support.responsePlaceholder')}
                placeholderTextColor="#918A82"
                multiline
                maxLength={2000}
                textAlignVertical="top"
                style={styles.responseInput}
                accessibilityLabel={t('admin.support.responsePlaceholder')}
              />
              <View style={styles.actions}>
                <Pressable
                  disabled={updatingId === ticket._id}
                  onPress={() => update(ticket, 'in_progress')}
                  style={[styles.actionButton, styles.progressButton]}
                >
                  <Text style={[styles.actionText, styles.progressText]}>{t('admin.support.markInProgress')}</Text>
                </Pressable>
                <Pressable
                  disabled={updatingId === ticket._id}
                  onPress={() => update(ticket, 'resolved')}
                  style={[styles.actionButton, styles.resolveButton]}
                >
                  {updatingId === ticket._id ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.actionText, styles.resolveText]}>{t('admin.support.resolve')}</Text>}
                </Pressable>
              </View>
            </>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F4FB' },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F4FB' },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  eyebrow: { color: '#8A4B12', fontSize: 11, letterSpacing: 1.5, fontWeight: '900' },
  title: { color: '#1D1B20', fontSize: 27, fontWeight: '900', marginTop: 7 },
  subtitle: { color: '#6C6670', fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 18 },
  loader: { marginTop: 42 },
  emptyCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 24, alignItems: 'center', gap: 10 },
  emptyText: { color: '#5B5350', fontSize: 14, textAlign: 'center' },
  ticketCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E9E3EF' },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  ticketHeading: { flex: 1 },
  subject: { fontSize: 16, lineHeight: 21, color: '#201D22', fontWeight: '900' },
  meta: { fontSize: 11, lineHeight: 16, color: '#77717A', marginTop: 5 },
  status: { color: '#9A4E13', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  statusResolved: { color: '#084424' },
  message: { color: '#38343B', fontSize: 14, lineHeight: 21, marginTop: 13 },
  existingResponse: { backgroundColor: '#F7F4FB', borderRadius: 10, padding: 12, marginTop: 12 },
  responseLabel: { color: '#5A32A3', fontSize: 11, fontWeight: '900', marginBottom: 5 },
  responseText: { color: '#38343B', fontSize: 13, lineHeight: 19 },
  responseInput: { minHeight: 78, borderWidth: 1, borderColor: '#DDD5E5', borderRadius: 11, padding: 11, color: '#28242B', marginTop: 14 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 10 },
  actionButton: { minHeight: 42, borderRadius: 11, paddingHorizontal: 13, justifyContent: 'center', alignItems: 'center' },
  progressButton: { backgroundColor: '#F1EAFE' },
  resolveButton: { backgroundColor: '#5A32A3', flex: 1 },
  actionText: { fontSize: 12, fontWeight: '900' },
  progressText: { color: '#5A32A3' },
  resolveText: { color: '#FFF' },
});
