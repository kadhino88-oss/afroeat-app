const isPlaceholderHost = (hostname) =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname.endsWith('.localhost') ||
  hostname.endsWith('.local') ||
  hostname.endsWith('.lan') ||
  hostname.endsWith('.internal') ||
  hostname.endsWith('.invalid') ||
  hostname.endsWith('.example') ||
  hostname.endsWith('.test');

const isPrivateIpv4Host = (hostname) => {
  const parts = String(hostname || '').split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

const isPrivateHost = (hostname) => {
  const normalized = String(hostname || '')
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  const isIpv6 = normalized.includes(':');

  return (
    isPlaceholderHost(normalized) ||
    isPrivateIpv4Host(normalized) ||
    (isIpv6 && (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      /^fe[89ab]/.test(normalized)
    )) ||
    (normalized.startsWith('::ffff:') && isPrivateIpv4Host(normalized.slice(7)))
  );
};

module.exports = ({ config }) => {
  const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production';
  const buildPlatform = process.env.EAS_BUILD_PLATFORM || '';
  const apiUrl = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
  const stripeKey = String(process.env.EXPO_PUBLIC_STRIPE_KEY || '').trim();
  const androidMapsKey = String(process.env.ANDROID_GOOGLE_MAPS_API_KEY || '').trim();

  if (isProductionBuild) {
    let parsedApiUrl;
    try {
      parsedApiUrl = new URL(apiUrl);
    } catch {
      throw new Error('Le build de production Afroeat exige EXPO_PUBLIC_API_URL avec une URL HTTPS réelle.');
    }

    if (
      parsedApiUrl.protocol !== 'https:' ||
      isPrivateHost(parsedApiUrl.hostname) ||
      parsedApiUrl.username ||
      parsedApiUrl.password
    ) {
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

  // Conserver les plugins existants et ajouter ceux requis par Expo.
  const plugins = [...(config.plugins || [])];

  const requiredPlugins = [
    'expo-font',
    'expo-router',
    'expo-web-browser',
  ];

  for (const requiredPlugin of requiredPlugins) {
    const alreadyExists = plugins.some((plugin) =>
      Array.isArray(plugin)
        ? plugin[0] === requiredPlugin
        : plugin === requiredPlugin
    );

    if (!alreadyExists) {
      plugins.push(requiredPlugin);
    }
  }

  nextConfig.plugins = plugins;

  return nextConfig;
};

[
  "expo-splash-screen",
  {
    image: "./assets/images/splash-icon.png",
    imageWidth: 200,
    resizeMode: "contain",
    backgroundColor: "#0B0B0F"
  }
]
