import { useStripe } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

const getStripeReturnURL = () =>
  Constants.appOwnership === 'expo'
    ? Linking.createURL('/--/')
    : Linking.createURL('');

export const useSavedCardStripe = () => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  return {
    initPaymentSheet,
    presentPaymentSheet,
    getStripeReturnURL,
    stripeAvailable: true,
  };
};
