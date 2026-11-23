const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const policy = require('../services/apiAuthPolicy');
const session = require('../services/sessionPolicy');
const { getRestaurantAreaRedirect } = require('../services/routeGuards');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const BASE = 'https://api.afroeat.test/api';

test('F2: the Bearer token is only allowed for the API origin', () => {
  assert.equal(policy.isTokenAllowedForUrl('/orders', BASE), true);
  assert.equal(policy.isTokenAllowedForUrl('https://api.afroeat.test/api/orders', BASE), true);
  assert.equal(policy.isTokenAllowedForUrl('https://API.afroeat.test/x', BASE), true);
  assert.equal(policy.isTokenAllowedForUrl('https://evil.test/api/orders', BASE), false);
  assert.equal(policy.isTokenAllowedForUrl('http://api.afroeat.test/api/orders', BASE), false);
  assert.equal(policy.isTokenAllowedForUrl('https://api.afroeat.test@evil.test/x', BASE), false);
  assert.equal(policy.isTokenAllowedForUrl('https://api.afroeat.test:8443/x', BASE), false);
});

test('F2: apiClient refuses cross-origin requests that carry a token', () => {
  const src = read('services', 'apiClient.js');
  assert.match(src, /isTokenAllowedForUrl\(url, API_BASE_URL\)/);
});

test('M3: app storage cleanup covers cart, inbox and pending orders but keeps language', () => {
  const keys = [
    '@afroeat_user', '@afroeat_token', '@afroeat_cart_v2',
    '@afroeat/notification-inbox:u1', '@afroeat/pending-order:abc',
    '@afroeat_language', 'other-lib-key',
  ];
  assert.deepEqual(session.selectAppStorageKeys(keys), [
    '@afroeat_user', '@afroeat_token', '@afroeat_cart_v2',
    '@afroeat/notification-inbox:u1', '@afroeat/pending-order:abc',
  ]);
});

test('M3: clearAppStorage removes every matching key, with fallback if getAllKeys fails', async () => {
  let removed;
  await session.clearAppStorage({
    getAllKeys: async () => ['@afroeat/pending-order:x', '@afroeat_language', 'zzz'],
    multiRemove: async (k) => { removed = k; },
  });
  assert.ok(removed.includes('@afroeat/pending-order:x'));
  assert.ok(removed.includes('@afroeat_token'));
  assert.ok(!removed.includes('@afroeat_language'));
  assert.ok(!removed.includes('zzz'));

  await session.clearAppStorage({
    getAllKeys: async () => { throw new Error('nope'); },
    multiRemove: async (k) => { removed = k; },
  });
  assert.deepEqual(removed, session.FALLBACK_SESSION_KEYS);
});

test('M3: logout and account deletion both use the full cleanup', () => {
  const src = read('context', 'AuthContext.js');
  assert.doesNotMatch(src, /ALL_APP_STORAGE_KEYS/);
  assert.equal((src.match(/clearAppStorage\(AsyncStorage\)/g) || []).length >= 3, true);
});

test('M2: revalidation keeps local state on network errors, logs out on 401', () => {
  assert.equal(session.classifyRevalidationError({ status: 401 }), 'unauthorized');
  assert.equal(session.classifyRevalidationError(new Error('Impossible de contacter le serveur.')), 'keep');
  assert.equal(session.classifyRevalidationError({ status: 503 }), 'keep');
  const merged = session.mergeServerProfile(
    { _id: '1', role: 'restaurant', accountStatus: 'approved', phone: '1' },
    { _id: '1', role: 'client', accountStatus: 'blocked' }
  );
  assert.equal(merged.role, 'client');
  assert.equal(merged.accountStatus, 'blocked');
  assert.equal(merged.phone, '1');
  assert.match(read('context', 'AuthContext.js'), /getMyProfile\(sessionToken\)/);
});

test('M2: restaurant management screens are guarded, public detail page is not', () => {
  const g = getRestaurantAreaRedirect;
  assert.equal(g({ hasSession: false, role: 'client', screen: 'delivery-settings' }), 'login');
  assert.equal(g({ hasSession: false, role: 'client', screen: 'opening-hours' }), 'login');
  assert.equal(g({ hasSession: false, role: 'client', screen: '[id]' }), null);
  assert.equal(g({ hasSession: true, role: 'client', screen: 'restaurant-analytics' }), 'home');
  assert.equal(g({ hasSession: true, role: 'client', screen: '[id]' }), null);
  assert.equal(g({ hasSession: true, role: 'livreur', screen: 'opening-hours' }), 'livraison');
  assert.equal(g({ hasSession: true, role: 'admin', screen: 'opening-hours' }), 'admin');
  assert.equal(g({ hasSession: true, role: 'admin', screen: 'MenuScreen' }), null);
  assert.equal(g({ hasSession: true, role: 'restaurant', screen: 'delivery-settings' }), null);
  assert.match(read('app', 'restaurant', '_layout.js'), /getRestaurantAreaRedirect\(/);
});
