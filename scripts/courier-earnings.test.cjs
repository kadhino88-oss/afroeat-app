const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('courier profile shows real earnings (courier share), not the sum of order totals', () => {
  const src = read('app', 'livraison', 'profile.js');
  assert.match(src, /getMyDeliveryEarnings\(token\)/);
  assert.match(src, /formatPrice\(earnings\.total, earnings\.currency\)/);
  assert.doesNotMatch(src, /o\?\.totalPrice/);
  assert.doesNotMatch(src, /\.toFixed\(2\)\} €`/);
});

test('tracking and menu screens format Swiss francs', () => {
  for (const f of [['app', 'livraison', 'OrderTracking.js'], ['app', 'restaurant', 'MenuScreen.js']]) {
    assert.match(read(...f), /=== 'CHF'\) return `CHF /, f.join('/'));
  }
});
