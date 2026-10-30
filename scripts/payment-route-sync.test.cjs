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
