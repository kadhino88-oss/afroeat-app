const isIpAddress = (hostname) => {
  const normalized = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized) || normalized.includes(':');
};

const isLocalOrPrivateHost = (hostname) => {
  const normalized = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
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
    normalized.startsWith('169.254.') ||
    normalized.startsWith('192.168.') ||
    private172
  );
};

const isPlaceholderHost = (hostname) => {
  const normalized = String(hostname || '').trim().toLowerCase();
  return (
    !normalized.includes('.') ||
    isIpAddress(normalized) ||
    isLocalOrPrivateHost(normalized) ||
    normalized.endsWith('.invalid') ||
    normalized.endsWith('.example') ||
    normalized.endsWith('.test') ||
    ['example', 'placeholder', 'your-api', 'your-backend', 'your-domain', 'changeme', 'replace']
      .some((marker) => normalized.includes(marker))
  );
};

module.exports = ({ config }) => {
  const buildProfile = String(process.env.EAS_BUILD_PROFILE || '').trim().toLowerCase();
  const isProductionBuild = buildProfile === 'production';
  const configuredAppEnv = String(process.env.EXPO_PUBLIC_APP_ENV || '').trim().toLowerCase();
  const buildPlatform = String(process.env.EAS_BUILD_PLATFORM || '').trim().toLowerCase();
  const apiUrl = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
  const stripeKey = String(process.env.EXPO_PUBLIC_STRIPE_KEY || '').trim();
  const androidMapsKey = String(process.env.ANDROID_GOOGLE_MAPS_API_KEY || '').trim();
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
    let parsedApiUrl;
    try {
      parsedApiUrl = new URL(apiUrl);
    } catch {
      throw new Error('EXPO_PUBLIC_API_URL doit être une URL HTTP(S) valide terminant par /api.');
    }

    if (
      !['http:', 'https:'].includes(parsedApiUrl.protocol) ||
      parsedApiUrl.username ||
      parsedApiUrl.password ||
      parsedApiUrl.search ||
      parsedApiUrl.hash ||
      parsedApiUrl.pathname !== '/api'
    ) {
      throw new Error('EXPO_PUBLIC_API_URL doit être une URL HTTP(S) complète terminant exactement par /api.');
    }

    if (isProductionBuild && (parsedApiUrl.protocol !== 'https:' || isPlaceholderHost(parsedApiUrl.hostname))) {
      throw new Error('EXPO_PUBLIC_API_URL doit cibler un domaine public HTTPS réel se terminant par /api.');
    }
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
