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
import { apiPost } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

// ─── Clé publique Stripe (côté frontend, NON secrète) ─────
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_KEY || 'pk_test_VOTRE_CLE_PUBLIQUE';

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
  return apiPost(
    API_ENDPOINTS.payments.confirmOrderPayment(orderId),
    { orderId, paymentIntentId },
    token
  );
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
