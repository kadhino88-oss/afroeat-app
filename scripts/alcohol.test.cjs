const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (p) => fs.readFileSync(p, 'utf8');

test('les restaurateurs peuvent signaler un produit alcoolisé', () => {
  for (const f of ['app/restaurant/AddMenuItem.js', 'app/restaurant/EditMenuItem.js']) {
    const src = read(f);
    assert.match(src, /containsAlcohol,\n\s+\};/, f);
    assert.match(src, /restaurant\.alcohol\.toggle/, f);
  }
  assert.match(read('app/restaurant/MenuScreen.js'), /containsAlcohol: String\(!!item\?\.containsAlcohol\)/);
});

test('le paiement exige la confirmation de majorité quand la commande contient de l’alcool', () => {
  const src = read('app/checkout.js');
  assert.match(src, /const ageBlocked = Boolean\(quote\?\.containsAlcohol\) && !ageConfirmed;/);
  assert.match(src, /quote\.containsAlcohol \? \{ ageConfirmed: ageConfirmed === true \}/);
  assert.match(src, /!hasValidAddress \|\|\n\s+ageBlocked\n\s+\}/);
});

test('livreur, restaurant et admin voient le rappel de contrôle d’identité', () => {
  for (const f of ['app/livraison/OrderTracking.js', 'app/livraison/OrderTracking.web.js', 'app/restaurant/restaurant-orders-details/[id].js', 'app/admin/orders-details/[id].js']) {
    assert.match(read(f), /<AlcoholIdNotice order=/, f);
  }
  assert.match(read('components/AlcoholIdNotice.js'), /if \(!order\?\.containsAlcohol\) return null;/);
});

test('l’admin peut rendre visible ou masquer une fiche commerce', () => {
  assert.match(read('services/adminService.js'), /setRestaurantVisibility[\s\S]*isActive: Boolean\(isActive\)/);
  assert.match(read('app/admin/restaurants-details/[id].js'), /setRestaurantVisibility\(restaurantId, next, token\)/);
});

test('livraison par le restaurant : réglage et boutons « Partir en livraison » / « Remise au client »', () => {
  assert.match(read('app/restaurant/delivery-settings.js'), /minimumOrderAmount, selfDelivery, pickupEnabled \}/);
  const src = read('app/restaurant/restaurant-orders-details/[id].js');
  assert.match(src, /const canAssign = !selfDelivery &&/);
  assert.match(src, /runStatusChange\('En livraison'\)/);
  assert.match(src, /runStatusChange\('Livrée'\)/);
});
