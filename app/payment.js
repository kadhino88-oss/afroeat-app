/**
 * =========================================================
 * PAYMENT SCREEN — AFROEAT
 * app/payment.js
 *
 * Flow :
 * 1. Reçoit orderId + amount + currency depuis checkout
 * 2. Crée un PaymentIntent backend → clientSecret
 * 3. Présente le formulaire Stripe natif
 * 4. Confirme le paiement côté backend
 * 5. Redirige vers le suivi de commande
 * =========================================================
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAfroeatPayment } from '../services/stripeService';

// ─── Helpers ──────────────────────────────────────────────
const normalizeText  = (v, f = '') => String(v ?? '').trim() || f;
const normalizeNumber = (v, f = 0)  => { const n = Number(v); return Number.isFinite(n) ? n : f; };

const formatPrice = (amount, currency = 'EUR') => {
  const n   = normalizeNumber(amount, 0);
  const cur = normalizeText(currency, 'EUR').toUpperCase();
  if (cur === 'USD') return `$${n.toFixed(2)}`;
  if (cur === 'GBP') return `£${n.toFixed(2)}`;
  if (cur === 'XOF' || cur === 'XAF') return `${n.toFixed(0)} ${cur}`;
  return `${n.toFixed(2)} €`;
};

// ─── Payment Method Selector ───────────────────────────────
const PAYMENT_METHODS = [
  { id: 'card',     label: 'Carte bancaire',     icon: 'card-outline',        color: '#245EA8' },
  { id: 'cash',     label: 'Paiement à la livraison', icon: 'cash-outline',   color: '#1F6F43' },
];

const PaymentMethodBtn = ({ method, selected, onPress }) => (
  <Pressable
    style={({ pressed }) => [
      styles.methodBtn,
      selected && styles.methodBtnSelected,
      pressed && styles.pressed,
    ]}
    onPress={() => onPress(method.id)}
  >
    <View style={[styles.methodIcon, { backgroundColor: method.color + '18' }]}>
      <Ionicons name={method.icon} size={22} color={method.color} />
    </View>
    <Text style={[styles.methodLabel, selected && styles.methodLabelSelected]}>
      {method.label}
    </Text>
    {selected && (
      <Ionicons name="checkmark-circle" size={20} color="#1F6F43" style={styles.methodCheck} />
    )}
  </Pressable>
);

// ─── Screen ───────────────────────────────────────────────
export default function PaymentScreen() {
  const params   = useLocalSearchParams();
  const auth     = useAuth() || {};
  const token    = auth.token ?? null;

  const orderId  = normalizeText(params?.orderId);
  const amount   = normalizeNumber(params?.amount, 0);
  const currency = normalizeText(params?.currency, 'EUR');

  const [selectedMethod, setSelectedMethod] = useState('card');
  const [loading,        setLoading]         = useState(false);
  const [step,           setStep]            = useState('select'); // 'select' | 'processing' | 'success' | 'error'
  const [errorMsg,       setErrorMsg]        = useState('');

  const { pay: payWithStripe } = useAfroeatPayment();

  useEffect(() => {
    if (!orderId) {
      Alert.alert('Erreur', 'Commande introuvable.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/orders') },
      ]);
    }
  }, [orderId]);

  const handleCashPayment = useCallback(async () => {
    // Paiement à la livraison : aucun appel backend n'est nécessaire ici.
    // La commande reste "En attente" (le restaurant la confirme comme
    // n'importe quelle commande) et le client règle le livreur en espèces
    // ou par carte directement à la réception.
    setLoading(true);
    setStep('processing');
    setLoading(false);
    setStep('success');
  }, []);

  const handleCardPayment = useCallback(async () => {
    setLoading(true);
    setStep('processing');

    const result = await payWithStripe({ orderId, token });

    setLoading(false);

    if (result.success) {
      setStep('success');
    } else {
      setErrorMsg(result.error || 'Paiement refusé. Réessaie.');
      setStep('error');
    }
  }, [orderId, token, payWithStripe]);

  const handlePay = useCallback(() => {
    if (!orderId) return;
    if (selectedMethod === 'cash') {
      handleCashPayment();
    } else {
      handleCardPayment();
    }
  }, [selectedMethod, orderId, handleCashPayment, handleCardPayment]);

  const handleGoToOrders = useCallback(() => {
    router.replace('/(tabs)/orders');
  }, []);

  const handleRetry = useCallback(() => {
    setStep('select');
    setErrorMsg('');
  }, []);

  // ── Success ───────────────────────────────────────────
  if (step === 'success') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.centerCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={72} color="#1F6F43" />
          </View>
          <Text style={styles.successTitle}>Paiement confirmé ✅</Text>
          <Text style={styles.successText}>
            {selectedMethod === 'cash'
              ? 'Tu règleras à la livraison. Ta commande est confirmée !'
              : 'Ton paiement a bien été reçu. Ta commande est confirmée !'}
          </Text>
          <Text style={styles.successAmount}>{formatPrice(amount, currency)}</Text>
          <Pressable style={styles.primaryBtn} onPress={handleGoToOrders}>
            <Text style={styles.primaryBtnText}>Suivre ma commande →</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────
  if (step === 'error') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.centerCard}>
          <Ionicons name="close-circle" size={72} color="#B63B3B" />
          <Text style={styles.errorTitle}>Paiement échoué</Text>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Pressable style={styles.primaryBtn} onPress={handleRetry}>
            <Text style={styles.primaryBtnText}>Réessayer</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={handleGoToOrders}>
            <Text style={styles.secondaryBtnText}>Voir mes commandes</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Processing ────────────────────────────────────────
  if (step === 'processing') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color="#D4A017" />
          <Text style={styles.processingText}>Traitement en cours...</Text>
          <Text style={styles.processingSubText}>Ne ferme pas l'application.</Text>
        </View>
      </View>
    );
  }

  // ── Select method ─────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle}>Paiement</Text>
        <View style={{ width: 42 }} />
      </View>

      <View style={styles.content}>

        {/* Montant */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Montant total</Text>
          <Text style={styles.amountValue}>{formatPrice(amount, currency)}</Text>
          <View style={styles.secureBadge}>
            <Ionicons name="lock-closed" size={12} color="#1F6F43" />
            <Text style={styles.secureBadgeText}>Paiement sécurisé</Text>
          </View>
        </View>

        {/* Méthodes de paiement */}
        <Text style={styles.sectionTitle}>Choisir une méthode</Text>

        {PAYMENT_METHODS.map((method) => (
          <PaymentMethodBtn
            key={method.id}
            method={method}
            selected={selectedMethod === method.id}
            onPress={setSelectedMethod}
          />
        ))}

        {/* Info méthode sélectionnée */}
        {selectedMethod === 'card' && (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color="#245EA8" />
            <Text style={styles.infoText}>
              Paiement sécurisé via Stripe. Visa, Mastercard, American Express acceptés.
            </Text>
          </View>
        )}

        {selectedMethod === 'cash' && (
          <View style={[styles.infoBox, styles.infoBoxGreen]}>
            <Ionicons name="information-circle-outline" size={16} color="#1F6F43" />
            <Text style={[styles.infoText, styles.infoTextGreen]}>
              Tu règles directement au livreur à la réception de ta commande.
            </Text>
          </View>
        )}

        {/* Bouton payer */}
        <Pressable
          style={({ pressed }) => [
            styles.payBtn,
            loading && styles.payBtnDisabled,
            pressed && styles.pressed,
          ]}
          onPress={handlePay}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#111" />
            : (
              <>
                <Ionicons
                  name={selectedMethod === 'card' ? 'card' : 'cash'}
                  size={20}
                  color="#111"
                />
                <Text style={styles.payBtnText}>
                  {selectedMethod === 'card'
                    ? `Payer ${formatPrice(amount, currency)}`
                    : 'Confirmer — Payer à la livraison'}
                </Text>
              </>
            )
          }
        </Pressable>

        <Text style={styles.legalText}>
          En confirmant, tu acceptes les conditions générales d'Afroeat.
        </Text>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#FFF8F0' },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn:          { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EDE5D8' },
  headerTitle:      { fontSize: 20, fontWeight: '900', color: '#111' },
  pressed:          { opacity: 0.78 },
  content:          { flex: 1, padding: 16 },

  amountCard:       { backgroundColor: '#111', borderRadius: 22, padding: 24, alignItems: 'center', marginBottom: 24 },
  amountLabel:      { fontSize: 13, fontWeight: '700', color: '#AAA', marginBottom: 6 },
  amountValue:      { fontSize: 38, fontWeight: '900', color: '#D4A017', marginBottom: 10 },
  secureBadge:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A2A1A', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, gap: 5 },
  secureBadgeText:  { fontSize: 12, fontWeight: '800', color: '#4CAF7D' },

  sectionTitle:     { fontSize: 15, fontWeight: '900', color: '#111', marginBottom: 12 },
  methodBtn:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: '#EDE5D8', gap: 12 },
  methodBtnSelected:{ borderColor: '#1F6F43', backgroundColor: '#F0FAF4' },
  methodIcon:       { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  methodLabel:      { flex: 1, fontSize: 15, fontWeight: '700', color: '#555' },
  methodLabelSelected: { color: '#111', fontWeight: '900' },
  methodCheck:      { marginLeft: 'auto' },

  infoBox:          { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EEF4FF', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#C5D9F5' },
  infoBoxGreen:     { backgroundColor: '#EDFAF1', borderColor: '#B8E6CB' },
  infoText:         { fontSize: 13, color: '#245EA8', fontWeight: '600', flex: 1, lineHeight: 18 },
  infoTextGreen:    { color: '#1F6F43' },

  payBtn:           { backgroundColor: '#D4A017', borderRadius: 18, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 },
  payBtnDisabled:   { opacity: 0.6 },
  payBtnText:       { fontSize: 17, fontWeight: '900', color: '#111' },
  legalText:        { fontSize: 11, color: '#BBB', textAlign: 'center', marginTop: 14, lineHeight: 16 },

  centerCard:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  successIcon:      { marginBottom: 16 },
  successTitle:     { fontSize: 24, fontWeight: '900', color: '#1F6F43', marginBottom: 12, textAlign: 'center' },
  successText:      { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  successAmount:    { fontSize: 32, fontWeight: '900', color: '#111', marginBottom: 28 },
  errorTitle:       { fontSize: 22, fontWeight: '900', color: '#B63B3B', marginTop: 16, marginBottom: 10 },
  errorText:        { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  primaryBtn:       { backgroundColor: '#D4A017', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center', width: '100%' },
  primaryBtnText:   { fontSize: 16, fontWeight: '900', color: '#111' },
  secondaryBtn:     { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: '#888' },
  processingText:   { fontSize: 18, fontWeight: '900', color: '#111', marginTop: 20 },
  processingSubText:{ fontSize: 13, color: '#888', marginTop: 8 },
});
