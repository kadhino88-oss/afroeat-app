import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { listErrorEvents, resolveErrorEvent } from '../../services/adminService';

/** Surveillance : erreurs de l'API et du site, regroupées, avec nombre d'occurrences. */
const formatDate = (value) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
};

export default function AdminErrorsScreen() {
  const { t } = useTranslation();
  const { token, role, isAuthenticated } = useAuth() || {};
  const [data, setData] = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(
    async (resolved = showResolved) => {
      try {
        setData(await listErrorEvents(token, { resolved }));
      } catch (error) {
        setData({ errors: [], stats: { open: 0, last24h: 0 } });
        Alert.alert(t('common.error'), error?.message || t('common.error'));
      }
    },
    [token, t, showResolved]
  );

  useFocusEffect(
    useCallback(() => {
      if (token && role === 'admin') load();
    }, [token, role, load])
  );

  const toggleResolved = () => {
    const next = !showResolved;
    setShowResolved(next);
    setData(null);
    load(next);
  };

  const resolve = async (item) => {
    try {
      await resolveErrorEvent(item._id, token);
      await load();
    } catch (error) {
      Alert.alert(t('common.error'), error?.message || t('common.error'));
    }
  };

  if (!isAuthenticated || role !== 'admin') return <Redirect href="/" />;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.col}>
        <Text accessibilityRole="header" style={styles.title}>{t('admin.errors.title')}</Text>
        <Text style={styles.muted}>{t('admin.errors.intro')}</Text>

        {data ? (
          <View style={styles.row}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{data.stats.open}</Text>
              <Text style={styles.muted}>{t('admin.errors.open')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{data.stats.last24h}</Text>
              <Text style={styles.muted}>{t('admin.errors.last24h')}</Text>
            </View>
          </View>
        ) : null}

        <Pressable accessibilityRole="button" onPress={toggleResolved} style={styles.chip}>
          <Text style={styles.chipText}>{showResolved ? t('admin.errors.hideResolved') : t('admin.errors.showResolved')}</Text>
        </Pressable>

        {data === null ? (
          <ActivityIndicator color="#084424" />
        ) : data.errors.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.ok}>{t('admin.errors.empty')}</Text>
          </View>
        ) : (
          data.errors.map((item) => (
            <View key={item._id} style={styles.card}>
              <Pressable accessibilityRole="button" onPress={() => setExpanded(expanded === item._id ? null : item._id)}>
                <View style={styles.row}>
                  <Text style={[styles.badge, item.source === 'web' ? styles.badgeWeb : styles.badgeApi]}>
                    {item.source === 'web' ? t('admin.errors.web') : t('admin.errors.api')}
                  </Text>
                  {item.status ? <Text style={styles.muted}>{item.status}</Text> : null}
                  <Text style={styles.muted}>× {item.count}</Text>
                  {item.resolvedAt ? <Text style={styles.ok}>{t('admin.errors.resolved')}</Text> : null}
                </View>
                <Text style={styles.message} numberOfLines={expanded === item._id ? undefined : 2}>{item.message}</Text>
                <Text style={styles.muted}>{[item.method, item.path].filter(Boolean).join(' ')}</Text>
                <Text style={styles.muted}>{t('admin.errors.lastSeen', { date: formatDate(item.lastSeenAt) })}</Text>
                {expanded === item._id ? (
                  <>
                    {item.lastUserRole ? <Text style={styles.muted}>{t('admin.errors.role', { role: item.lastUserRole })}</Text> : null}
                    {item.lastRequestId ? <Text style={styles.muted}>{item.lastRequestId}</Text> : null}
                    {item.stack ? <Text style={styles.stack}>{item.stack}</Text> : null}
                  </>
                ) : null}
              </Pressable>
              {!item.resolvedAt ? (
                <Pressable accessibilityRole="button" onPress={() => resolve(item)} style={styles.button}>
                  <Text style={styles.buttonText}>{t('admin.errors.markResolved')}</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: '#FBF6EC', alignItems: 'center', padding: 20 },
  col: { width: '100%', maxWidth: 760, gap: 14 },
  title: { fontSize: 26, fontWeight: '900', color: '#0D1C11' },
  muted: { color: '#606D5D', lineHeight: 20 },
  ok: { color: '#084424', fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 8 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  stat: { flex: 1, minWidth: 140, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16 },
  statValue: { fontSize: 28, fontWeight: '900', color: '#0D1C11' },
  chip: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#E3DECF', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { color: '#0D1C11', fontWeight: '700' },
  badge: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, fontWeight: '800', overflow: 'hidden' },
  badgeApi: { backgroundColor: '#FDECEA', color: '#9B1C1C' },
  badgeWeb: { backgroundColor: '#FFF4D6', color: '#7A5200' },
  message: { fontSize: 15, fontWeight: '700', color: '#0D1C11', marginTop: 6 },
  stack: { fontFamily: 'monospace', fontSize: 12, color: '#3D4A3B', backgroundColor: '#F5F2EA', padding: 10, borderRadius: 10 },
  button: { alignSelf: 'flex-start', backgroundColor: '#EAB02F', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  buttonText: { color: '#0D1C11', fontWeight: '900' },
});
