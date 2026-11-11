const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '..', 'components', 'WebNavBar.web.js'), 'utf8');

test('partners get their own navigation and no client cart', () => {
  assert.match(src, /LINKS_BY_ROLE/);
  assert.match(src, /restaurant: \{\s*home: '\/restaurant\/RestaurantDashboard'/);
  assert.match(src, /livreur: \{\s*home: '\/livraison'/);
  assert.match(src, /admin: \{\s*home: '\/admin'/);
  assert.match(src, /\{partner \? null : \(/);
});

test('clients and visitors keep the original links', () => {
  assert.match(src, /const links = partner \? partner\.links : LINKS/);
});

test('courier links point to the deliveries list, not to a missing page', () => {
  const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
  assert.doesNotMatch(read('app', 'livraison', 'profile.js'), /livraison-orders/);
  assert.doesNotMatch(read('app', 'livraison', 'history.js'), /livraison-orders/);
  assert.doesNotMatch(read('components', 'WebNavBar.web.js'), /livraison-orders/);
});
