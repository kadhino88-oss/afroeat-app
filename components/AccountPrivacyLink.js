import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function AccountPrivacyLink() {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('profile.home.dataPrivacyTitle')}
      onPress={() => router.push('/account/privacy')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="shield-checkmark-outline" size={21} color="#084424" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{t('profile.home.dataPrivacyTitle')}</Text>
        <Text style={styles.subtitle}>{t('profile.home.dataPrivacyText')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#606D5D" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  pressed: { opacity: 0.75 },
  iconWrap: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderRadius: 14,
    backgroundColor: '#F2ECE0',
  },
  copy: { flex: 1 },
  title: { color: '#0D1C11', fontSize: 14, fontWeight: '800' },
  subtitle: { marginTop: 3, color: '#606D5D', fontSize: 12, lineHeight: 17 },
});
