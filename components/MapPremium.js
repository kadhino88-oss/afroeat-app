import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FadeInView from './FadeInView';

export default function MapPremium() {
  return (
    <FadeInView style={styles.wrapper}>
      <View style={styles.mapBox}>
        <Text style={styles.icon}>🗺️</Text>
        <Text style={styles.title}>Carte AFROEAT Premium</Text>
        <Text style={styles.subtitle}>
          Le suivi en temps réel sera réactivé après stabilisation finale de l’application.
        </Text>
      </View>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginVertical: 12,
  },
  mapBox: {
    height: 240,
    borderRadius: 24,
    backgroundColor: '#0D1C11',
    borderWidth: 1,
    borderColor: '#0D1C11',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  icon: {
    fontSize: 42,
    marginBottom: 14,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    color: '#606D5D',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
});