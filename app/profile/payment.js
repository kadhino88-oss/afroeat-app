import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { API_ENDPOINTS } from '../../constants/api';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../services/apiClient';
import { useSavedCardStripe } from '../../services/savedCardStripe';
import { buildStripeWalletOptions } from '../../services/stripeWalletOptions';

const getRoleRedirect = (role) => {
  if (role === 'admin') return '/admin';
  return null;
};

const getStripeErrorMessage = (error, fallback) =>
  error?.localizedMessage || error?.message || fallback;

export default function ProfilePaymentScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const fromSignup = params?.fromSignup === 'true';
  const auth = useAuth() || {};
  const token = auth.token || null;
  const role = auth.role || auth.user?.role || 'client';
  const {
    initPaymentSheet,
    presentPaymentSheet,
    getStripeReturnURL,
    stripeAvailable,
  } = useSavedCardStripe();

  const [cards, setCards] = useState([]);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState(null);
  const [loadingCards, setLoadingCards] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [busyCardId, setBusyCardId] = useState(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  // Retour de Stripe Checkout (web) : message affiché dès le premier rendu.
  const [errorMessage, setErrorMessage] = useState(() =>
    params?.cardSetup === 'cancel' ? t('profile.payment.setupCancelled') : ''
  );
  const [successMessage, setSuccessMessage] = useState(() =>
    params?.cardSetup === 'success' ? t('profile.payment.cardSaved') : ''
  );

  const finishSignup = useCallback(() => {
    if (role === 'restaurant' || role === 'livreur') {
      router.replace({
        pathname: '/auth/pending-approval',
        params: { role },
      });
      return;
    }
    router.replace('/(tabs)/explore');
  }, [role]);

  const loadCards = useCallback(async ({ showLoader = true } = {}) => {
    if (!token) {
      setCards([]);
      setDefaultPaymentMethod(null);
      setLoadingCards(false);
      return;
    }

    if (showLoader) setLoadingCards(true);
    setErrorMessage('');

    try {
      const result = await apiGet(API_ENDPOINTS.payments.cards, token);
      if (result?.success === false) {
        throw new Error(result.message || t('profile.payment.loadError'));
      }

      setCards(Array.isArray(result?.cards) ? result.cards : []);
      setDefaultPaymentMethod(result?.defaultPaymentMethod || null);
    } catch (error) {
      setErrorMessage(
        error?.message || t('profile.payment.loadError')
      );
    } finally {
      setLoadingCards(false);
      setRefreshing(false);
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      loadCards();
    }, [loadCards])
  );

  const refreshCards = useCallback(() => {
    setRefreshing(true);
    loadCards({ showLoader: false });
  }, [loadCards]);

  const handleAddCard = useCallback(async () => {
    if (!token || savingCard || !consentAccepted) return;

    if (Platform.OS === 'web') {
      // Web : page hébergée par Stripe (Checkout, mode setup). Aucun numéro de carte ici.
      setSavingCard(true);
      setErrorMessage('');
      setSuccessMessage('');
      try {
        const session = await apiPost(
          API_ENDPOINTS.payments.createCardSetupSession,
          {
            consentAccepted: true,
            returnUrl:
              typeof window !== 'undefined' ? window.location.origin : undefined,
          },
          token
        );
        if (!session?.url) {
          throw new Error(session?.message || t('profile.payment.setupError'));
        }
        window.location.assign(session.url);
      } catch (error) {
        setErrorMessage(error?.message || t('profile.payment.saveErrorFallback'));
        setSavingCard(false);
      }
      return;
    }

    if (!stripeAvailable) {
      setErrorMessage(t('profile.payment.mobileOnlyError'));
      return;
    }

    if (
      typeof initPaymentSheet !== 'function' ||
      typeof presentPaymentSheet !== 'function'
    ) {
      setErrorMessage(t('profile.payment.stripeUnavailable'));
      return;
    }

    setSavingCard(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const setup = await apiPost(
        API_ENDPOINTS.payments.createCardSetupIntent,
        { consentAccepted: true },
        token
      );

      if (!setup?.clientSecret) {
        throw new Error(
          setup?.message || t('profile.payment.setupError')
        );
      }

      const initialized = await initPaymentSheet({
        merchantDisplayName: 'AFROEAT',
        setupIntentClientSecret: setup.clientSecret,
        returnURL: getStripeReturnURL(),
        ...buildStripeWalletOptions({
          merchantCountryCode: setup.merchantCountryCode,
          currency: 'EUR',
        }),
      });

      if (initialized?.error) {
        throw new Error(
          getStripeErrorMessage(
            initialized.error,
            t('profile.payment.stripeUnavailable')
          )
        );
      }

      const presented = await presentPaymentSheet();
      if (presented?.error?.code === 'Canceled') return;
      if (presented?.error) {
        throw new Error(
          getStripeErrorMessage(
            presented.error,
            t('profile.payment.saveErrorFallback')
          )
        );
      }

      setConsentAccepted(false);
      setSuccessMessage(t('profile.payment.cardSaved'));
      await loadCards({ showLoader: false });
    } catch (error) {
      setErrorMessage(
        error?.message || t('profile.payment.saveErrorFallback')
      );
    } finally {
      setSavingCard(false);
    }
  }, [
    token,
    savingCard,
    consentAccepted,
    initPaymentSheet,
    presentPaymentSheet,
    getStripeReturnURL,
    stripeAvailable,
    loadCards,
    t,
  ]);

  const handleSetDefault = useCallback(async (card) => {
    if (!token || !card?.id || busyCardId) return;

    setBusyCardId(card.id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await apiPatch(
        API_ENDPOINTS.payments.setDefaultCard(card.id),
        {},
        token
      );
      if (result?.success === false) {
        throw new Error(result.message || t('profile.payment.actionError'));
      }

      setDefaultPaymentMethod(card.id);
      setCards((current) =>
        current.map((item) => ({ ...item, isDefault: item.id === card.id }))
      );
      setSuccessMessage(t('profile.payment.defaultUpdated'));
    } catch (error) {
      setErrorMessage(error?.message || t('profile.payment.actionError'));
    } finally {
      setBusyCardId(null);
    }
  }, [token, busyCardId, t]);

  const handleRemoveCard = useCallback(async (card) => {
    if (!token || !card?.id || busyCardId) return;

    setBusyCardId(card.id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await apiDelete(
        API_ENDPOINTS.payments.removeCard(card.id),
        token
      );
      if (result?.success === false) {
        throw new Error(result.message || t('profile.payment.actionError'));
      }

      setCards((current) => current.filter((item) => item.id !== card.id));
      if (defaultPaymentMethod === card.id) setDefaultPaymentMethod(null);
      setSuccessMessage(t('profile.payment.cardRemoved'));
      await loadCards({ showLoader: false });
    } catch (error) {
      setErrorMessage(error?.message || t('profile.payment.actionError'));
    } finally {
      setBusyCardId(null);
    }
  }, [token, busyCardId, defaultPaymentMethod, loadCards, t]);

  const confirmRemoveCard = useCallback((card) => {
    const remove = () => handleRemoveCard(card);
    const buttons = [
      { text: t('profile.payment.cancelButton'), style: 'cancel' },
      {
        text: t('profile.payment.removeButton'),
        style: 'destructive',
        onPress: remove,
      },
    ];

    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm(t('profile.payment.removeConfirmBody'))) remove();
      return;
    }

    Alert.alert(
      t('profile.payment.removeConfirmTitle'),
      t('profile.payment.removeConfirmBody'),
      buttons
    );
  }, [handleRemoveCard, t]);

  if (auth.loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#D4A017" />
        <Text style={styles.loaderText}>{t('profile.payment.loaderText')}</Text>
      </View>
    );
  }

  if (!auth.isAuthenticated) return <Redirect href="/auth/role" />;

  const roleRedirect = getRoleRedirect(role);
  if (roleRedirect) return <Redirect href={roleRedirect} />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('profile.payment.backAccessibilityLabel')}
            style={styles.backButton}
            onPress={() => {
              if (fromSignup) return finishSignup();
              if (router.canGoBack()) return router.back();
              return router.replace('/(tabs)/profile');
            }}
          >
            <Ionicons name="arrow-back" size={22} color="#1E1E1E" />
          </Pressable>
          {fromSignup ? (
            <Pressable
              accessibilityRole="button"
              style={styles.skipSignupButton}
              onPress={finishSignup}
            >
              <Text style={styles.skipSignupText}>
                {t('profile.payment.signupSkipButton')}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.header}>
          <View style={styles.iconWrapper}>
            <Ionicons name="card-outline" size={32} color="#D96C2D" />
          </View>
          <Text style={styles.title}>{t('profile.payment.title')}</Text>
          <Text style={styles.subtitle}>{t('profile.payment.subtitle')}</Text>
        </View>

        {stripeAvailable ? (
          <View style={styles.paymentOptionsInfo}>
            <Ionicons name="wallet-outline" size={20} color="#2457C5" />
            <View style={styles.paymentOptionsCopy}>
              <Text style={styles.paymentOptionsTitle}>
                {t('profile.payment.paymentOptionsTitle')}
              </Text>
              <Text style={styles.paymentOptionsText}>
                {t('profile.payment.paymentOptionsText')}
              </Text>
            </View>
          </View>
        ) : null}

        {role === 'restaurant' || role === 'livreur' ? (
          <View style={styles.partnerPayoutCard}>
            <View style={styles.partnerPayoutCopy}>
              <Text style={styles.partnerPayoutTitle}>
                {t('profile.payment.partnerPayoutTitle')}
              </Text>
              <Text style={styles.partnerPayoutText}>
                {t('profile.payment.partnerPayoutText')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              style={styles.partnerPayoutButton}
              onPress={() => router.push('/account/payouts')}
            >
              <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
              <Text style={styles.partnerPayoutButtonText}>
                {t('payouts.profileLink')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>{t('profile.payment.savedCardsTitle')}</Text>
          {refreshing ? (
            <ActivityIndicator size="small" color="#D96C2D" />
          ) : null}
        </View>

        {loadingCards ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#D96C2D" />
            <Text style={styles.loadingText}>{t('profile.payment.loadingCards')}</Text>
          </View>
        ) : cards.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="card-outline" size={24} color="#7C7369" />
            </View>
            <Text style={styles.emptyTitle}>{t('profile.payment.noPaymentMethod')}</Text>
            <Text style={styles.emptyText}>{t('profile.payment.emptyCardsText')}</Text>
          </View>
        ) : (
          <View style={styles.cardsList}>
            {cards.map((card) => {
              const isDefault = Boolean(
                card.isDefault || defaultPaymentMethod === card.id
              );
              const expiry = card.expMonth && card.expYear
                ? `${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`
                : null;

              return (
                <View key={card.id} style={styles.savedCard}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.methodIcon}>
                      <Ionicons name="card" size={23} color="#2457C5" />
                    </View>
                    <View style={styles.cardCopy}>
                      <Text style={styles.cardBrand}>
                        {card.walletType === 'apple_pay'
                          ? 'APPLE PAY'
                          : card.walletType === 'google_pay'
                            ? 'GOOGLE PAY'
                            : String(card.brand || 'card').toUpperCase()}
                      </Text>
                      <Text style={styles.cardNumber}>
                        {t('profile.payment.cardEndingIn', { last4: card.last4 || '••••' })}
                      </Text>
                      {expiry ? (
                        <Text style={styles.cardExpiry}>
                          {t('profile.payment.expirationMeta', { expiry })}
                        </Text>
                      ) : null}
                    </View>
                    {isDefault ? (
                      <View style={styles.defaultBadge}>
                        <Ionicons name="checkmark-circle" size={15} color="#1F6F43" />
                        <Text style={styles.defaultBadgeText}>
                          {t('profile.payment.defaultLabel')}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.cardActions}>
                    {!isDefault ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={Boolean(busyCardId)}
                        style={styles.secondaryAction}
                        onPress={() => handleSetDefault(card)}
                      >
                        {busyCardId === card.id ? (
                          <ActivityIndicator size="small" color="#2457C5" />
                        ) : (
                          <Text style={styles.secondaryActionText}>
                            {t('profile.payment.setDefaultButton')}
                          </Text>
                        )}
                      </Pressable>
                    ) : <View />}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('profile.payment.removeAccessibilityLabel')}
                      disabled={Boolean(busyCardId)}
                      style={styles.removeAction}
                      onPress={() => confirmRemoveCard(card)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#B43D32" />
                      <Text style={styles.removeActionText}>
                        {t('profile.payment.removeButton')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consentAccepted }}
          style={styles.consentRow}
          onPress={() => setConsentAccepted((current) => !current)}
        >
          <Ionicons
            name={consentAccepted ? 'checkbox' : 'square-outline'}
            size={22}
            color={consentAccepted ? '#1F6F43' : '#8C8379'}
          />
          <Text style={styles.consentText}>{t('profile.payment.saveConsent')}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.payment.addCardButton')}
          disabled={!consentAccepted || savingCard || Boolean(busyCardId)}
          style={[
            styles.addButton,
            (!consentAccepted || savingCard || Boolean(busyCardId)) && styles.addButtonDisabled,
          ]}
          onPress={handleAddCard}
        >
          {savingCard ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={21} color="#FFFFFF" />
              <Text style={styles.addButtonText}>{t('profile.payment.addCardButton')}</Text>
            </>
          )}
        </Pressable>

        {errorMessage ? (
          <View accessibilityRole="alert" style={styles.messageBoxError}>
            <Ionicons name="alert-circle-outline" size={19} color="#A93226" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}
        {successMessage ? (
          <View accessibilityRole="status" style={styles.messageBoxSuccess}>
            <Ionicons name="checkmark-circle-outline" size={19} color="#1F6F43" />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {fromSignup && successMessage ? (
          <Pressable
            accessibilityRole="button"
            style={styles.continueSignupButton}
            onPress={finishSignup}
          >
            <Text style={styles.continueSignupText}>
              {t('profile.payment.signupContinueButton')}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.notice}>
          <Ionicons name="lock-closed-outline" size={20} color="#2457C5" />
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>{t('profile.payment.stripeReadyTitle')}</Text>
            <Text style={styles.noticeText}>{t('profile.payment.stripeReadyText1')}</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          style={styles.refreshButton}
          onPress={refreshCards}
          disabled={refreshing || loadingCards}
        >
          <Ionicons name="refresh-outline" size={16} color="#6F675E" />
          <Text style={styles.refreshText}>{t('profile.payment.refreshButton')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { padding: 20, paddingTop: 54, paddingBottom: 40 },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F0',
  },
  loaderText: { marginTop: 14, color: '#6F675E', fontSize: 14 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EDE5D8',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipSignupButton: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE5D8',
  },
  skipSignupText: { color: '#6F675E', fontWeight: '800', fontSize: 13 },
  header: { alignItems: 'center', marginTop: 28, marginBottom: 26 },
  iconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#FFF0E4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { color: '#1E1E1E', fontSize: 28, fontWeight: '900' },
  subtitle: {
    color: '#6F675E',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 360,
  },
  paymentOptionsInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 15,
    marginBottom: 22,
    backgroundColor: '#EEF3FF',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#D9E4FA',
  },
  paymentOptionsCopy: { flex: 1 },
  paymentOptionsTitle: { color: '#24467A', fontWeight: '900', fontSize: 14 },
  paymentOptionsText: {
    color: '#52647E',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  partnerPayoutCard: {
    padding: 16,
    marginTop: -8,
    marginBottom: 22,
    borderRadius: 18,
    backgroundColor: '#F2F8F3',
    borderWidth: 1,
    borderColor: '#DCEBDD',
  },
  partnerPayoutCopy: { marginBottom: 12 },
  partnerPayoutTitle: { color: '#1F6F43', fontSize: 15, fontWeight: '900' },
  partnerPayoutText: { color: '#5F7062', fontSize: 12, lineHeight: 18, marginTop: 5 },
  partnerPayoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1F6F43',
  },
  partnerPayoutButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  continueSignupButton: {
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#1F6F43',
    marginTop: 12,
  },
  continueSignupText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { color: '#25211D', fontSize: 17, fontWeight: '900' },
  loadingCard: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFE7DC',
  },
  loadingText: { color: '#6F675E', fontSize: 13 },
  emptyCard: {
    alignItems: 'center',
    padding: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EFE7DC',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F5F1EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: { color: '#25211D', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#79736A', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  cardsList: { gap: 12 },
  savedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFE7DC',
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1 },
  cardBrand: { color: '#777067', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  cardNumber: { color: '#202020', fontSize: 16, fontWeight: '900', marginTop: 3 },
  cardExpiry: { color: '#79736A', fontSize: 12, marginTop: 4 },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#EFF8F1',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  defaultBadgeText: { color: '#1F6F43', fontSize: 11, fontWeight: '800' },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1ECE5',
    marginTop: 14,
    paddingTop: 11,
  },
  secondaryAction: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 2 },
  secondaryActionText: { color: '#2457C5', fontSize: 13, fontWeight: '800' },
  removeAction: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 5 },
  removeActionText: { color: '#A93226', fontSize: 13, fontWeight: '700' },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 20,
    paddingVertical: 4,
  },
  consentText: { flex: 1, color: '#514A43', fontSize: 13, lineHeight: 19 },
  addButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#D96C2D',
    borderRadius: 15,
    marginTop: 12,
  },
  addButtonDisabled: { opacity: 0.48 },
  addButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  messageBoxError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: '#FFF0EE',
    borderRadius: 13,
    padding: 12,
    marginTop: 12,
  },
  errorText: { flex: 1, color: '#8F2B22', fontSize: 13, lineHeight: 19 },
  messageBoxSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#EFF8F1',
    borderRadius: 13,
    padding: 12,
    marginTop: 12,
  },
  successText: { flex: 1, color: '#1F6F43', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#EEF4FF',
    borderColor: '#DCE8FF',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
  },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: '#1F3E76', fontSize: 14, fontWeight: '900', marginBottom: 6 },
  noticeText: { color: '#4F5F88', fontSize: 13, lineHeight: 19 },
  refreshButton: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 6,
  },
  refreshText: { color: '#6F675E', fontSize: 12, fontWeight: '700' },
});
