const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('web : barre de navigation avec retour, liens et panier ; rien sur mobile natif', () => {
  const web = read('components', 'WebNavBar.web.js');
  assert.match(web, /router\.canGoBack\(\)/);
  assert.match(web, /router\.back\(\)/);
  assert.match(web, /'\/\(tabs\)\/explore'/);
  assert.match(web, /router\.push\('\/cart'\)/);
  assert.match(read('components', 'WebNavBar.js'), /return null/);
});

test('racine : barre web dans le layout, barre d\'onglets mobile masquée sur le web', () => {
  assert.match(read('app', '_layout.js'), /<WebNavBar \/>/);
  assert.match(read('app', '(tabs)', '_layout.js'), /Platform\.OS === 'web' \? \{ display: 'none' \}/);
  assert.match(read('components', 'HomeHeader.js'), /Platform\.OS !== 'web' \?/);
});

test('navigation : pas de barre sur la page d\'accueil du site ni la connexion', () => {
  const web = read('components', 'WebNavBar.web.js');
  assert.match(web, /pathname === '\/' \|\| pathname\.startsWith\('\/auth'\)/);
});
