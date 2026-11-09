import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { apiPost } from '../../services/apiClient';
import { API_ENDPOINTS } from '../../constants/api';
import { clearPendingOrderKeys } from '../../services/orderService';

export default function PaymentSuccessScreen() {
  const params = useLocalSearchParams();
  const { token, loading: authLoading } = useAuth() || {};
  const { clearCart } = useCart() || {};
  const orderId = String(params?.orderId || '').trim();
  const sessionId = String(params?.session_id || params?.sessionId || '').trim();
  const started = useRef(false);
  const [state, setState] = useState('checking');
  const [message, setMessage] = useState('Vérification sécurisée du paiement…');

  useEffect(() => {
    if (authLoading || started.current) return;
    let active = true;
    const timer = setTimeout(() => {
      if (!active || started.current) return;
      if (!token) {
        started.current = true;
        setState('error');
        setMessage('Reconnecte-toi pour vérifier le paiement. Ne repaie pas avant cette vérification.');
        return;
      }
      if (!orderId || !sessionId) {
        started.current = true;
        setState('error');
        setMessage('Les informations de retour Stripe sont incomplètes. Consulte tes commandes avant de réessayer.');
        return;
      }

      started.current = true;
      apiPost(API_ENDPOINTS.payments.confirm, { orderId, checkoutSessionId: sessionId }, token)
        .then(async (result) => {
          if (!active) return;
          if (!result?.success || result?.paymentStatus !== 'Payé') {
            throw new Error(result?.message || 'Le paiement n’a pas encore été confirmé par le serveur.');
          }
          try {
            if (typeof clearCart === 'function') await Promise.resolve(clearCart());
            await clearPendingOrderKeys();
          } catch {
            // Cart/key cleanup must never override the server-confirmed payment.
          }
          if (active) {
            setState('success');
            setMessage('Ton paiement est confirmé. Ta commande est enregistrée.');
          }
        })
        .catch((error) => {
          if (!active) return;
          setState('error');
          setMessage(error?.message || 'Impossible de confirmer le paiement. Consulte tes commandes avant toute nouvelle tentative.');
        });
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [authLoading, token, orderId, sessionId, clearCart]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {state === 'checking' ? <ActivityIndicator size="large" color="#EAB02F" /> :
          <Ionicons name={state === 'success' ? 'checkmark-circle' : 'alert-circle'} size={66} color={state === 'success' ? '#084424' : '#C8331A'} />}
        <Text style={styles.title}>{state === 'success' ? 'Paiement confirmé' : state === 'error' ? 'Vérification nécessaire' : 'Confirmation du paiement'}</Text>
        <Text style={styles.message}>{message}</Text>
        {state !== 'checking' && <Pressable style={styles.button} onPress={() => router.replace('/(tabs)/orders')}><Text style={styles.buttonText}>Voir mes commandes</Text></Pressable>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1C11', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 480, backgroundColor: '#0D1C11', borderColor: '#301904', borderWidth: 1, borderRadius: 24, padding: 28, alignItems: 'center', gap: 16 },
  title: { color: '#F3E7CA', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  message: { color: '#F3E7CA', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  button: { marginTop: 8, backgroundColor: '#EAB02F', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 22, width: '100%', alignItems: 'center' },
  buttonText: { color: '#0D1C11', fontSize: 16, fontWeight: '800' },
});
