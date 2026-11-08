
/**
 * =========================================================
 * PAYMENT SCREEN — AFROEAT
 * Fichier : app/payment.js
 * =========================================================
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { apiPost, apiGet } from '../services/apiClient';
import { API_ENDPOINTS } from '../constants/api';
import { useAfroeatPayment } from '../services/stripeService';
import WalletPayButton from '../components/WalletPayButton';
import { clearPendingOrderKeys } from '../services/orderService';
import { useTranslation } from 'react-i18next';

const normalizeText = (value, fallback = '') =>
  String(value ?? '').trim() || fallback;

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatPrice = (amount, currency = 'EUR') => {
  const value = normalizeNumber(amount, 0);
  const code = normalizeText(currency, 'EUR').toUpperCase();

  if (code === 'USD') return `$${value.toFixed(2)}`;
  if (code === 'GBP') return `£${value.toFixed(2)}`;
  if (code === 'CHF') return `CHF ${value.toFixed(2)}`;
  if (code === 'XOF' || code === 'XAF') {
    return `${value.toFixed(0)} ${code}`;
  }
  if (code === 'CAD') return `${value.toFixed(2)} $CA`;

  return `${value.toFixed(2)} €`;
};

const PAYMENT_METHODS = [
  {
    id: 'card',
    label: 'Carte bancaire',
    icon: 'card-outline',
    color: '#245EA8',
  },
  {
    id: 'cash',
    label: 'Paiement à la livraison',
    icon: 'cash-outline',
    color: '#1F6F43',
  },
];

const PaymentMethodBtn = ({ method, selected, onPress }) => {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(method.id)}
      style={({ pressed }) => [
        styles.methodBtn,
        selected && styles.methodBtnSelected,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.methodIcon,
          { backgroundColor: `${method.color}18` },
        ]}
      >
        <Ionicons
          name={method.icon}
          size={22}
          color={method.color}
        />
      </View>

      <Text
        style={[
          styles.methodLabel,
          selected && styles.methodLabelSelected,
        ]}
      >
        {t(`payment.methods.${method.id}`, method.label)}
      </Text>

      {selected && (
        <Ionicons
          name="checkmark-circle"
          size={20}
          color="#1F6F43"
          style={styles.methodCheck}
        />
      )}
    </Pressable>
  );
};

export default function PaymentScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const auth = useAuth() || {};
  const cart = useCart() || {};

  const token = auth.token ?? null;
  const clearCart = cart.clearCart;

  const orderId = normalizeText(params?.orderId);
  const amount = normalizeNumber(params?.amount, 0);
  const currency = normalizeText(params?.currency, 'EUR');

  const [selectedMethod, setSelectedMethod] = useState('card');
  const [loading, setLoading] = useState(false);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [availableMethods, setAvailableMethods] = useState([]);
  const [step, setStep] = useState('select');
  const [errorMsg, setErrorMsg] = useState('');
  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(Platform.OS !== 'web');
  // State updates are asynchronous; this ref blocks rapid double taps before
  // React has time to render the loading state.
  const paymentInProgressRef = useRef(false);

  const { pay: payWithStripe, payWithWallet } = useAfroeatPayment();

  // Sur mobile, on paie avec la carte enregistrée dans le profil (aucune saisie ici).
  // Sur le web, l'enregistrement de carte n'existe pas : le paiement reste inchangé.
  const requiresSavedCard = Platform.OS !== 'web';
  const defaultCard = cards.find((card) => card?.isDefault) || cards[0] || null;
  const needsCard = requiresSavedCard && !cardsLoading && !defaultCard;

  const loadCards = useCallback(async () => {
    if (!requiresSavedCard || !token) {
      setCardsLoading(false);
      return;
    }

    setCardsLoading(true);
    try {
      const result = await apiGet(API_ENDPOINTS.payments.cards, token);
      setCards(Array.isArray(result?.cards) ? result.cards : []);
    } catch (error) {
      console.warn('AFROEAT : impossible de charger les cartes.', error?.message);
      setCards([]);
    } finally {
      setCardsLoading(false);
    }
  }, [requiresSavedCard, token]);

  // Recharge au retour du profil, après un changement ou un ajout de carte.
  useFocusEffect(
    useCallback(() => {
      loadCards();
    }, [loadCards])
  );

  const goToCards = useCallback(() => router.push('/profile/payment'), []);

  /**
   * Ne vide le panier qu'après confirmation de l'opération
   * par le serveur. Une erreur de vidage ne doit pas faire
   * croire au client que le paiement a échoué.
   */
  const clearCartAfterSuccess = useCallback(async () => {
    try {
      if (typeof clearCart === 'function') await Promise.resolve(clearCart());
      await clearPendingOrderKeys();
    } catch (error) {
      console.warn(
        'AFROEAT : impossible de vider le panier après confirmation.',
        error
      );
    }
  }, [clearCart]);

  /**
   * Récupération des moyens de paiement autorisés
   * par le backend.
   */
  useEffect(() => {
    let isActive = true;
    const timer = setTimeout(() => {
      if (!token) {
        setAvailableMethods([]);
        setMethodsLoading(false);
        return;
      }

      setMethodsLoading(true);

      apiGet(API_ENDPOINTS.payments.methods, token)
        .then((result) => {
          if (!isActive) return;

          const methods = PAYMENT_METHODS.filter((method) =>
            Boolean(result?.methods?.[method.id])
          );

          setAvailableMethods(methods);
          setSelectedMethod(methods[0]?.id || 'card');
        })
        .catch((error) => {
          console.warn(
            'AFROEAT : impossible de récupérer les moyens de paiement.',
            error?.message
          );

          if (isActive) {
            setAvailableMethods([]);
          }
        })
        .finally(() => {
          if (isActive) {
            setMethodsLoading(false);
          }
        });
    }, 0);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [token]);

  /**
   * Vérification de la commande.
   */
  useEffect(() => {
    if (!orderId) {
      Alert.alert(
        t('checkout.error'),
        t('payment.orderNotFoundBody'),
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/orders'),
          },
        ]
      );
    }
  }, [orderId, t]);

  /**
   * Paiement à la livraison.
   */
  const handleCashPayment = useCallback(async () => {
    if (!orderId || !token || loading || paymentInProgressRef.current) return;

    paymentInProgressRef.current = true;
    setLoading(true);
    setStep('processing');
    setErrorMsg('');

    try {
      await apiPost(
        API_ENDPOINTS.payments.cash,
        { orderId },
        token
      );

      await clearCartAfterSuccess();
      setStep('success');
    } catch (error) {
      setErrorMsg(
        error?.message || t('payment.paymentRefused')
      );
      setStep('error');
    } finally {
      paymentInProgressRef.current = false;
      setLoading(false);
    }
  }, [orderId, token, loading, t, clearCartAfterSuccess]);

  /**
   * Paiement par carte via Stripe.
   */
  const handleCardPayment = useCallback(async () => {
    if (!orderId || !token || loading || paymentInProgressRef.current) return;

    paymentInProgressRef.current = true;
    setLoading(true);
    setStep('processing');
    setErrorMsg('');

    try {
      const result = await payWithStripe({
        orderId,
        token,
        paymentMethodId: requiresSavedCard ? defaultCard?.id : null,
      });

      if (result?.canceled === true) {
        setStep('select');
        return;
      }

      if (result?.redirecting === true) {
        // Stripe Checkout va quitter cette page. Le panier sera vidé seulement
        // après confirmation serveur sur /payment/success.
        return;
      }

      if (result?.success === true) {
        await clearCartAfterSuccess();
        setStep('success');
      } else {
        setErrorMsg(
          result?.error || t('payment.paymentRefused')
        );
        setStep('error');
      }
    } catch (error) {
      setErrorMsg(
        error?.message || t('payment.paymentRefused')
      );
      setStep('error');
    } finally {
      paymentInProgressRef.current = false;
      setLoading(false);
    }
  }, [
    orderId,
    token,
    loading,
    payWithStripe,
    requiresSavedCard,
    defaultCard,
    t,
    clearCartAfterSuccess,
  ]);

  /**
   * Paiement par Apple Pay / Google Pay (carte du portefeuille de l'appareil).
   */
  const handleWalletPayment = useCallback(async () => {
    if (!orderId || !token || loading || paymentInProgressRef.current) return;

    paymentInProgressRef.current = true;
    setLoading(true);
    setErrorMsg('');

    try {
      const result = await payWithWallet({ orderId, token });

      if (result?.canceled === true) return;

      if (result?.success === true) {
        await clearCartAfterSuccess();
        setStep('success');
      } else {
        setErrorMsg(result?.error || t('payment.paymentRefused'));
        setStep('error');
      }
    } catch (error) {
      setErrorMsg(error?.message || t('payment.paymentRefused'));
      setStep('error');
    } finally {
      paymentInProgressRef.current = false;
      setLoading(false);
    }
  }, [orderId, token, loading, payWithWallet, t, clearCartAfterSuccess]);

  /**
   * Lancement du moyen de paiement sélectionné.
   */
  const handlePay = useCallback(() => {
    if (!orderId || !token || loading) return;

    // Une carte enregistrée est exigée pour commander : on renvoie vers le profil.
    if (needsCard) {
      goToCards();
      return;
    }

    const methodIsAvailable = availableMethods.some(
      (method) => method.id === selectedMethod
    );

    if (!methodIsAvailable) return;

    if (selectedMethod === 'cash') {
      handleCashPayment();
    } else if (selectedMethod === 'card') {
      handleCardPayment();
    }
  }, [
    orderId,
    token,
    loading,
    availableMethods,
    selectedMethod,
    needsCard,
    goToCards,
    handleCashPayment,
    handleCardPayment,
  ]);

  const handleGoToOrders = useCallback(() => {
    router.replace('/(tabs)/orders');
  }, []);

  const handleRetry = useCallback(() => {
    setErrorMsg('');
    setStep('select');
  }, []);

  // Écran de réussite
  if (step === 'success') {
    return (
      <View style={styles.container}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#FFF8F0"
        />

        <View style={styles.centerCard}>
          <View style={styles.successIcon}>
            <Ionicons
              name="checkmark-circle"
              size={72}
              color="#1F6F43"
            />
          </View>

          <Text style={styles.successTitle}>
            {selectedMethod === 'cash'
              ? t('payment.cashSelectedTitle')
              : t('payment.successTitle')}
          </Text>

          <Text style={styles.successText}>
            {selectedMethod === 'cash'
              ? t('payment.successCash')
              : t('payment.successCard')}
          </Text>

          <Text style={styles.successAmount}>
            {formatPrice(amount, currency)}
          </Text>

          <Pressable
            accessibilityRole="button"
            style={styles.primaryBtn}
            onPress={handleGoToOrders}
          >
            <Text style={styles.primaryBtnText}>
              {t('payment.trackOrder')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Écran d'erreur
  if (step === 'error') {
    return (
      <View style={styles.container}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#FFF8F0"
        />

        <View style={styles.centerCard}>
          <Ionicons
            name="close-circle"
            size={72}
            color="#B63B3B"
          />

          <Text style={styles.errorTitle}>
            {t('payment.failedTitle')}
          </Text>

          <Text style={styles.errorText}>
            {errorMsg}
          </Text>

          <Pressable
            accessibilityRole="button"
            style={styles.primaryBtn}
            onPress={handleRetry}
          >
            <Text style={styles.primaryBtnText}>
              {t('payment.retry')}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={styles.secondaryBtn}
            onPress={handleGoToOrders}
          >
            <Text style={styles.secondaryBtnText}>
              {t('order.viewMyOrders')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Écran de traitement
  if (step === 'processing') {
    return (
      <View style={styles.container}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#FFF8F0"
        />

        <View style={styles.centerCard}>
          <ActivityIndicator
            size="large"
            color="#D4A017"
          />

          <Text style={styles.processingText}>
            {t('payment.processing')}
          </Text>

          <Text style={styles.processingSubText}>
            {t('payment.dontClose')}
          </Text>
        </View>
      </View>
    );
  }

  // Écran de sélection du moyen de paiement
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFF8F0"
      />

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('checkout.back')}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && styles.pressed,
          ]}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color="#111"
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          {t('payment.title')}
        </Text>

        <View style={{ width: 42 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>
            {t('payment.totalAmount')}
          </Text>

          <Text style={styles.amountValue}>
            {formatPrice(amount, currency)}
          </Text>

          <View style={styles.secureBadge}>
            <Ionicons
              name="lock-closed"
              size={12}
              color="#1F6F43"
            />
            <Text style={styles.secureBadgeText}>
              {t('checkout.securePayment')}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {t('payment.chooseMethod')}
        </Text>

        {methodsLoading ? (
          <ActivityIndicator
            color="#5A32A3"
            size="large"
            style={styles.methodsLoader}
          />
        ) : availableMethods.length === 0 ? (
          <View style={styles.unavailableBox}>
            <View style={styles.infoBox}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#245EA8"
              />
              <Text style={styles.infoText}>
                {t('payment.methodsUnavailable')}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/profile/help')}
              style={styles.supportLink}
            >
              <Text style={styles.supportLinkText}>
                {t('payment.contactSupport')}
              </Text>
            </Pressable>
          </View>
        ) : (
          availableMethods.map((method) => (
            <PaymentMethodBtn
              key={method.id}
              method={method}
              selected={selectedMethod === method.id}
              onPress={setSelectedMethod}
            />
          ))
        )}

        {requiresSavedCard && cardsLoading && (
          <ActivityIndicator color="#245EA8" style={styles.methodsLoader} />
        )}

        {needsCard && (
          <View style={styles.noCardBox}>
            <Ionicons name="card-outline" size={20} color="#B3261E" />
            <View style={styles.savedCardCopy}>
              <Text style={styles.noCardTitle}>{t('paymentCards.noCardTitle')}</Text>
              <Text style={styles.infoText}>{t('paymentCards.noCardText')}</Text>
            </View>
          </View>
        )}

        {requiresSavedCard && !cardsLoading && defaultCard && selectedMethod === 'card' && (
          <View style={styles.savedCardBox}>
            <Ionicons name="card" size={22} color="#245EA8" />
            <View style={styles.savedCardCopy}>
              <Text style={styles.savedCardTitle}>
                {t('paymentCards.usedCard')}
              </Text>
              <Text style={styles.savedCardText}>
                {`${String(defaultCard.brand || 'card').toUpperCase()} •••• ${defaultCard.last4}`}
                {defaultCard.expMonth && defaultCard.expYear
                  ? `  ·  ${String(defaultCard.expMonth).padStart(2, '0')}/${String(defaultCard.expYear).slice(-2)}`
                  : ''}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={goToCards} style={styles.changeCardBtn}>
              <Text style={styles.changeCardText}>{t('paymentCards.change')}</Text>
            </Pressable>
          </View>
        )}

        {!requiresSavedCard && selectedMethod === 'card' && (
          <View style={styles.infoBox}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="#245EA8"
            />
            <Text style={styles.infoText}>
              {t('payment.cardInfo')}
            </Text>
          </View>
        )}

        {selectedMethod === 'cash' && (
          <View style={[styles.infoBox, styles.infoBoxGreen]}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="#1F6F43"
            />
            <Text
              style={[styles.infoText, styles.infoTextGreen]}
            >
              {t('payment.cashInfo')}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.payBtn,
            (
              loading ||
              methodsLoading ||
              cardsLoading ||
              availableMethods.length === 0
            ) && styles.payBtnDisabled,
            pressed && styles.pressed,
          ]}
          onPress={handlePay}
          disabled={
            loading ||
            methodsLoading ||
            cardsLoading ||
            availableMethods.length === 0
          }
        >
          {loading ? (
            <ActivityIndicator color="#111" />
          ) : (
            <>
              <Ionicons
                name={needsCard || selectedMethod === 'card' ? 'card' : 'cash'}
                size={20}
                color="#111"
              />

              <Text style={styles.payBtnText}>
                {needsCard
                  ? t('paymentCards.addCard')
                  : selectedMethod === 'card'
                  ? t('payment.payAmount', {
                      amount: formatPrice(amount, currency),
                    })
                  : t('payment.confirmCash')}
              </Text>
            </>
          )}
        </Pressable>

        {selectedMethod === 'card' && (
          <WalletPayButton
            onPress={handleWalletPayment}
            disabled={loading || methodsLoading}
          />
        )}

        <Text style={styles.legalText}>
          {t('payment.legalText')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  savedCardBox: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: '#EEF4FB', borderWidth: 1, borderColor: '#D3E2F3', marginTop: 10 },
  savedCardCopy: { flex: 1, marginLeft: 11 },
  savedCardTitle: { color: '#5C6B7A', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  savedCardText: { marginTop: 3, color: '#14253A', fontSize: 15, fontWeight: '800' },
  changeCardBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C5D6EA' },
  changeCardText: { color: '#245EA8', fontSize: 13, fontWeight: '800' },
  noCardBox: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 14, backgroundColor: '#FDECEA', borderWidth: 1, borderColor: '#F5C6C2', marginTop: 10 },
  noCardTitle: { color: '#B3261E', fontSize: 14, fontWeight: '800', marginBottom: 3 },
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDE5D8',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111',
  },
  pressed: {
    opacity: 0.78,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  amountCard: {
    backgroundColor: '#111',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  amountLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#AAA',
    marginBottom: 6,
  },
  amountValue: {
    fontSize: 38,
    fontWeight: '900',
    color: '#D4A017',
    marginBottom: 10,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2A1A',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  secureBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4CAF7D',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111',
    marginBottom: 12,
  },
  methodsLoader: {
    marginVertical: 18,
  },
  unavailableBox: {
    marginBottom: 16,
  },
  supportLink: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  supportLinkText: {
    color: '#5A32A3',
    fontSize: 13,
    fontWeight: '800',
  },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#EDE5D8',
    gap: 12,
  },
  methodBtnSelected: {
    borderColor: '#1F6F43',
    backgroundColor: '#F0FAF4',
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#555',
  },
  methodLabelSelected: {
    color: '#111',
    fontWeight: '900',
  },
  methodCheck: {
    marginLeft: 'auto',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EEF4FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C5D9F5',
  },
  infoBoxGreen: {
    backgroundColor: '#EDFAF1',
    borderColor: '#B8E6CB',
  },
  infoText: {
    fontSize: 13,
    color: '#245EA8',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  infoTextGreen: {
    color: '#1F6F43',
  },
  payBtn: {
    backgroundColor: '#D4A017',
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  payBtnDisabled: {
    opacity: 0.6,
  },
  payBtnText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111',
  },
  legalText: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 16,
  },
  centerCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F6F43',
    marginBottom: 12,
    textAlign: 'center',
  },
  successText: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  successAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111',
    marginBottom: 28,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#B63B3B',
    marginTop: 16,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryBtn: {
    backgroundColor: '#D4A017',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111',
  },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
  },
  processingText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111',
    marginTop: 20,
  },
  processingSubText: {
    fontSize: 13,
    color: '#888',
    marginTop: 8,
  },
});
