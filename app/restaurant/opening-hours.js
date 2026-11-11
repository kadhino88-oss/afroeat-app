import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../context/AuthContext';
import { Brand, BrandFonts } from '../../constants/brand';
import { getMyRestaurant, updateMyRestaurant } from '../../services/restaurantService';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DEFAULT_SLOT = { closed: false, open: '11:00', close: '22:00' };

/** "9:30" ou "9h30" → "09:30" ; renvoie '' si invalide. */
const normalizeTime = (value) => {
  const match = /^(\d{1,2})\s*[:hH]\s*(\d{2})$/.exec(String(value || '').trim());
  if (!match) return TIME_RE.test(String(value || '').trim()) ? String(value).trim() : '';
  const formatted = `${match[1].padStart(2, '0')}:${match[2]}`;
  return TIME_RE.test(formatted) ? formatted : '';
};

const toState = (openingHours) => {
  const state = {};
  DAYS.forEach((day) => {
    const slot = Array.isArray(openingHours) ? openingHours.find((h) => h.day === day) : null;
    state[day] = slot
      ? { closed: !!slot.isClosed, open: slot.open || DEFAULT_SLOT.open, close: slot.close || DEFAULT_SLOT.close }
      : { ...DEFAULT_SLOT };
  });
  return state;
};

export default function RestaurantOpeningHoursScreen() {
  const { t } = useTranslation();
  const { token } = useAuth() || {};
  const [restaurant, setRestaurant] = useState(null);
  const [hours, setHours] = useState(toState([]));
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const data = await getMyRestaurant(token);
          if (!active) return;
          setRestaurant(data);
          setHours(toState(data?.openingHours));
          setEnabled(Array.isArray(data?.openingHours) && data.openingHours.length > 0);
        } catch (error) {
          if (active) Alert.alert(t('common.error'), error?.message || '');
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [token, t])
  );

  const patch = (day, change) => setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...change } }));

  const save = async () => {
    let payload = [];
    if (enabled) {
      for (const day of DAYS) {
        const slot = hours[day];
        if (slot.closed) {
          payload.push({ day, isClosed: true });
          continue;
        }
        const open = normalizeTime(slot.open);
        const close = normalizeTime(slot.close);
        if (!open || !close || open === close) {
          Alert.alert(t('common.error'), t('restaurant.openingHours.invalid', { day: t(`restaurant.openingHours.day_${day}`) }));
          return;
        }
        payload.push({ day, open, close, isClosed: false });
      }
    }
    try {
      setSaving(true);
      const updated = await updateMyRestaurant(restaurant._id, { openingHours: payload }, token);
      setRestaurant(updated);
      setHours(toState(updated?.openingHours));
      Alert.alert(t('restaurant.openingHours.title'), t('restaurant.openingHours.saved'));
    } catch (error) {
      Alert.alert(t('common.error'), error?.message || '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/restaurant/restaurant-settings'))}
        style={styles.back}
      >
        <Ionicons name="arrow-back" size={21} color={Brand.foreground} />
      </Pressable>
      <Text style={styles.title}>{t('restaurant.openingHours.title')}</Text>
      <Text style={styles.subtitle}>{t('restaurant.openingHours.subtitle')}</Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={Brand.primary} />
      ) : (
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.sectionTitle}>{t('restaurant.openingHours.enable')}</Text>
              <Text style={styles.help}>
                {enabled ? t('restaurant.openingHours.enabledHelp') : t('restaurant.openingHours.disabledHelp')}
              </Text>
            </View>
            <Switch value={enabled} onValueChange={setEnabled} />
          </View>

          {enabled &&
            DAYS.map((day) => (
              <View key={day} style={styles.dayRow}>
                <Text style={styles.dayName}>{t(`restaurant.openingHours.day_${day}`)}</Text>
                <View style={styles.closedWrap}>
                  <Text style={styles.closedLabel}>{t('restaurant.openingHours.closed')}</Text>
                  <Switch value={hours[day].closed} onValueChange={(value) => patch(day, { closed: value })} />
                </View>
                {!hours[day].closed && (
                  <View style={styles.times}>
                    <TextInput
                      style={styles.timeInput}
                      value={hours[day].open}
                      onChangeText={(value) => patch(day, { open: value })}
                      placeholder="11:00"
                      accessibilityLabel={`${t(`restaurant.openingHours.day_${day}`)} ${t('restaurant.openingHours.opensAt')}`}
                      maxLength={5}
                    />
                    <Text style={styles.dash}>–</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={hours[day].close}
                      onChangeText={(value) => patch(day, { close: value })}
                      placeholder="22:00"
                      accessibilityLabel={`${t(`restaurant.openingHours.day_${day}`)} ${t('restaurant.openingHours.closesAt')}`}
                      maxLength={5}
                    />
                  </View>
                )}
              </View>
            ))}

          {enabled && <Text style={styles.help}>{t('restaurant.openingHours.midnightHelp')}</Text>}

          <Pressable
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={save}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving ? <ActivityIndicator color={Brand.primaryForeground} /> : <Text style={styles.buttonText}>{t('restaurant.openingHours.save')}</Text>}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.background },
  content: { padding: 20, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: Brand.card, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: Brand.border },
  title: { fontFamily: BrandFonts.display, fontSize: 28, color: Brand.foreground },
  subtitle: { color: Brand.mutedForeground, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 16 },
  loader: { marginTop: 40 },
  card: { backgroundColor: Brand.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: Brand.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1 },
  sectionTitle: { fontFamily: BrandFonts.displaySemi, fontSize: 16, color: Brand.foreground },
  help: { color: Brand.mutedForeground, fontSize: 12, lineHeight: 17, marginTop: 4 },
  dayRow: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Brand.border, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  dayName: { width: 96, color: Brand.foreground, fontWeight: '800' },
  closedWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  closedLabel: { color: Brand.mutedForeground, fontSize: 13 },
  times: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeInput: { width: 72, borderWidth: 1, borderColor: Brand.border, borderRadius: 10, padding: 8, textAlign: 'center', color: Brand.foreground, backgroundColor: '#FFFFFF' },
  dash: { color: Brand.mutedForeground },
  button: { marginTop: 18, minHeight: 48, borderRadius: 14, backgroundColor: Brand.primary, justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Brand.primaryForeground, fontWeight: '800', fontSize: 15 },
});
