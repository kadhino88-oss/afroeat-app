// Stripe's React Native SDK contains native code and must not be imported by
// Metro's web bundle. Saved cards can still be listed on web; adding cards
// requires the native app PaymentSheet.
export const useSavedCardStripe = () => ({
  initPaymentSheet: null,
  presentPaymentSheet: null,
  getStripeReturnURL: () => null,
  stripeAvailable: false,
});
