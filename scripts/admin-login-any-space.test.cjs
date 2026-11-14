const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'auth', 'login.js'), 'utf8');

test('un administrateur n’est pas refusé sur la page de connexion normale', () => {
  assert.match(
    source,
    /currentRole !== 'admin' &&\s+normalizedLoggedRole !== 'admin' &&\s+normalizedLoggedRole !== currentRole/
  );
});

test('après connexion, un administrateur est envoyé vers /admin', () => {
  assert.match(source, /if \(safeRole === 'admin'\) \{\s+return '\/admin';/);
});
