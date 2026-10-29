'use strict';

const assert = require('node:assert/strict');
const buildExpoConfig = require('../app.config');

const ENV_KEYS = [
  'EXPO_PUBLIC_APP_ENV',
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_STRIPE_KEY',
  'ANDROID_GOOGLE_MAPS_API_KEY',
  'EAS_BUILD_PLATFORM',
];

const withEnv = (overrides, callback) => {
  const previous = {};
  for (const key of ENV_KEYS) {
    previous[key] = process.env[key];
    if (!Object.prototype.hasOwnProperty.call(overrides, key) || overrides[key] === null) {
      delete process.env[key];
    } else {
      process.env[key] = String(overrides[key]);
    }
  }

  try {
    return callback();
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
};

const baseConfig = {
  name: 'Afroeat',
  slug: 'afroeat',
  android: {
    package: 'com.bkentreprise.afroeat',
  },
};

const runConfig = (env) => withEnv(env, () => buildExpoConfig({ config: baseConfig }));

assert.doesNotThrow(() => runConfig({
  EXPO_PUBLIC_APP_ENV: 'development',
  EXPO_PUBLIC_API_URL: null,
  EXPO_PUBLIC_STRIPE_KEY: null,
  ANDROID_GOOGLE_MAPS_API_KEY: null,
  EAS_BUILD_PLATFORM: null,
}));

assert.throws(
  () => runConfig({
    EXPO_PUBLIC_APP_ENV: 'preview',
    EXPO_PUBLIC_API_URL: null,
    EXPO_PUBLIC_STRIPE_KEY: null,
    ANDROID_GOOGLE_MAPS_API_KEY: null,
    EAS_BUILD_PLATFORM: null,
  }),
  /explicit EXPO_PUBLIC_API_URL/
);

assert.throws(
  () => runConfig({
    EXPO_PUBLIC_APP_ENV: 'production',
    EXPO_PUBLIC_API_URL: 'http://api.afroeat.com/api',
    EXPO_PUBLIC_STRIPE_KEY: 'pk_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    ANDROID_GOOGLE_MAPS_API_KEY: null,
    EAS_BUILD_PLATFORM: 'ios',
  }),
  /public HTTPS/
);

assert.throws(
  () => runConfig({
    EXPO_PUBLIC_APP_ENV: 'production',
    EXPO_PUBLIC_API_URL: 'https://api.example.com/api',
    EXPO_PUBLIC_STRIPE_KEY: 'pk_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    ANDROID_GOOGLE_MAPS_API_KEY: null,
    EAS_BUILD_PLATFORM: 'ios',
  }),
  /public HTTPS/
);

assert.throws(
  () => runConfig({
    EXPO_PUBLIC_APP_ENV: 'production',
    EXPO_PUBLIC_API_URL: 'https://api.afroeat.com/api',
    EXPO_PUBLIC_STRIPE_KEY: 'pk_test_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    ANDROID_GOOGLE_MAPS_API_KEY: null,
    EAS_BUILD_PLATFORM: 'ios',
  }),
  /valid live EXPO_PUBLIC_STRIPE_KEY/
);

assert.doesNotThrow(() => runConfig({
  EXPO_PUBLIC_APP_ENV: 'production',
  EXPO_PUBLIC_API_URL: 'https://api.afroeat.com/api',
  EXPO_PUBLIC_STRIPE_KEY: 'pk_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  ANDROID_GOOGLE_MAPS_API_KEY: null,
  EAS_BUILD_PLATFORM: 'ios',
}));

assert.throws(
  () => runConfig({
    EXPO_PUBLIC_APP_ENV: 'production',
    EXPO_PUBLIC_API_URL: 'https://api.afroeat.com/api',
    EXPO_PUBLIC_STRIPE_KEY: 'pk_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    ANDROID_GOOGLE_MAPS_API_KEY: null,
    EAS_BUILD_PLATFORM: 'android',
  }),
  /ANDROID_GOOGLE_MAPS_API_KEY/
);

assert.throws(
  () => runConfig({
    EXPO_PUBLIC_APP_ENV: 'production',
    EXPO_PUBLIC_API_URL: 'https://api.afroeat.com/api',
    EXPO_PUBLIC_STRIPE_KEY: 'pk_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    ANDROID_GOOGLE_MAPS_API_KEY: 'AIzaSyB0123456789_RestrictedExampleKey',
    EAS_BUILD_PLATFORM: 'android',
  }),
  /ANDROID_GOOGLE_MAPS_API_KEY/
);

const validMapsKey = 'AIza' + '0123456789abcdefABCDEF0123456789XYZ';
const androidConfig = runConfig({
  EXPO_PUBLIC_APP_ENV: 'production',
  EXPO_PUBLIC_API_URL: 'https://api.afroeat.com/api',
  EXPO_PUBLIC_STRIPE_KEY: 'pk_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  ANDROID_GOOGLE_MAPS_API_KEY: validMapsKey,
  EAS_BUILD_PLATFORM: 'android',
});

assert.equal(
  androidConfig.android.config.googleMaps.apiKey,
  validMapsKey
);

process.stdout.write('Expo environment guard checks passed (9 cases).\n');
