const normalizeCurrency = (value) => {
  const currency = String(value || 'EUR').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : 'EUR';
};

export const buildStripeWalletOptions = ({
  merchantCountryCode,
  currency = 'EUR',
} = {}) => {
  const countryCode = String(merchantCountryCode || '').trim().toUpperCase();
  const publishableKey = String(process.env.EXPO_PUBLIC_STRIPE_KEY || '').trim();
  const testEnv = publishableKey
    ? publishableKey.startsWith('pk_test_')
    : __DEV__;

  // Wallet buttons require the merchant's actual country. If it has not been
  // configured on the server, keep card setup available without invalid options.
  if (!/^[A-Z]{2}$/.test(countryCode)) return {};

  return {
    applePay: { merchantCountryCode: countryCode },
    googlePay: {
      merchantCountryCode: countryCode,
      currencyCode: normalizeCurrency(currency),
      testEnv,
    },
  };
};
