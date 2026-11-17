import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

/** Commande avec alcool : rappel de contrôler la pièce d'identité du client à la remise. */
export default function AlcoholIdNotice({ order, style }) {
  const { t } = useTranslation();
  if (!order?.containsAlcohol) return null;
  return (
    <View accessibilityRole="alert" style={[styles.box, style]}>
      <Ionicons name="id-card-outline" size={20} color="#9B1C1C" />
      <View style={styles.texts}>
        <Text style={styles.title}>{t('alcohol.noticeTitle')}</Text>
        <Text style={styles.body}>{t('alcohol.noticeBody')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#FDECEA',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F5C2BC',
  },
  texts: { flex: 1, gap: 2 },
  title: { color: '#9B1C1C', fontWeight: '900' },
  body: { color: '#5C1414', lineHeight: 19 },
});
