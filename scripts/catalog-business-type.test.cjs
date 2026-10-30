'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('catalog search sends businessType and uses the backend isOpen parameter', () => {
  const service = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'restaurantService.js'),
    'utf8',
  );
  const searchStart = service.indexOf('export const searchRestaurants = async ({');
  const searchEnd = service.indexOf('export const getNearbyRestaurants = async ({', searchStart);
  assert.ok(searchStart >= 0 && searchEnd > searchStart, 'searchRestaurants implementation must exist');
  const search = service.slice(searchStart, searchEnd);
  assert.ok(search.includes("businessType = ''"), 'searchRestaurants must accept a business type');
  assert.ok(search.includes('businessType: normalizeText(businessType).toLowerCase()'));
  assert.ok(search.includes('isOpen: normalizeBoolean(isOpen, null)'));
  assert.ok(!search.includes('open: normalizeBoolean(isOpen, null)'), 'use the backend isOpen parameter name');
});

test('Explore loads grocery, drinks and shops through server-side business type filters', () => {
  const screen = fs.readFileSync(
    path.join(__dirname, '..', 'app', '(tabs)', 'explore.js'),
    'utf8',
  );
  assert.ok(screen.includes('getAllRestaurants, searchRestaurants'));
  assert.ok(screen.includes("'Épicerie': 'grocery'"));
  assert.ok(screen.includes("'Boissons': 'drinks'"));
  assert.ok(screen.includes("'Boutique': 'shop'"));
  assert.ok(screen.includes('searchRestaurants({ businessType, token: tokenRef.current })'));
  assert.ok(screen.includes('}, [activeFilter]);'));
});
