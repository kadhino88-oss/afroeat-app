
/**
 * =========================================================
 * STRIPE SERVICE — AFROEAT FRONTEND
 * services/stripeService.js
 *
 * Dépendance :
 *   npx expo install @stripe/stripe-react-native
 *
 * Configuration :
 *   STRIPE_PUBLISHABLE_KEY dans app/_layout.js via StripeProvider.
 *   EXPO_PUBLIC_STRIPE_KEY dans l'environnement Expo.
 * =========================================================
 */

import { useStripe } from '@stripe/stripe-react-native';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { apiPost } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

// Clé publique Stripe uniquement. Ne jamais mettre la clé secrète
// Stripe dans l'application mobile.
export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_KEY ||
  'pk_test_VOTRE_CLE_PUBLIQUE';

/**
 * Crée un PaymentIntent auprès du backend.
 * Le serveur reste responsable du montant et de la devise.
 */
export const createPaymentIntent = async (orderId, token) => {
  if (!orderId) {
    throw new Error('Identifiant de commande manquant.');
  }

  if (!token) {
    throw new Error('Tu dois être connecté pour effectuer un paiement.');
  }

  if (!API_ENDPOINTS?.payments?.createIntent) {
    throw new Error('La route de création du paiement est mal configurée.');
  }

  const response = await apiPost(
    API_ENDPOINTS.payments.createIntent,
    { orderId },
    token
  );

  if (!response?.clientSecret) {
    throw new Error(
      response?.message ||
      'Impossible d’initialiser le paiement. Réessaie.'
    );
  }

  return {
    clientSecret: response.clientSecret,
    paymentIntentId: response.paymentIntentId || null,
    customerSessionClientSecret:
      response.customerSessionClientSecret || null,
    amount: response.amount,
    currency: response.currency,
  };
};

/**
 * Demande au backend de vérifier le paiement Stripe.
 *
 * Le backend doit récupérer le PaymentIntent auprès de Stripe,
 * vérifier son statut, son montant, sa devise et son lien avec
 * la commande avant de marquer la commande comme payée.
 */
export const confirmOrderPayment = async (
  orderId,
  paymentIntentId,
  token
) => {
  if (!orderId || !paymentIntentId) {
    throw new Error(
      'Informations manquantes pour confirmer le paiement.'
    );
  }

  if (!token) {
    throw new Error(
      'Session expirée. Reconnecte-toi pour vérifier le paiement.'
    );
  }

  if (!API_ENDPOINTS?.payments?.confirm) {
    throw new Error('La route de confirmation du paiement est mal configurée.');
  }

  return apiPost(
    API_ENDPOINTS.payments.confirm,
    { orderId, paymentIntentId },
    token
  );
};

/**
 * Hook principal de paiement AFROEAT.
 *
 * Flux :
 * 1. Création du PaymentIntent côté serveur.
 * 2. Confirmation du paiement via Stripe.
 * 3. Vérification du paiement par le backend.
 *
 * IMPORTANT :
 * Le panier ne doit pas être vidé ici. C'est à l'écran appelant
 * de le vider uniquement après une confirmation serveur réussie.
 */
const getStripeReturnURL = () =>
  Constants.appOwnership === 'expo'
    ? Linking.createURL('/--/')
    : Linking.createURL('');

export const useAfroeatPayment = () => {
  const { initPaymentSheet, presentPaymentSheet, confirmPayment, loading } = useStripe();

  const pay = async ({
    orderId,
    token,
    paymentMethodId = null,
    onSuccess,
    onError,
  } = {}) => {
    try {
      if (!orderId) {
        throw new Error('Aucune commande à payer.');
      }

      if (!token) {
        throw new Error(
          'Tu dois être connecté pour effectuer un paiement.'
        );
      }

      // Le backend détermine le montant et renvoie le secret client ainsi que
      // l'identifiant exact du PaymentIntent à confirmer ensuite côté serveur.
      const {
        clientSecret,
        paymentIntentId,
        customerSessionClientSecret,
      } = await createPaymentIntent(orderId, token);

      if (!paymentIntentId) {
        throw new Error(
          'Stripe n’a pas retourné l’identifiant du paiement. Aucun paiement n’a été confirmé.'
        );
      }

      if (paymentMethodId) {
        // Carte enregistrée dans le profil : aucune saisie de carte ici.
        // confirmPayment ouvre lui-même l'écran de validation de la banque
        // (3-D Secure) à l'intérieur de l'appli quand elle l'exige.
        if (typeof confirmPayment !== 'function') {
          throw new Error(
            'La confirmation sécurisée Stripe n’est pas disponible sur cet appareil.'
          );
        }

        const { error: confirmationError } = await confirmPayment(clientSecret, {
          paymentMethodType: 'Card',
          paymentMethodData: { paymentMethodId },
        });

        if (confirmationError?.code === 'Canceled') {
          return {
            success: false,
            canceled: true,
          };
        }

        if (confirmationError) {
          throw new Error(
            confirmationError.localizedMessage ||
            confirmationError.message ||
            'Le paiement a échoué. Tu peux réessayer.'
          );
        }
      } else {
        if (
          typeof initPaymentSheet !== 'function' ||
          typeof presentPaymentSheet !== 'function'
        ) {
          throw new Error(
            'Le formulaire sécurisé Stripe n’est pas disponible sur cet appareil.'
          );
        }

        // PaymentSheet collecte les informations de carte dans l'interface native
        // Stripe et gère les étapes d'authentification comme 3D Secure.
        const { error: initializationError } = await initPaymentSheet({
          merchantDisplayName: 'AFROEAT',
          paymentIntentClientSecret: clientSecret,
          ...(customerSessionClientSecret
            ? { customerSessionClientSecret }
            : {}),
          returnURL: getStripeReturnURL(),
          allowsDelayedPaymentMethods: false,
        });

        if (initializationError) {
          throw new Error(
            initializationError.localizedMessage ||
            initializationError.message ||
            'Impossible d’ouvrir le formulaire de paiement Stripe.'
          );
        }

        const { error: presentationError, didCancel } =
          await presentPaymentSheet();

        if (didCancel || presentationError?.code === 'Canceled') {
          return {
            success: false,
            canceled: true,
          };
        }

        if (presentationError) {
          throw new Error(
            presentationError.localizedMessage ||
            presentationError.message ||
            'Le paiement a échoué. Tu peux réessayer.'
          );
        }
      }

      // La confirmation serveur récupère l'état réel auprès de Stripe avant
      // que l'application n'annonce le paiement comme réussi.
      const serverConfirmation = await confirmOrderPayment(
        orderId,
        paymentIntentId,
        token
      );

      if (!serverConfirmation?.success) {
        throw new Error(
          serverConfirmation?.message ||
          'Stripe a traité le paiement, mais AFROEAT n’a pas pu confirmer la commande. Vérifie son état avant de réessayer.'
        );
      }

      if (typeof onSuccess === 'function') {
        await onSuccess({
          id: paymentIntentId,
          status: 'Succeeded',
          serverConfirmation,
        });
      }

      return {
        success: true,
        paymentIntentId,
        serverConfirmation,
      };
    } catch (err) {
      const message =
        err?.message ||
        'Une erreur est survenue lors du paiement.';

      if (typeof onError === 'function') {
        try {
          onError(message);
        } catch (callbackError) {
          // Une erreur d'affichage ne doit pas masquer l'erreur initiale.
        }
      }

      return {
        success: false,
        error: message,
      };
    }
  };

  return { pay, loading };
};
