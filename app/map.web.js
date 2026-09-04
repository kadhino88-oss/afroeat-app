import React from 'react';
import { View, Text, StyleSheet, Pressable, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../components/FadeInView';
import { useTranslation } from 'react-i18next';

export default function MapWebFallback() {
  const { t } = useTranslation();
  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <View style={styles.card}>
        <Ionicons name="map-outline" size={56} color="#D4A017" />

        <Text style={styles.title}>{t('mapWeb.title')}</Text>

        <Text style={styles.text}>
          {t('mapWeb.text')}
        </Text>

        <Pressable style={styles.button} onPress={() => router.replace('/(tabs)/explore')}>
          <Text style={styles.buttonText}>{t('mapWeb.backToExplore')}</Text>
        </Pressable>
      </View>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '900',
    color: '#1E1E1E',
    textAlign: 'center',
  },
  text: {
    marginTop: 10,
    fontSize: 15,
    color: '#666666',
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    backgroundColor: '#D4A017',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  buttonText: {
    color: '#1E1E1E',
    fontWeight: '900',
  },
});