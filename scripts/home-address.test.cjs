const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test("accueil : l'adresse affichée vient du compte, sinon de la localisation", () => {
  const home = read('app', '(tabs)', 'index.js');
  assert.match(home, /getDeviceAddress\(\)/);
  assert.match(home, /user\?\.profile\?\.address \|\|\s*detectedAddress/);
});

test("adresse appareil : ne demande jamais la permission et échoue en silence", () => {
  const src = read('services', 'deviceAddress.js');
  assert.match(src, /getForegroundPermissionsAsync/);
  assert.doesNotMatch(src, /requestForegroundPermissionsAsync/);
  assert.match(src, /reverseGeocodeAsync/);
  assert.match(src, /catch\s*\{\s*return '';/);
});
