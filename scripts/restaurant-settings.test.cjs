const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('réglages restaurant : plus de messages de développeur montrés aux partenaires', () => {
  for (const lang of ['fr', 'en', 'de', 'es', 'it', 'zh']) {
    const settings = JSON.parse(read(`i18n/locales/${lang}.json`)).restaurant.settings;
    for (const value of Object.values(settings)) {
      if (typeof value === 'string') assert.doesNotMatch(value, /écran premium|On pourra brancher|peut être branché|pourra être relié|peut être relié/);
    }
  }
});

test('« Livraison & zones » ouvre un vrai écran, « Préférences de contact » le profil', () => {
  const src = read('app/restaurant/restaurant-settings.js');
  assert.match(src, /router\.push\('\/restaurant\/delivery-settings'\)/);
  assert.match(src, /router\.push\('\/restaurant\/restaurant-profile'\)/);
  assert.match(read('app/restaurant/_layout.js'), /name="delivery-settings"/);
  const screen = read('app/restaurant/delivery-settings.js');
  assert.match(screen, /updateMyRestaurant\(restaurant\._id, \{ deliveryFee, minimumOrderAmount \}, token\)/);
});

test('le restaurateur peut placer son restaurant sur la carte (adresse ou position actuelle)', () => {
  const src = read('app/restaurant/delivery-settings.js');
  assert.match(src, /locateFromAddress: true/);
  assert.match(src, /getCurrentPositionAsync/);
  assert.match(src, /positionMissing/);
});
