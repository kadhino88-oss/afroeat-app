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

test('clients and visitors get the public site links, partners their own', () => {
  assert.match(src, /const links = partner\s+\? partner\.links\s+: SITE_LINKS\.filter/);
  assert.match(src, /labelKey: 'nav\.explore', href: EXPLORE/);
});

test('the public bar matches the homepage brand, the admin bar is clearly different', () => {
  assert.doesNotMatch(src, /AfroEats|Afro<Text/);
  assert.match(src, />AFROEAT</);
  assert.match(src, /dark \? 'ADMINISTRATION' : 'LES SAVEURS DE CHEZ NOUS'/);
  assert.match(src, /const dark = Boolean\(partner\) && onAdminArea/);
});

test('the web scroll helper is mounted and the homepage is full width', () => {
  const layout = fs.readFileSync(path.join(__dirname, '..', 'app', '_layout.js'), 'utf8');
  assert.match(layout, /<WebScrollAssist \/>/);
  assert.match(layout, /pathname === '\/' && styles\.webContentFull/);
  const assist = fs.readFileSync(path.join(__dirname, '..', 'components', 'WebScrollAssist.web.js'), 'utf8');
  assert.match(assist, /addEventListener\('wheel'/);
  assert.match(assist, /addEventListener\('keydown'/);
});

test('courier links point to the deliveries list, not to a missing page', () => {
  const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
  assert.doesNotMatch(read('app', 'livraison', 'profile.js'), /livraison-orders/);
  assert.doesNotMatch(read('app', 'livraison', 'history.js'), /livraison-orders/);
  assert.doesNotMatch(read('components', 'WebNavBar.web.js'), /livraison-orders/);
});
