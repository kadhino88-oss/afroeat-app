const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('les pages légales publiques existent et ne demandent pas de connexion', () => {
  for (const file of ['app/legal/privacy.js', 'app/legal/terms.js']) {
    const src = read(file);
    assert.match(src, /LegalPage/);
    assert.doesNotMatch(src, /useAuth|Redirect/);
  }
});

test('la page de confidentialité mentionne suppression de compte, Stripe et nLPD', () => {
  const src = read('app/legal/privacy.js');
  assert.match(src, /Stripe/);
  assert.match(src, /nLPD/);
  assert.match(src, /suppression du compte/i);
});

test("la page d'accueil web renvoie vers les pages légales", () => {
  const src = read('app/index.web.js');
  assert.match(src, /\/legal\/privacy/);
  assert.match(src, /\/legal\/terms/);
});

test('eas.json définit appVersionSource', () => {
  assert.strictEqual(JSON.parse(read('eas.json')).cli.appVersionSource, 'remote');
});
