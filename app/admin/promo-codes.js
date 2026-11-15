import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { createPromoCode, listPromoCodes, setPromoCodeActive } from '../../services/adminService';

/** Administration des codes promo : la remise est financée par la plateforme (plafonnée sur sa marge). */
const EMPTY = { code: '', type: 'percent', value: '', currency: 'CHF', minSubtotal: '', maxUses: '', firstOrderOnly: false };

export default function AdminPromoCodesScreen() {
  const { t } = useTranslation();
  const { token, role, isAuthenticated } = useAuth() || {};
  const [promos, setPromos] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPromos(await listPromoCodes(token));
    } catch (error) {
      setPromos([]);
      Alert.alert(t('common.error'), error?.message || t('common.error'));
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      if (token && role === 'admin') load();
    }, [token, role, load])
  );

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    try {
      setBusy(true);
      await createPromoCode(
        {
          code: form.code,
          type: form.type,
          value: Number(form.value),
          currency: form.type === 'fixed' ? form.currency : undefined,
          minSubtotal: Number(form.minSubtotal) || 0,
          maxUses: Number(form.maxUses) || 0,
          firstOrderOnly: form.firstOrderOnly,
        },
        token
      );
      setForm(EMPTY);
      await load();
    } catch (error) {
      Alert.alert(t('common.error'), error?.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (promo, active) => {
    setPromos((list) => list.map((p) => (p.id === promo.id ? { ...p, active } : p)));
    try {
      await setPromoCodeActive(promo.id, active, token);
    } catch {
      load();
    }
  };

  if (!isAuthenticated || role !== 'admin') return <Redirect href="/" />;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.col}>
        <Text accessibilityRole="header" style={styles.title}>{t('admin.promo.title')}</Text>
        <Text style={styles.muted}>{t('admin.promo.intro')}</Text>

        <View style={styles.card}>
          <TextInput style={styles.input} value={form.code} onChangeText={(v) => set('code')(v.toUpperCase())} placeholder={t('admin.promo.code')} autoCapitalize="characters" maxLength={24} />
          <View style={styles.row}>
            {['percent', 'fixed'].map((type) => (
              <Pressable key={type} accessibilityRole="button" onPress={() => set('type')(type)} style={[styles.chip, form.type === type && styles.chipOn]}>
                <Text style={[styles.chipText, form.type === type && styles.chipTextOn]}>{t(`admin.promo.${type}`)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1 }]} value={form.value} onChangeText={set('value')} placeholder={form.type === 'percent' ? '10' : '5'} keyboardType="decimal-pad" />
            {form.type === 'fixed' ? (
              <View style={styles.row}>
                {['CHF', 'EUR'].map((c) => (
                  <Pressable key={c} accessibilityRole="button" onPress={() => set('currency')(c)} style={[styles.chip, form.currency === c && styles.chipOn]}>
                    <Text style={[styles.chipText, form.currency === c && styles.chipTextOn]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>%</Text>
            )}
          </View>
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1 }]} value={form.minSubtotal} onChangeText={set('minSubtotal')} placeholder={t('admin.promo.minSubtotal')} keyboardType="decimal-pad" />
            <TextInput style={[styles.input, { flex: 1 }]} value={form.maxUses} onChangeText={set('maxUses')} placeholder={t('admin.promo.maxUses')} keyboardType="number-pad" />
          </View>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={styles.label}>{t('admin.promo.firstOrderOnly')}</Text>
            <Switch value={form.firstOrderOnly} onValueChange={set('firstOrderOnly')} />
          </View>
          <Pressable accessibilityRole="button" disabled={busy || form.code.length < 3 || !form.value} onPress={submit} style={[styles.button, (busy || form.code.length < 3 || !form.value) && { opacity: 0.5 }]}>
            <Text style={styles.buttonText}>{t('admin.promo.create')}</Text>
          </Pressable>
        </View>

        {promos === null ? (
          <ActivityIndicator color="#084424" />
        ) : promos.length === 0 ? (
          <Text style={styles.muted}>{t('admin.promo.empty')}</Text>
        ) : (
          promos.map((p) => (
            <View key={p.id} style={styles.card}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.code}>{p.code}</Text>
                  <Text style={styles.muted}>
                    {p.type === 'percent' ? `${p.value} %` : `${p.value} ${p.currency}`}
                    {p.minSubtotal > 0 ? ` · min ${p.minSubtotal}` : ''}
                    {p.firstOrderOnly ? ` · ${t('admin.promo.firstOrderOnly')}` : ''}
                  </Text>
                  <Text style={styles.muted}>{t('admin.promo.used', { used: p.usedCount, max: p.maxUses || '∞' })}</Text>
                </View>
                <Switch value={p.active} onValueChange={(v) => toggle(p, v)} />
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: '#FBF6EC', alignItems: 'center', padding: 20 },
  col: { width: '100%', maxWidth: 640, gap: 14 },
  title: { fontSize: 26, fontWeight: '900', color: '#0D1C11' },
  muted: { color: '#606D5D', lineHeight: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 10 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  input: { borderWidth: 1, borderColor: '#E3DECF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#0D1C11' },
  chip: { borderWidth: 1, borderColor: '#E3DECF', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipOn: { backgroundColor: '#084424', borderColor: '#084424' },
  chipText: { color: '#0D1C11', fontWeight: '700' },
  chipTextOn: { color: '#FFFFFF' },
  label: { color: '#0D1C11', fontWeight: '700' },
  button: { backgroundColor: '#EAB02F', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  buttonText: { color: '#0D1C11', fontWeight: '900' },
  code: { fontSize: 18, fontWeight: '900', color: '#0D1C11', letterSpacing: 1 },
});
