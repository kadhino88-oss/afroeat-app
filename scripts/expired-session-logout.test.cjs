const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('le client API signale une session refusée par le serveur', () => {
  const src = read('services', 'apiClient.js');
  assert.match(src, /export const setUnauthorizedHandler/);
  assert.match(src, /shouldLogoutOnUnauthorized/);
  assert.match(src, /unauthorizedHandler && isSessionRejectedError\(error, token, url\)/);
});

test('tout 401 authentifié déconnecte, sauf routes d\'identifiants', () => {
  const { shouldLogoutOnUnauthorized: f } = require('../services/apiAuthPolicy');
  assert.equal(f({ status: 401, token: 't', endpoint: '/orders' }), true);
  assert.equal(f({ status: 401, token: 't', endpoint: 'https://x.test/api/users/me?x=1' }), true);
  assert.equal(f({ status: 401, token: null, endpoint: '/orders' }), false);
  assert.equal(f({ status: 403, token: 't', endpoint: '/orders' }), false);
  for (const e of ['/users/login', '/users/login/2fa', '/users/forgot-password',
    '/users/reset-password', '/users/me/password', '/users/verify-identity', '/admin/2fa/disable']) {
    assert.equal(f({ status: 401, token: 't', endpoint: e }), false, e);
  }
});

test('une session refusée déconnecte automatiquement', () => {
  const src = read('context', 'AuthContext.js');
  assert.match(src, /import \{ setUnauthorizedHandler \} from '\.\.\/services\/apiClient';/);
  assert.match(src, /setUnauthorizedHandler\(\(\) => \{\s+logout\(\);/);
});
