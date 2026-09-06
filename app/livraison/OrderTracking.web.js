import React from 'react';
import { View, Text, StyleSheet, Pressable, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import FadeInView from '../../components/FadeInView';

/**
 * =========================================================
 * ORDER TRACKING — FALLBACK WEB
 * app/livraison/OrderTracking.web.js
 *
 * OrderTracking.js utilise react-native-maps, un module natif
 * sans equivalent web (meme logique que app/map.js / map.web.js
 * deja present dans le projet). Metro choisit automatiquement ce
 * fichier a la place sur le web, pour eviter de casser tout le
 * bundle avec un import natif inexistant sur navigateur.
 * =========================================================
 */
export default function OrderTrackingWebFallback() {
  const { t } = useTranslation();
  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <View style={styles.card}>
        <Ionicons name="map-outline" size={56} color="#D4A017" />

        <Text style={styles.title}>{t('livraison.trackingWeb.title')}</Text>

        <Text style={styles.text}>
          {t('livraison.trackingWeb.text')}
        </Text>

        <Pressable
          style={styles.button}
          onPress={() => router.replace('/livraison/orders')}
        >
          <Text style={styles.buttonText}>{t('livraison.trackingWeb.backButton')}</Text>
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
    marginTop: 20,
    backgroundColor: '#D4A017',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  buttonText: {
    color: '#1E1E1E',
    fontWeight: '900',
    fontSize: 15,
  },
});
