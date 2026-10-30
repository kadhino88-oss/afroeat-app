'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const settings = fs.readFileSync(path.join(root, 'app', 'restaurant', 'restaurant-settings.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'services', 'restaurantService.js'), 'utf8');

test('restaurant settings are loaded from the API', () => {
  assert.match(settings, /getMyRestaurant\(token\)/);
  assert.match(settings, /setAutoAcceptOrders\(restaurant\.autoAcceptOrders === true\)/);
  assert.match(settings, /setNotificationsEnabled\(restaurant\.notificationsEnabled !== false\)/);
});

test('saving restaurant settings calls the authenticated update endpoint', () => {
  assert.match(settings, /updateRestaurant\(/);
  for (const key of ['isOpen', 'autoAcceptOrders', 'notificationsEnabled', 'preparationMode']) {
    assert.ok(settings.includes(`${key}:`), `missing saved setting ${key}`);
  }
  assert.match(service, /apiPut\(endpoint\(normalizedId\), payload, token\)/);
  assert.doesNotMatch(settings, /setTimeout\(/, 'settings must not simulate a successful save');
});
