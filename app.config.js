'use strict';

const PLACEHOLDER_MARKERS = [
  'example.com',
  'example.org',
  'example.net',
  'example.invalid',
  'your-api',
  'your-backend',
  'your-domain',
  'placeholder',
  'changeme',
  '<',
  '>',
];

const isIpAddress = (host) => {
  const parts = String(host || '').split('.');
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const value = Number(part);
    return value >= 0 && value <= 255;
  });
};

const isPrivateOrLocalHost = (host) => {
  const normalized = String(host || '').trim().toLowerCase();
  const parts = normalized.split('.');
  const private172 =
    parts.length === 4 &&
    parts[0] === '172' &&
    Number(parts[1]) >= 16 &&
    Number(parts[1]) <= 31;

  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized.startsWith('10.') ||
    normalized.startsWith('127.') ||
    normalized.startsWith('192.168.') ||
    private172 ||
    isIpAddress(normalized)
  );
};

const isValidLiveStripeKey = (value) => {
  const key = String(value || '').trim();
  if (!key.startsWith('pk_live_')) return false;
  const suffix = key.slice('pk_live_'.length);
  return suffix.length >= 16 && /^[A-Za-z0-9]+$/.test(suffix);
};

const isValidProductionApiUrl = (value) => {
  const url = String(value || '').trim().replace(/[/]+$/, '');
  if (!url.toLowerCase().startsWith('https://') || !url.endsWith('/api')) {
    return false;
  }

  const authority = url.slice('https://'.length, -'/api'.length);
  if (!authority || authority.includes('@') || authority.includes('?') || authority.includes('#')) {
    return false;
  }

  const host = authority.split(':')[0].toLowerCase();
  return (
    host.includes('.') &&
    !isPrivateOrLocalHost(host) &&
    !PLACEHOLDER_MARKERS.some((marker) => url.toLowerCase().includes(marker))
  );
};

module.exports = ({ config }) => {
  const appEnv = String(process.env.EXPO_PUBLIC_APP_ENV || 'development')
    .trim()
    .toLowerCase();

  if (appEnv !== 'development' && !String(process.env.EXPO_PUBLIC_API_URL || '').trim()) {
    throw new Error(
      'Preview and production builds require an explicit EXPO_PUBLIC_API_URL.'
    );
  }

  if (appEnv === 'production') {
    if (!isValidProductionApiUrl(process.env.EXPO_PUBLIC_API_URL)) {
      throw new Error(
        'Production build blocked: configure EXPO_PUBLIC_API_URL as a public HTTPS URL ending in /api.'
      );
    }

    if (!isValidLiveStripeKey(process.env.EXPO_PUBLIC_STRIPE_KEY)) {
      throw new Error(
        'Production build blocked: configure a valid live EXPO_PUBLIC_STRIPE_KEY.'
      );
    }

    const platform = String(process.env.EAS_BUILD_PLATFORM || '').trim().toLowerCase();
    const mapsKey = String(process.env.ANDROID_GOOGLE_MAPS_API_KEY || '').trim();
    if (
      platform === 'android' &&
      (!mapsKey || PLACEHOLDER_MARKERS.some((marker) => mapsKey.toLowerCase().includes(marker)))
    ) {
      throw new Error(
        'Android production build blocked: configure ANDROID_GOOGLE_MAPS_API_KEY and restrict it to the AFROEAT package/signing certificate.'
      );
    }
  }

  const baseConfig = config || {};
  const mapsKey = String(process.env.ANDROID_GOOGLE_MAPS_API_KEY || '').trim();
  const currentAndroid = baseConfig.android || {};
  const currentAndroidConfig = currentAndroid.config || {};

  return {
    ...baseConfig,
    android: {
      ...currentAndroid,
      ...(mapsKey
        ? {
            config: {
              ...currentAndroidConfig,
              googleMaps: {
                ...(currentAndroidConfig.googleMaps || {}),
                apiKey: mapsKey,
              },
            },
          }
        : {}),
    },
  };
};
