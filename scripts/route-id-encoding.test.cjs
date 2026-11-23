const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isValidObjectId, getRouteObjectId } = require('../services/inputGuards');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('isValidObjectId accepts only 24 hex characters', () => {
  assert.equal(isValidObjectId('507f1f77bcf86cd799439011'), true);
  assert.equal(isValidObjectId('507f1f77bcf86cd79943901'), false);
  assert.equal(isValidObjectId('../admin/users'), false);
  assert.equal(isValidObjectId('507f1f77bcf86cd799439011/../x'), false);
  assert.equal(isValidObjectId(undefined), false);
});

test('getRouteObjectId unwraps arrays and rejects traversal / query injection', () => {
  assert.equal(getRouteObjectId(['507f1f77bcf86cd799439011']), '507f1f77bcf86cd799439011');
  assert.equal(getRouteObjectId(' 507f1f77bcf86cd799439011 '), '507f1f77bcf86cd799439011');
  assert.equal(getRouteObjectId('507f1f77bcf86cd799439011?x=1'), '');
  assert.equal(getRouteObjectId('..%2Fadmin'), '');
  assert.equal(getRouteObjectId(undefined), '');
  assert.equal(getRouteObjectId([]), '');
});

test('components build API paths through encoded endpoints, not raw interpolation', () => {
  for (const f of ['OrderChat.js', 'OrderReviewCard.js', 'RestaurantReviews.js']) {
    const src = read('components', f);
    assert.doesNotMatch(src, /`\/(orders|restaurants)\/\$\{/, f);
    assert.match(src, /API_ENDPOINTS\./, f);
  }
  const api = read('constants', 'api.js');
  assert.match(api, /messages:\s+\(id\) => `\/orders\/\$\{safePathParam\(id\)\}\/messages`/);
  assert.match(api, /review:\s+\(id\) => `\/orders\/\$\{safePathParam\(id\)\}\/review`/);
  assert.match(api, /reviews: \(restaurantId\) => `\/restaurants\/\$\{safePathParam\(restaurantId\)\}\/reviews`/);
});

test('tracking screens validate route ids', () => {
  for (const f of ['OrderTracking.js', 'OrderTracking.web.js']) {
    assert.match(read('app', 'livraison', f), /getRouteObjectId\(/, f);
  }
});
