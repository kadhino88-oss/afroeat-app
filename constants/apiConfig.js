'use strict';

const VALID_ENVIRONMENTS = new Set(['development', 'preview', 'production']);
const PLACEHOLDER_PARTS = [
  'example',
  'placeholder',
  'your-api',
  'your-backend',
  'your-domain',
  'changeme',
  'replace',
];

const isIpv4 = (host) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(String(host || ''));

const isIpAddress = (host) => {
  const normalized = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  return isIpv4(normalized) || normalized.includes(':');
};

const isLocalOrPrivateHost = (host) => {
  const normalized = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
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

const isPlaceholderHost = (host) => {
  const normalized = String(host || '').trim().toLowerCase();
  return (
    normalized.endsWith('.invalid') ||
    normalized.endsWith('.example') ||
    normalized.endsWith('.test') ||
    PLACEHOLDER_PARTS.some((part) => normalized.includes(part))
  );
};

const parseApiUrl = (value) => {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL doit être une URL HTTP(S) valide terminant par /api.');
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/api'
  ) {
    throw new Error('EXPO_PUBLIC_API_URL doit être une URL HTTP(S) complète terminant exactement par /api.');
  }

  return url;
};

const validateProductionUrl = (url) => {
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:' ||
    !hostname.includes('.') ||
    isIpAddress(hostname) ||
    isLocalOrPrivateHost(hostname) ||
    isPlaceholderHost(hostname)
  ) {
    throw new Error('En production, EXPO_PUBLIC_API_URL doit cibler un domaine public HTTPS réel se terminant par /api.');
  }
};

const resolveApiConfig = ({
  appEnv = 'development',
  configuredApiUrl = '',
  localIp = '192.168.1.121',
  localPort = '5000',
  platform = 'web',
} = {}) => {
  const environment = String(appEnv || '').trim().toLowerCase();
  if (!VALID_ENVIRONMENTS.has(environment)) {
    throw new Error('EXPO_PUBLIC_APP_ENV doit être development, preview ou production.');
  }

  const configuredUrl = String(configuredApiUrl || '').trim();
  if (configuredUrl) {
    const url = parseApiUrl(configuredUrl);
    if (environment === 'production') validateProductionUrl(url);
    return {
      baseUrl: url.origin + url.pathname,
      isProduction: environment === 'production',
      protocol: url.protocol.slice(0, -1),
      host: url.hostname,
      port: url.port || null,
    };
  }

  if (environment !== 'development') {
    throw new Error('EXPO_PUBLIC_API_URL est obligatoire pour les builds preview et production.');
  }

  let host = String(localIp || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!host || /[/?#@]/.test(host) || host.includes(':')) {
    throw new Error('EXPO_PUBLIC_LOCAL_IP doit contenir uniquement un nom d’hôte ou une adresse IP.');
  }

  if (platform === 'android' && (host === 'localhost' || host === '127.0.0.1')) {
    host = '10.0.2.2';
  }

  const portValue = String(localPort || '').trim();
  const portNumber = Number(portValue);
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    throw new Error('EXPO_PUBLIC_API_PORT doit être un port valide entre 1 et 65535.');
  }

  return {
    baseUrl: `http://${host}:${portNumber}/api`,
    isProduction: false,
    protocol: 'http',
    host,
    port: String(portNumber),
  };
};

module.exports = {
  resolveApiConfig,
  parseApiUrl,
  validateProductionUrl,
  isIpAddress,
  isLocalOrPrivateHost,
  isPlaceholderHost,
};
