'use strict';

// Pure session helpers for AuthContext (no React Native imports, testable in node).

const APP_STORAGE_PREFIX = '@afroeat';
// Device preferences that are not tied to an account survive logout.
const PRESERVED_STORAGE_KEYS = ['@afroeat_language'];

// Static fallback when AsyncStorage.getAllKeys is unavailable.
const FALLBACK_SESSION_KEYS = [
  '@afroeat_user',
  '@afroeat_token',
  '@afroeat_selected_role',
  '@afroeat_cart_v2',
];

const selectAppStorageKeys = (keys) =>
  (Array.isArray(keys) ? keys : []).filter(
    (key) =>
      typeof key === 'string' &&
      key.startsWith(APP_STORAGE_PREFIX) &&
      !PRESERVED_STORAGE_KEYS.includes(key)
  );

// Removes every account-related app key (session, cart, notification inbox, pending orders…).
const clearAppStorage = async (storage) => {
  let keys = FALLBACK_SESSION_KEYS;
  try {
    const all = await storage.getAllKeys();
    keys = Array.from(new Set([...FALLBACK_SESSION_KEYS, ...selectAppStorageKeys(all)]));
  } catch {
    // keep the static fallback list
  }
  await storage.multiRemove(keys);
  return keys;
};

// Outcome of revalidating the stored session against GET /users/me.
//   'unauthorized' -> log out; 'keep' -> network/server error, keep local state.
const classifyRevalidationError = (error) =>
  Number(error?.status) === 401 ? 'unauthorized' : 'keep';

// Server is the source of truth for role / accountStatus; keep other local fields.
const mergeServerProfile = (localUser, serverUser) => ({
  ...(localUser || {}),
  ...(serverUser || {}),
  _id: serverUser?._id || localUser?._id,
});

module.exports = {
  selectAppStorageKeys,
  clearAppStorage,
  classifyRevalidationError,
  mergeServerProfile,
  PRESERVED_STORAGE_KEYS,
  FALLBACK_SESSION_KEYS,
};
