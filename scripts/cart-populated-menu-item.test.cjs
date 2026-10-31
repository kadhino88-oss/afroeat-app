const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'context', 'CartContext.js'),
  'utf8'
);

test('populated menu item IDs take precedence over cart-row IDs', () => {
  assert.match(source, /const populatedMenuItemId = isPlainObject\(menuItem\)[\s\S]*?menuItem\?\._id \|\| menuItem\?\.id/);
  assert.match(source, /populatedMenuItemId \|\| scalarMenuItemId \|\| item\?\._id/);
});

test('cart normalization stores a scalar menu item ID, not a populated object', () => {
  assert.match(source, /if \(!itemId \|\| typeof itemId === 'object'\)/);
  assert.match(source, /menuItem: itemId,/);
  assert.doesNotMatch(source, /menuItem: item\?\.menuItem \|\| itemId/);
});
