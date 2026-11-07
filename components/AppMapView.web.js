import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * =========================================================
 * APP MAP VIEW — WEB (fallback visuel)
 * components/AppMapView.web.js
 *
 * Metro choisit automatiquement ce fichier (.web.js) a la place de
 * AppMapView.js quand on build pour le web. On remplace la carte
 * interactive par un simple encart explicatif, a la place exacte
 * ou la vraie carte s'affiche en natif (meme style flex).
 * Marker/Callout/Polyline ne rendent rien sur le web (enfants du
 * MapView natif, sans utilite dans le fallback).
 * =========================================================
 */
export default function AppMapViewWebFallback({ style }) {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name="map-outline" size={36} color="#D4A017" />
      <Text style={styles.text}>Carte disponible sur l&apos;app mobile</Text>
    </View>
  );
}

export const Marker = () => null;
export const Callout = () => null;
export const Polyline = () => null;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 160,
    backgroundColor: '#F1ECE4',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    padding: 16,
  },
  text: {
    marginTop: 8,
    color: '#8A6500',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
});
