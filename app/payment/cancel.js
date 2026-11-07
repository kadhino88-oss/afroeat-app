import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PaymentCancelScreen() {
  const params = useLocalSearchParams();
  const orderId = String(params?.orderId || '').trim();
  const amount = String(params?.amount || '').trim();
  const currency = String(params?.currency || 'EUR').trim();
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="close-circle" size={66} color="#D6A85D" />
        <Text style={styles.title}>Paiement interrompu</Text>
        <Text style={styles.message}>Aucun succès de paiement n’a été confirmé sur cette page. Ta commande n’est pas supprimée : vérifie son statut avant de recommencer.</Text>
        <Pressable style={styles.primary} onPress={() => router.replace(orderId ? { pathname: '/payment', params: { orderId, amount, currency } } : '/(tabs)/orders')}><Text style={styles.primaryText}>Revenir au paiement</Text></Pressable>
        <Pressable style={styles.secondary} onPress={() => router.replace('/(tabs)/orders')}><Text style={styles.secondaryText}>Voir mes commandes</Text></Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0F', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 480, backgroundColor: '#17171D', borderColor: '#3A3020', borderWidth: 1, borderRadius: 24, padding: 28, alignItems: 'center', gap: 16 },
  title: { color: '#F7E7C1', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  message: { color: '#E7E2D8', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  primary: { marginTop: 8, backgroundColor: '#C9A45C', borderRadius: 14, padding: 14, width: '100%', alignItems: 'center' },
  primaryText: { color: '#15130F', fontSize: 16, fontWeight: '800' },
  secondary: { padding: 12 },
  secondaryText: { color: '#F7E7C1', fontSize: 15, fontWeight: '700' },
});
