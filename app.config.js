const isPlaceholderHost = (hostname) =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname.endsWith('.invalid') ||
  hostname.endsWith('.example') ||
  hostname.endsWith('.test');

module.exports = ({ config }) => {
  const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production';
  const buildPlatform = process.env.EAS_BUILD_PLATFORM || '';
  const apiUrl = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
  const stripeKey = String(process.env.EXPO_PUBLIC_STRIPE_KEY || '').trim();
  const androidMapsKey = String(process.env.ANDROID_GOOGLE_MAPS_API_KEY || '').trim();
  const enableApplePay =
    String(process.env.EXPO_PUBLIC_ENABLE_APPLE_PAY || '').trim().toLowerCase() === 'true';
  const enableGooglePay =
    String(process.env.EXPO_PUBLIC_ENABLE_GOOGLE_PAY || '').trim().toLowerCase() === 'true';
  const appleMerchantIdentifier = String(process.env.EXPO_PUBLIC_APPLE_MERCHANT_IDENTIFIER || '').trim();

  if (enableApplePay && !appleMerchantIdentifier) {
    throw new Error('Apple Pay ne peut être activé sans EXPO_PUBLIC_APPLE_MERCHANT_IDENTIFIER enregistré et vérifié.');
  }

  if (isProductionBuild) {
    let parsedApiUrl;
    try {
      parsedApiUrl = new URL(apiUrl);
    } catch {
      throw new Error('Le build de production Afroeat exige EXPO_PUBLIC_API_URL avec une URL HTTPS réelle.');
    }

    if (parsedApiUrl.protocol !== 'https:' || isPlaceholderHost(parsedApiUrl.hostname)) {
      throw new Error('EXPO_PUBLIC_API_URL doit cibler l’API publique HTTPS de production.');
    }
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
