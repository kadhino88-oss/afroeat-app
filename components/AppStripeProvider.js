import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY } from '../services/stripeService';

/**
 * =========================================================
 * APP STRIPE PROVIDER — NATIF (iOS / Android)
 * components/AppStripeProvider.js
 *
 * Le SDK @stripe/stripe-react-native est un module natif : il
 * n'a pas d'équivalent web. Ce wrapper isole son import du
 * reste de l'app pour que Metro utilise AppStripeProvider.web.js
 * quand on build pour le web.
 * =========================================================
 */
export default function AppStripeProvider({ children }) {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      {children}
    </StripeProvider>
  );
}
