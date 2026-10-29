/**
 * =========================================================
 * STRIPE SERVICE — AFROEAT FRONTEND
 * services/stripeService.js
 *
 * Installation requise :
 *   npx expo install @stripe/stripe-react-native
 *
 * Dans app/_layout.js, entourer AppStack avec StripeProvider :
 *   import { StripeProvider } from '@stripe/stripe-react-native';
 *   <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
 *     <AppStack />
 *   </StripeProvider>
 * =========================================================
 */

import { useStripe } from '@stripe/stripe-react-native';
import { apiGet, apiPost } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

// ─── Clé publique Stripe (côté frontend, NON secrète) ─────
export const STRIPE_PUBLISHABLE_KEY = String(
  process.env.EXPO_PUBLIC_STRIPE_KEY || ''
).trim();

const APP_ENV = String(process.env.EXPO_PUBLIC_APP_ENV || 'development')
  .trim()
  .toLowerCase();
const IS_PRODUCTION_BUILD = APP_ENV === 'production';

const isValidStripePublishableKey = (key) => {
  const value = String(key || '').trim();
  const prefix = value.startsWith('pk_live_')
    ? 'pk_live_'
    : value.startsWith('pk_test_')
      ? 'pk_test_'
      : '';

  if (!prefix) return false;

  const suffix = value.slice(prefix.length);
  return suffix.length >= 16 && /^[A-Za-z0-9]+$/.test(suffix);
};

if (
  IS_PRODUCTION_BUILD &&
  (!STRIPE_PUBLISHABLE_KEY.startsWith('pk_live_') ||
    !isValidStripePublishableKey(STRIPE_PUBLISHABLE_KEY))
) {
  throw new Error(
    'EXPO_PUBLIC_STRIPE_KEY doit contenir une clé publique Stripe live valide pour une build de production.'
  );
}

/**
 * Crée un PaymentIntent côté backend et retourne le clientSecret.
 */
export const createPaymentIntent = async (orderId, token) => {
  const response = await apiPost(
    API_ENDPOINTS.payments.createIntent,
    { orderId },
    token
  );

  if (!response?.clientSecret) {
    throw new Error('Impossible d\'initialiser le paiement. Réessaie.');
  }

  return {
    clientSecret:    response.clientSecret,
    paymentIntentId: response.paymentIntentId,
    amount:          response.amount,
    currency:        response.currency,
  };
};

/**
 * Confirme le paiement côté backend après succès Stripe.
 */
export const confirmOrderPayment = async (orderId, paymentIntentId, token) => {
  // NB : la route backend disponible est /payments/confirm (voir paymentRoutes.js),
  // il n'existe pas de route /payments/orders/:id/confirm cote serveur.
  return apiPost(
    API_ENDPOINTS.payments.confirm,
    { orderId, paymentIntentId },
    token
  );
};

/**
 * Read the payment options authorized by the backend for this environment.
 * An unavailable response is not treated as permission to accept a payment.
 */
const hasConfiguredPublishableKey = () =>
  isValidStripePublishableKey(STRIPE_PUBLISHABLE_KEY);

export const getAvailablePaymentMethods = async (token) => {
  const response = await apiGet(API_ENDPOINTS.payments.methods, token);
  const methods = response?.methods || {};
  return {
    card: methods.card === true && hasConfiguredPublishableKey(),
    cash: methods.cash === true,
  };
};

/**
 * Select cash-on-delivery only when the backend explicitly accepts it.
 * The backend rejects this method in production until the settlement ledger exists.
 */
export const selectCashPayment = async (orderId, token) => {
  if (!orderId || !token) {
    throw new Error('Commande ou session manquante.');
  }
  const response = await apiPost(
    API_ENDPOINTS.payments.selectCash,
    { orderId },
    token
  );
  if (response?.success !== true || response?.paymentMethod !== 'cash') {
    throw new Error('Le paiement à la livraison n’a pas été confirmé par le serveur.');
  }
  return response;
};

/**
 * Hook principal de paiement Afroeat.
 * Gère le flow complet : intent → confirm → webhook.
 */
export const useAfroeatPayment = () => {
  const { confirmPayment, loading } = useStripe();

  const pay = async ({ orderId, token, onSuccess, onError }) => {
    try {
      // 1. Créer le PaymentIntent côté backend
      const { clientSecret, paymentIntentId } = await createPaymentIntent(orderId, token);

      // 2. Présenter le formulaire de paiement Stripe
      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
        paymentMethodData: {
          billingDetails: {},
        },
      });

      if (error) {
        throw new Error(error.message || 'Paiement refusé.');
      }

      if (paymentIntent?.status !== 'Succeeded') {
        throw new Error('Paiement non finalisé. Réessaie.');
      }

      // 3. Confirmer côté backend (double vérification)
      await confirmOrderPayment(orderId, paymentIntentId, token);

      if (typeof onSuccess === 'function') onSuccess(paymentIntent);

      return { success: true, paymentIntent };
    } catch (err) {
      const message = err?.message || 'Une erreur est survenue lors du paiement.';
      if (typeof onError === 'function') onError(message);
      return { success: false, error: message };
    }
  };

  return { pay, loading };
};
