const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (p) => fs.readFileSync(p, 'utf8');

test('la connexion bascule vers le second facteur quand l’API le demande', () => {
  assert.match(read('services/authService.js'), /requires2FA[\s\S]*challengeToken/);
  assert.match(read('app/auth/login.js'), /requires2FA[\s\S]*\/auth\/two-factor/);
});

test('le jeton de défi reste en mémoire (ni URL ni stockage)', () => {
  const src = read('services/twoFactorChallenge.js');
  assert.doesNotMatch(src, /AsyncStorage|localStorage|SecureStore/);
  assert.doesNotMatch(read('app/auth/login.js'), /two-factor\?.*challenge/);
});

test('l’écran de sécurité est réservé à l’administrateur et accessible depuis le tableau de bord', () => {
  assert.match(read('app/admin/security.js'), /role !== 'admin'[\s\S]*Redirect/);
  assert.match(read('app/admin/AdminDashboard.js'), /route: '\/admin\/security'/);
});

test('points d’entrée API de la double authentification déclarés', () => {
  const api = read('constants/api.js');
  for (const k of ['loginTwoFactor', 'twoFactorStatus', 'twoFactorSetup', 'twoFactorEnable', 'twoFactorDisable']) assert.match(api, new RegExp(k));
});
