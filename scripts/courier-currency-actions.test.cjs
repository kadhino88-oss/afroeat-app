const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'app', 'livraison', f), 'utf8');

test('courier screens show the order currency instead of a hard-coded euro', () => {
  for (const f of ['[id].js', 'orders.js', 'history.js']) {
    const src = read(f);
    assert.doesNotMatch(src, /toFixed\(2\)\} €/, f);
    assert.match(src, /Intl\.NumberFormat/, f);
  }
  assert.match(read('[id].js'), /formatPrice\(order\.totalPrice, order\.currency\)/);
  assert.match(read('orders.js'), /formatPrice\(item\.totalPrice, item\.currency\)/);
});

test('courier action buttons are verbs, not statuses', () => {
  for (const f of ['[id].js', 'index.js']) {
    const src = read(f);
    assert.match(src, /t\('livraison\.startDelivery'\)/, f);
    assert.match(src, /t\('livraison\.markDelivered'\)/, f);
  }
});
