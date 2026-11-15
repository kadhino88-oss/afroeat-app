import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

/** Adresse inconnue : une page claire avec un retour à l'accueil, jamais un écran noir. */
export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.page}>
      <Text style={styles.code}>404</Text>
      <Text style={styles.title}>{t('notFound.title')}</Text>
      <Text style={styles.body}>{t('notFound.body')}</Text>
      <Pressable accessibilityRole="link" onPress={() => router.replace('/')} style={styles.button}>
        <Text style={styles.buttonText}>{t('notFound.action')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FBF6EC',
  },
  code: { fontSize: 56, fontWeight: '900', color: '#EAB02F' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '800', color: '#0D1C11', textAlign: 'center' },
  body: { marginTop: 8, fontSize: 15, color: '#606D5D', textAlign: 'center' },
  button: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 8,
    backgroundColor: '#084424',
  },
  buttonText: { color: '#FBF6EC', fontWeight: '800', fontSize: 14 },
});
