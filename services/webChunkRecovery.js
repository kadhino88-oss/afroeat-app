import { Platform } from 'react-native';

/**
 * Après un déploiement, un onglet resté ouvert peut demander un ancien fichier JavaScript qui
 * n'existe plus : le serveur renvoie la page HTML et l'écran reste blanc
 * (« Unexpected token '<' », « Requiring unknown module »). On recharge alors la page une fois
 * pour récupérer la nouvelle version, sans boucle de rechargement.
 */
const STALE_BUNDLE = /Unexpected token '<'|Requiring unknown module|ChunkLoadError|Loading chunk \d+ failed/i;
const KEY = 'afroeat:bundle-reload-at';

export const isStaleBundleError = (message) => STALE_BUNDLE.test(String(message || ''));

const reloadOnce = () => {
  try {
    const last = Number(window.sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30000) return;
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Stockage indisponible : on recharge quand même une fois.
  }
  window.location.reload();
};

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (isStaleBundleError(event?.message || event?.error?.message)) reloadOnce();
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (isStaleBundleError(event?.reason?.message || event?.reason)) reloadOnce();
  });
}
