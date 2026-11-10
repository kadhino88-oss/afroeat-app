const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'restaurant', 'restaurant-orders.js'), 'utf8');

test('restaurant order card opens the order details', () => {
  assert.match(src, /router\.push\(`\/restaurant\/restaurant-orders-details\/\$\{item\._id\}`\)/);
});
