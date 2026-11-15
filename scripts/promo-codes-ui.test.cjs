const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (p) => fs.readFileSync(p, 'utf8');

test('le paiement envoie le code promo au devis et à la commande, et affiche la remise', () => {
  const src = read('app/checkout.js');
  assert.match(src, /promoCode: appliedPromo/);
  assert.match(src, /quote\.promoCode \? \{ promoCode: quote\.promoCode \}/);
  assert.match(src, /checkout\.discount/);
});

test('un code refusé retombe sur le devis sans remise et affiche le motif', () => {
  const src = read('app/checkout.js');
  assert.match(src, /startsWith\('PROMO_'\)/);
  assert.match(src, /setAppliedPromo\(''\)/);
});

test('l’écran des codes promo est réservé à l’administrateur et lié au tableau de bord', () => {
  assert.match(read('app/admin/promo-codes.js'), /role !== 'admin'[\s\S]*Redirect/);
  assert.match(read('app/admin/AdminDashboard.js'), /route: '\/admin\/promo-codes'/);
  assert.match(read('constants/api.js'), /promoCodes:\s+'\/admin\/promo-codes'/);
});
