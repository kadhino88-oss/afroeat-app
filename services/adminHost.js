/**
 * Adresse dédiée à l'administration (afroeat-admin.…).
 * Chaque adresse garde sa propre connexion : on peut rester connecté en administrateur ici
 * tout en utilisant le site public avec un autre compte.
 */
const ADMIN_HOST_PATTERN = /^afroeat-admin\./;

const currentHostname = () =>
  typeof window !== 'undefined' && window.location ? String(window.location.hostname || '') : '';

export const isAdminHost = () => ADMIN_HOST_PATTERN.test(currentHostname());

/** Adresses du site public : l'administration n'y est ni accessible ni visible. */
const PUBLIC_SITE_HOSTS = ['afroeat-app.vercel.app'];

/**
 * L'administration n'existe que sur son adresse dédiée. Sur le site public, ses pages se
 * comportent comme des pages inexistantes. (Sites de test et développement : non concernés.)
 */
export const isAdminAreaAllowed = () => !PUBLIC_SITE_HOSTS.includes(currentHostname());

/** Adresse du site public correspondant à l'adresse d'administration. */
export const getPublicSiteUrl = () =>
  `https://${currentHostname().replace(ADMIN_HOST_PATTERN, 'afroeat-app.')}`;

export const openPublicSite = () => {
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(getPublicSiteUrl(), '_blank', 'noopener');
  }
};
