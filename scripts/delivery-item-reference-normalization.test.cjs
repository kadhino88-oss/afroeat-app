const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'services', 'deliveryService.js'),
  'utf8',
);

test('delivery item normalizer extracts scalar IDs from populated menuItem objects', () => {
  assert.match(source, /const resolveReferenceId = \(value\) =>/);
  assert.match(source, /const nestedId = value\._id \?\? value\.id/);
  assert.match(source, /_id: itemId \|\| null,/);
  assert.match(source, /id: itemId \|\| null,/);
  assert.match(source, /menuItem: menuItemId \|\| null,/);
});
