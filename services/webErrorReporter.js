import { Platform } from 'react-native';
import { API_BASE_URL } from '../constants/api';
import { isStaleBundleError } from './webChunkRecovery';

/**
 * Remonte les erreurs JavaScript du site vers l'API (page admin « Erreurs »).
 * Ignore le bruit (extensions, erreurs opaques, ancien bundle après déploiement),
 * n'envoie chaque message qu'une fois par session et au plus 10 par page.
 */
const NOISE = /ResizeObserver loop|^Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|Non-Error promise rejection|AbortError|The user aborted|Network request failed|Failed to fetch|Load failed/i;
const MAX_PER_PAGE = 10;
const sent = new Set();

export const shouldReport = (message) => {
  const text = String(message || '').trim();
  if (!text || NOISE.test(text) || isStaleBundleError(text)) return false;
  if (sent.has(text) || sent.size >= MAX_PER_PAGE) return false;
  sent.add(text);
  return true;
};

export const reportClientError = (message, stack = '') => {
  if (!shouldReport(message)) return;
  try {
    fetch(`${API_BASE_URL}/monitoring/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        message: String(message).slice(0, 500),
        stack: String(stack || '').slice(0, 4000),
        path: typeof window !== 'undefined' ? window.location.pathname : '',
      }),
    }).catch(() => {});
  } catch {
    // La remontée d'erreur ne doit jamais casser la page.
  }
};

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    reportClientError(event?.error?.message || event?.message, event?.error?.stack);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    reportClientError(reason?.message || (typeof reason === 'string' ? reason : ''), reason?.stack);
  });
}
