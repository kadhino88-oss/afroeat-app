import React from 'react';

/**
 * =========================================================
 * APP STRIPE PROVIDER — WEB (no-op)
 * components/AppStripeProvider.web.js
 *
 * Sur le web, @stripe/stripe-react-native n'est pas disponible
 * (module natif). Metro choisit automatiquement ce fichier
 * (.web.js) à la place de AppStripeProvider.js quand on build
 * pour le web : on se contente de rendre les enfants tels quels,
 * sans StripeProvider. Le paiement carte n'est pas disponible
 * sur web (voir services/stripeService.web.js) mais le reste de
 * l'app charge normalement.
 * =========================================================
 */
export default function AppStripeProvider({ children }) {
  return children;
}
