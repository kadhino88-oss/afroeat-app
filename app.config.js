const { parseApiUrl, validateProductionUrl } = require('./constants/apiConfig');

const DEFAULT_DEV_API_URL = 'https://afroeat-api-test.vercel.app/api';

module.exports = ({ config }) => {
  // Développement sans variable définie : on utilise le backend et la base de test,
  // jamais le backend de production. EXPO_PUBLIC_USE_LOCAL_API=true réactive l'API locale.
  if (
    !String(process.env.EAS_BUILD_PROFILE || '').trim() &&
    !String(process.env.EXPO_PUBLIC_API_URL || '').trim() &&
    String(process.env.EXPO_PUBLIC_USE_LOCAL_API || '').trim().toLowerCase() !== 'true'
  ) {
    process.env.EXPO_PUBLIC_API_URL = DEFAULT_DEV_API_URL;
  }

  const buildProfile = String(process.env.EAS_BUILD_PROFILE || '').trim().toLowerCase();
  const isProductionBuild = buildProfile === 'production';
  const configuredAppEnv = String(process.env.EXPO_PUBLIC_APP_ENV || '').trim().toLowerCase();
  const buildPlatform = String(process.env.EAS_BUILD_PLATFORM || '').trim().toLowerCase();
  const apiUrl = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
  const stripeKey = String(process.env.EXPO_PUBLIC_STRIPE_KEY || '').trim();
  // Clé Google Maps : nom officiel, ou le nom « Api_google_maps » déjà utilisé dans les variables Expo.
  const androidMapsKey = String(
    process.env.ANDROID_GOOGLE_MAPS_API_KEY || process.env.Api_google_maps || process.env.API_GOOGLE_MAPS || ''
  ).trim();
  const enableApplePay =
    String(process.env.EXPO_PUBLIC_ENABLE_APPLE_PAY || '').trim().toLowerCase() === 'true';
  const enableGooglePay =
    String(process.env.EXPO_PUBLIC_ENABLE_GOOGLE_PAY || '').trim().toLowerCase() === 'true';
  const appleMerchantIdentifier = String(process.env.EXPO_PUBLIC_APPLE_MERCHANT_IDENTIFIER || '').trim();

  if (buildProfile && !['development', 'preview', 'production'].includes(buildProfile)) {
    throw new Error('EAS_BUILD_PROFILE doit être development, preview ou production.');
  }

  if (buildProfile && configuredAppEnv && buildProfile !== configuredAppEnv) {
    throw new Error('EXPO_PUBLIC_APP_ENV doit correspondre au profil EAS utilisé pour la build.');
  }

  if ((buildProfile === 'preview' || isProductionBuild) && !apiUrl) {
    throw new Error('Les builds EAS preview et production exigent EXPO_PUBLIC_API_URL.');
  }

  if (apiUrl) {
    const parsedApiUrl = parseApiUrl(apiUrl);
    if (isProductionBuild) validateProductionUrl(parsedApiUrl);
  }

  if (enableApplePay && !appleMerchantIdentifier) {
    throw new Error('Apple Pay ne peut être activé sans EXPO_PUBLIC_APPLE_MERCHANT_IDENTIFIER enregistré et vérifié.');
  }

  if (isProductionBuild) {
    if (!stripeKey.startsWith('pk_live_')) {
      throw new Error('Le build de production Afroeat exige une clé publique Stripe pk_live_.');
    }
    if (!androidMapsKey && buildPlatform !== 'ios') {
      throw new Error('ANDROID_GOOGLE_MAPS_API_KEY doit être configurée pour le build Android de production.');
    }
  }

  const nextConfig = { ...config };
  if (androidMapsKey) {
    nextConfig.android = {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey: androidMapsKey },
      },
    };
  }

  // Notifications Android (Firebase Cloud Messaging) : le fichier google-services.json est fourni par une
  // variable d'environnement EAS de type « fichier » (GOOGLE_SERVICES_JSON), jamais commité dans le dépôt.
  const googleServicesFile = String(process.env.GOOGLE_SERVICES_JSON || '').trim();
  if (googleServicesFile) {
    nextConfig.android = { ...(nextConfig.android || config.android), googleServicesFile };
  }

  const plugins = [...(config.plugins || [])];
  const requiredPlugins = ['expo-font', 'expo-router', 'expo-web-browser'];

  for (const requiredPlugin of requiredPlugins) {
    const alreadyExists = plugins.some((plugin) =>
      Array.isArray(plugin)
        ? plugin[0] === requiredPlugin
        : plugin === requiredPlugin
    );
    if (!alreadyExists) plugins.push(requiredPlugin);
  }

  // Wallets are opt-in. Never inherit old app.json wallet settings by default.
  for (let index = 0; index < plugins.length; index += 1) {
    const plugin = plugins[index];
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    if (pluginName !== '@stripe/stripe-react-native') continue;

    const currentOptions = Array.isArray(plugin) && plugin[1] && typeof plugin[1] === 'object'
      ? plugin[1]
      : {};
    const otherOptions = { ...currentOptions };
    delete otherOptions.merchantIdentifier;
    delete otherOptions.enableGooglePay;
    plugins[index] = [
      '@stripe/stripe-react-native',
      {
        ...otherOptions,
        ...(enableApplePay ? { merchantIdentifier: appleMerchantIdentifier } : {}),
        enableGooglePay,
      },
    ];
  }

  nextConfig.plugins = plugins;
  return nextConfig;
};
