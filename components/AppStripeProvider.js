import React from 'react';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { StripeProvider } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY } from '../services/stripeService';

/**
 * =========================================================
 * APP STRIPE PROVIDER — NATIF (iOS / Android)
 * components/AppStripeProvider.js
 *
 * Le SDK @stripe/stripe-react-native est un module natif :
 * il n'a pas d'équivalent web. Ce wrapper isole son import du
 * reste de l'app pour que Metro puisse utiliser à la place le
 * fichier AppStripeProvider.web.js (no-op) quand on build pour
 * le web, sans casser le bundle.
 * =========================================================
 */
export default function AppStripeProvider({ children }) {
  const urlScheme =
    Constants.appOwnership === 'expo'
      ? Linking.createURL('/--/')
      : Linking.createURL('');
  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.com.afroeat"
      urlScheme={urlScheme}
    >
      {children}
    </StripeProvider>
  );
}
