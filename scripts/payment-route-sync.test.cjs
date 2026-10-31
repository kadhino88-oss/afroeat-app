const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readSource = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('mobile cash payment uses the canonical backend endpoint', () => {
  const api = readSource('constants/api.js');
  const service = readSource('services/stripeService.js');

  assert.match(api, /cash:\s*['"]\/payments\/cash['"]/);
  assert.match(service, /API_ENDPOINTS\.payments\.cash/);
  assert.doesNotMatch(service, /API_ENDPOINTS\.payments\.selectCash/);
});

test('payment API constants do not advertise unsupported legacy routes', () => {
  const api = readSource('constants/api.js');
  const service = readSource('services/stripeService.js');
  assert.match(api, /createIntent:\s*['"]\/payments\/create-payment-intent['"]/);
  assert.match(api, /confirm:\s*['"]\/payments\/confirm['"]/);
  assert.match(api, /methods:\s*['"]\/payments\/methods['"]/);
  assert.match(api, /cash:\s*['"]\/payments\/cash['"]/);
  assert.doesNotMatch(api, /['"]\/payments\/(verify|history|create-payment-sheet)['"]/);
  assert.doesNotMatch(api, /\/payments\/orders\/\$\{safePathParam\(orderId\)\}\/(confirm|refund)/);
  assert.match(service, /API_ENDPOINTS\.payments\.createIntent/);
  assert.match(service, /API_ENDPOINTS\.payments\.confirm/);
  assert.match(service, /API_ENDPOINTS\.payments\.methods/);
  assert.match(service, /API_ENDPOINTS\.payments\.cash/);
});
