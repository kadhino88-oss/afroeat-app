const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'placeService.js'), 'utf8');
const settings = fs.readFileSync(path.join(__dirname, '..', 'services', 'nearbySearchSettings.js'), 'utf8');

test('getNearbyPlaces charge restaurants ET épiceries africaines en parallèle', () => {
  assert.match(source, /request\('nearby'/);
  assert.match(source, /request\('groceriesNearby'/);
  assert.match(source, /Promise\.allSettled/);
});

test('la limite demandée couvre toute la zone (2000 par type) et le rayon va jusqu\'à 100 km', () => {
  assert.match(source, /MAX_NEARBY_PLACES = 2000/);
  assert.match(source, /distance > 100/);
  assert.match(settings, /\[5, 10, 20, 30, 50, 100\]/);
});

test('une seule source en échec ne vide pas toute la liste', () => {
  assert.match(source, /both|rejected' && groceriesResult\.status === 'rejected'/);
});
