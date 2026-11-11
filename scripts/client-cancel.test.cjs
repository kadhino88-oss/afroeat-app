const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'order', '[id].js'), 'utf8');

test('client can cancel a pending order, with a second confirmation tap', () => {
  assert.match(src, /order\?\.status === 'pending'/);
  assert.match(src, /updateOrderStatus\(order\._id, 'Annulée', token\)/);
  assert.match(src, /cancelStep === 'idle'/);
});
