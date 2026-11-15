const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('le paiement propose le carnet d’adresses et envoie l’adresse choisie', () => {
  const src = fs.readFileSync('app/checkout.js', 'utf8');
  assert.match(src, /listMyAddresses/);
  assert.match(src, /const deliveryAddress = pickedAddress\?\.address \|\| profileAddress/);
  assert.match(src, /deliveryAddress: normalizeText\(deliveryAddress\)/);
});

test('les appels du carnet utilisent les routes /users/me/addresses', () => {
  assert.match(fs.readFileSync('constants/api.js', 'utf8'), /addresses:\s+'\/users\/me\/addresses'/);
  const svc = fs.readFileSync('services/userService.js', 'utf8');
  for (const fn of ['listMyAddresses', 'saveMyAddress', 'removeMyAddress']) assert.match(svc, new RegExp(`export const ${fn}`));
});
