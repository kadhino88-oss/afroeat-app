// Jeton de défi de la double authentification : gardé en mémoire (jamais dans l'adresse ni le stockage).
let pending = '';
export const setPendingChallenge = (token) => { pending = String(token || ''); };
export const takePendingChallenge = () => pending;
export const clearPendingChallenge = () => { pending = ''; };
