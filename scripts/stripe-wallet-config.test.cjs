const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const loadConfig = require(path.join(__dirname, '..', 'app.config.js'));
const appJson = require(path.join(__dirname, '..', 'app.json'));
const walletEnvNames = [
  'EXPO_PUBLIC_ENABLE_APPLE_PAY',
  'EXPO_PUBLIC_ENABLE_GOOGLE_PAY',
  'EXPO_PUBLIC_APPLE_MERCHANT_IDENTIFIER',
  'EAS_BUILD_PROFILE',
  'EAS_BUILD_PLATFORM',
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_STRIPE_KEY',
  'ANDROID_GOOGLE_MAPS_API_KEY',
];

const withEnv = (overrides, callback) => {
  const previous = Object.fromEntries(
    walletEnvNames.map((key) => [key, process.env[key]])
  );

  for (const key of walletEnvNames) delete process.env[key];
  Object.assign(process.env, overrides);

  try {
    return callback();
  } finally {
    for (const key of walletEnvNames) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
};

const getStripePluginOptions = (config) => {
  const resolved = loadConfig({ config });
  const plugin = resolved.plugins.find((entry) =>
    Array.isArray(entry) && entry[0] === '@stripe/stripe-react-native'
  );
  assert.ok(plugin, 'le plugin Stripe doit rester configuré');
  return plugin[1] || {};
};

test('les wallets sont désactivés par défaut', () => {
  withEnv({}, () => {
    const options = getStripePluginOptions(structuredClone(appJson.expo));
    assert.equal(options.enableGooglePay, false);
    assert.equal(Object.hasOwn(options, 'merchantIdentifier'), false);
  });
});

test('Apple Pay refuse une activation sans identifiant marchand', () => {
  withEnv({ EXPO_PUBLIC_ENABLE_APPLE_PAY: 'true' }, () => {
    assert.throws(
      () => getStripePluginOptions(structuredClone(appJson.expo)),
      /EXPO_PUBLIC_APPLE_MERCHANT_IDENTIFIER/
    );
  });
});

test('les wallets ne sont activés que par opt-in explicite', () => {
  withEnv({
    EXPO_PUBLIC_ENABLE_APPLE_PAY: 'true',
    EXPO_PUBLIC_APPLE_MERCHANT_IDENTIFIER: 'merchant.com.afroeat.verified',
    EXPO_PUBLIC_ENABLE_GOOGLE_PAY: 'true',
  }, () => {
    const options = getStripePluginOptions(structuredClone(appJson.expo));
    assert.equal(options.merchantIdentifier, 'merchant.com.afroeat.verified');
    assert.equal(options.enableGooglePay, true);
  });
});
