const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('le client API signale une session refusée par le serveur', () => {
  const src = read('services', 'apiClient.js');
  assert.match(src, /export const setUnauthorizedHandler/);
  assert.match(src, /Number\(error\?\.status\) === 401/);
  assert.match(src, /unauthorizedHandler && isSessionRejectedError\(error, token\)/);
});

test('seul un refus de jeton déconnecte, pas un mot de passe incorrect', () => {
  const src = read('services', 'apiClient.js');
  const pattern = new RegExp(src.match(/SESSION_REJECTED_PATTERN = \/(.+)\/i;/)[1], 'i');
  assert.equal(pattern.test('Token invalide ou expiré.'), true);
  assert.equal(pattern.test('Utilisateur introuvable.'), true);
  assert.equal(pattern.test('Mot de passe actuel incorrect.'), false);
});

test('une session refusée déconnecte automatiquement', () => {
  const src = read('context', 'AuthContext.js');
  assert.match(src, /import \{ setUnauthorizedHandler \} from '\.\.\/services\/apiClient';/);
  assert.match(src, /setUnauthorizedHandler\(\(\) => \{\s+logout\(\);/);
});
