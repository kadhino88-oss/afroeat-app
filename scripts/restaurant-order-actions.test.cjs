const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'app', 'restaurant', 'restaurant-orders-details', '[id].js'),
  'utf8'
);

test('restaurant can accept, prepare and cancel an order', () => {
  assert.match(src, /runStatusChange\('Confirmée'\)/);
  assert.match(src, /runStatusChange\('En préparation'\)/);
  assert.match(src, /runStatusChange\('Annulée'\)/);
  assert.match(src, /updateOrderStatus\(order\._id, nextStatus, token\)/);
});

test('cancellation needs a second tap', () => {
  assert.match(src, /confirmCancel \? runStatusChange\('Annulée'\) : setConfirmCancel\(true\)/);
});

test('restaurant can assign a verified online courier', () => {
  assert.match(src, /getActiveDrivers\(token/);
  assert.match(src, /assignDriverToOrder\(order\._id, driverId, token\)/);
  assert.match(src, /canAssign = \['Confirmée', 'En préparation'\]\.includes\(rawStatus\)/);
});
