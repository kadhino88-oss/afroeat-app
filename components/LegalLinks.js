import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

// Liens vers la politique de confidentialité et les conditions d'utilisation, affichés sur les écrans
// natifs d'inscription, de connexion et de profil (exigé par les magasins d'applications).
function LegalLinks({ style }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.text}>
        {t('legalLinks.consent')} {' '}
        <Text
          style={styles.link}
          accessibilityRole="link"
          accessibilityLabel={t('legalLinks.terms')}
          onPress={() => router.push('/legal/terms')}
        >
          {t('legalLinks.terms')}
        </Text>{' '}
        {t('legalLinks.and')}{' '}
        <Text
          style={styles.link}
          accessibilityRole="link"
          accessibilityLabel={t('legalLinks.privacy')}
          onPress={() => router.push('/legal/privacy')}
        >
          {t('legalLinks.privacy')}
        </Text>
        .
      </Text>
    </View>
  );
}

// Variante en lignes séparées (zones tactiles ≥ 44 px) pour les écrans de profil.
export function LegalLinkRows() {
  const { t } = useTranslation();
  const rows = [
    { key: 'privacy', label: t('legalLinks.privacy'), href: '/legal/privacy' },
    { key: 'terms', label: t('legalLinks.terms'), href: '/legal/terms' },
  ];
  return (
    <View style={styles.rows}>
      {rows.map((row) => (
        <Pressable
          key={row.key}
          accessibilityRole="link"
          accessibilityLabel={row.label}
          onPress={() => router.push(row.href)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.rowText}>{row.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 16, paddingHorizontal: 8 },
  text: { fontSize: 13, lineHeight: 19, color: '#606D5D', textAlign: 'center' },
  link: { color: '#084424', fontWeight: '700', textDecorationLine: 'underline' },
  rows: { marginTop: 4, marginBottom: 10 },
  row: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  rowText: { fontSize: 14, color: '#084424', fontWeight: '600', textDecorationLine: 'underline' },
  pressed: { opacity: 0.7 },
});

export default React.memo(LegalLinks);
