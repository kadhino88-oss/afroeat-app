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
  'EXPO_PUBLIC_APP_ENV',
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

test('les builds preview exigent une URL API explicite', () => {
  withEnv({ EAS_BUILD_PROFILE: 'preview', EXPO_PUBLIC_APP_ENV: 'preview' }, () => {
    assert.throws(
      () => loadConfig({ config: structuredClone(appJson.expo) }),
      /EXPO_PUBLIC_API_URL/
    );
  });
});

test('la production refuse une adresse IP privée même en HTTPS', () => {
  withEnv({
    EAS_BUILD_PROFILE: 'production',
    EXPO_PUBLIC_APP_ENV: 'production',
    EAS_BUILD_PLATFORM: 'ios',
    EXPO_PUBLIC_API_URL: 'https://192.168.1.25/api',
    EXPO_PUBLIC_STRIPE_KEY: 'pk_live_012345678901234567890123',
  }, () => {
    assert.throws(
      () => loadConfig({ config: structuredClone(appJson.expo) }),
      /domaine public HTTPS réel/
    );
  });
});

test('la production refuse une URL API qui ne termine pas par /api', () => {
  withEnv({
    EAS_BUILD_PROFILE: 'production',
    EXPO_PUBLIC_APP_ENV: 'production',
    EAS_BUILD_PLATFORM: 'ios',
    EXPO_PUBLIC_API_URL: 'https://api.afroeat.com/v1',
    EXPO_PUBLIC_STRIPE_KEY: 'pk_live_012345678901234567890123',
  }, () => {
    assert.throws(
      () => loadConfig({ config: structuredClone(appJson.expo) }),
      /terminant exactement par \/api/
    );
  });
});

test('la production accepte une URL API publique HTTPS correctement configurée', () => {
  withEnv({
    EAS_BUILD_PROFILE: 'production',
    EXPO_PUBLIC_APP_ENV: 'production',
    EAS_BUILD_PLATFORM: 'ios',
    EXPO_PUBLIC_API_URL: 'https://api.afroeat.com/api',
    EXPO_PUBLIC_STRIPE_KEY: 'pk_live_012345678901234567890123',
  }, () => {
    assert.doesNotThrow(() => loadConfig({ config: structuredClone(appJson.expo) }));
  });
});
