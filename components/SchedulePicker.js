import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

const SLOT_START = 11 * 60; // 11:00
const SLOT_END = 22 * 60 + 30; // 22:30
const SLOT_STEP = 30;
const MIN_LEAD_MS = 45 * 60000; // marge au-delà des 30 minutes exigées par le serveur

const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/**
 * Choix « Dès que possible » ou d'un créneau (jour + heure) dans les 7 prochains jours.
 * Le serveur vérifie les horaires du commerce et renvoie une erreur claire si le créneau est fermé.
 */
export default function SchedulePicker({ value, onChange, disabled }) {
  const { t, i18n } = useTranslation();
  // Heure de référence figée à l'ouverture de l'écran (les créneaux trop proches sont masqués).
  const [now] = useState(() => Date.now());

  const days = useMemo(() => {
    const list = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      list.push(d);
    }
    return list;
  }, []);

  const selected = value ? new Date(value) : null;
  const selectedDay = selected ? dayKey(selected) : null;

  const slotsFor = (day) => {
    const slots = [];
    for (let m = SLOT_START; m <= SLOT_END; m += SLOT_STEP) {
      const d = new Date(day);
      d.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (d.getTime() - now >= MIN_LEAD_MS) slots.push(d);
    }
    return slots;
  };

  const activeDay = selected ? days.find((d) => dayKey(d) === selectedDay) || days[0] : null;
  const dayLabel = (d, i) =>
    i === 0
      ? t('schedule.today')
      : i === 1
        ? t('schedule.tomorrow')
        : d.toLocaleDateString(i18n.language || 'fr', { weekday: 'short', day: 'numeric' });

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('schedule.title')}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !value }}
          disabled={disabled}
          onPress={() => onChange(null)}
          style={[styles.chip, !value && styles.chipOn]}
        >
          <Text style={[styles.chipText, !value && styles.chipTextOn]}>{t('schedule.asap')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: Boolean(value) }}
          disabled={disabled}
          onPress={() => {
            if (value) return;
            const first = days.map(slotsFor).find((list) => list.length)?.[0];
            if (first) onChange(first.toISOString());
          }}
          style={[styles.chip, value && styles.chipOn]}
        >
          <Text style={[styles.chipText, value && styles.chipTextOn]}>{t('schedule.later')}</Text>
        </Pressable>
      </View>

      {value ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {days.map((d, i) => {
              const slots = slotsFor(d);
              if (!slots.length) return null;
              const on = dayKey(d) === selectedDay;
              return (
                <Pressable
                  key={dayKey(d)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  disabled={disabled}
                  onPress={() => onChange(slots[0].toISOString())}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{dayLabel(d, i)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {activeDay
              ? slotsFor(activeDay).map((slot) => {
                  const on = selected && slot.getTime() === selected.getTime();
                  return (
                    <Pressable
                      key={slot.toISOString()}
                      accessibilityRole="button"
                      accessibilityState={{ selected: Boolean(on) }}
                      disabled={disabled}
                      onPress={() => onChange(slot.toISOString())}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {slot.toLocaleTimeString(i18n.language || 'fr', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </Pressable>
                  );
                })
              : null}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12, gap: 8 },
  title: { color: '#0D1C11', fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'nowrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#D8CDB8', backgroundColor: '#FFFFFF' },
  chipOn: { backgroundColor: '#084424', borderColor: '#084424' },
  chipText: { color: '#0D1C11', fontWeight: '700' },
  chipTextOn: { color: '#FFFFFF' },
});
