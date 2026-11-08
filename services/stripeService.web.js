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

import React from 'react';
import { apiPost } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

export const STRIPE_PUBLISHABLE_KEY = String(
  process.env.EXPO_PUBLIC_STRIPE_KEY || ''
).trim();

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

/**
 * Sur le web, le formulaire natif Stripe n'existe pas. On utilise donc
 * Stripe Checkout hébergé, puis la page de retour confirme la session
 * auprès du backend avant d'afficher une réussite.
 */
export const useAfroeatPayment = () => {
  const [loading, setLoading] = React.useState(false);

  const pay = async ({ orderId, token, onError } = {}) => {
    if (!orderId || !token) {
      const message = !orderId
        ? 'Identifiant de commande manquant.'
        : 'Session expirée. Reconnecte-toi avant de payer.';
      if (typeof onError === 'function') onError(message);
      return { success: false, error: message };
    }

    if (typeof window === 'undefined' || !window.location) {
      const message = 'Le navigateur ne permet pas de démarrer le paiement.';
      if (typeof onError === 'function') onError(message);
      return { success: false, error: message };
    }

    setLoading(true);
    try {
      const response = await apiPost(
        API_ENDPOINTS.payments.checkout,
        { orderId, platform: 'web' },
        token
      );
      const checkoutUrl = String(response?.url || '').trim();
      if (!checkoutUrl || !/^https:\/\//i.test(checkoutUrl)) {
        throw new Error(
          response?.message || 'Stripe n’a pas retourné une adresse de paiement sécurisée.'
        );
      }
      window.location.assign(checkoutUrl);
      return { success: true, redirecting: true };
    } catch (error) {
      const message = error?.message || 'Impossible d’ouvrir le paiement sécurisé.';
      if (typeof onError === 'function') onError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Pas de portefeuille natif sur le web : Stripe Checkout propose déjà Apple Pay / Google Pay.
  const payWithWallet = async () => ({ success: false, error: 'Indisponible sur le web.' });

  return { pay, payWithWallet, loading };
};
