/**
 * =========================================================
 * STRIPE SERVICE — VERSION WEB (fallback)
 * services/stripeService.web.js
 *
 * @stripe/stripe-react-native est un module natif : il casse le
 * bundle Metro sur le web (import de codegenNativeCommands, etc).
 * Metro choisit automatiquement ce fichier (.web.js) à la place de
 * stripeService.js quand on build pour le web, donc ce fichier ne
 * doit JAMAIS importer '@stripe/stripe-react-native'.
 *
 * On garde la même API publique (mêmes exports) que
 * stripeService.js pour que app/_layout.js et app/payment.js
 * n'aient rien à savoir de la plateforme : createPaymentIntent et
 * confirmOrderPayment fonctionnent normalement (ce sont de simples
 * appels HTTP), seul useAfroeatPayment().pay() renvoie une erreur
 * claire au lieu d'ouvrir un formulaire carte natif inexistant sur
 * le web.
 * =========================================================
 */

import { apiPost } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_KEY || 'pk_test_VOTRE_CLE_PUBLIQUE';

export const createPaymentIntent = async (orderId, token) => {
  const response = await apiPost(
    API_ENDPOINTS.payments.createIntent,
    { orderId },
    token
  );

  if (!response?.clientSecret) {
    throw new Error("Impossible d'initialiser le paiement. Réessaie.");
  }

  return {
    clientSecret: response.clientSecret,
    paymentIntentId: response.paymentIntentId,
    amount: response.amount,
    currency: response.currency,
  };
};

export const confirmOrderPayment = async (orderId, paymentIntentId, token) => {
  return apiPost(
    API_ENDPOINTS.payments.confirm,
    { orderId, paymentIntentId },
    token
  );
};

const WEB_UNAVAILABLE_MESSAGE =
  "Le paiement par carte n'est pas disponible sur la version web pour le moment. Utilise l'application mobile Afroeat (Expo Go) pour payer par carte, ou choisis \"Paiement à la livraison\".";

/**
 * Sur le web, on ne peut pas présenter le formulaire carte natif
 * Stripe : on renvoie une erreur explicite plutôt que de planter.
 */
export const useAfroeatPayment = () => {
  const pay = async ({ onError }) => {
    if (typeof onError === 'function') onError(WEB_UNAVAILABLE_MESSAGE);
    return { success: false, error: WEB_UNAVAILABLE_MESSAGE };
  };

  return { pay, loading: false };
};
