const normalizeCurrency = (value) => {
  const currency = String(value || 'EUR').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : 'EUR';
};

const isExplicitlyEnabled = (value) =>
  String(value || '').trim().toLowerCase() === 'true';

/**
 * Wallet payment options are deliberately opt-in. A platform country alone is
 * not proof that Apple merchant registration or Google Pay configuration has
 * been completed. Keep ordinary card entry available otherwise.
 */
export const buildStripeWalletOptions = ({
  merchantCountryCode,
  currency = 'EUR',
} = {}) => {
  const countryCode = String(merchantCountryCode || '').trim().toUpperCase();
  const applePayEnabled = isExplicitlyEnabled(
    process.env.EXPO_PUBLIC_ENABLE_APPLE_PAY
  );
  const googlePayEnabled = isExplicitlyEnabled(
    process.env.EXPO_PUBLIC_ENABLE_GOOGLE_PAY
  );
  const appleMerchantIdentifier = String(
    process.env.EXPO_PUBLIC_APPLE_MERCHANT_IDENTIFIER || ''
  ).trim();

  if (!/^[A-Z]{2}$/.test(countryCode)) return {};

  const options = {};

  if (applePayEnabled && appleMerchantIdentifier) {
    options.applePay = { merchantCountryCode: countryCode };
  }

  if (googlePayEnabled) {
    const publishableKey = String(
      process.env.EXPO_PUBLIC_STRIPE_KEY || ''
    ).trim();
    const testEnv = publishableKey
      ? publishableKey.startsWith('pk_test_')
      : __DEV__;

    options.googlePay = {
      merchantCountryCode: countryCode,
      currencyCode: normalizeCurrency(currency),
      testEnv,
    };
  }

  return options;
};
