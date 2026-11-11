const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('change-password screen calls the API with current and new password', () => {
  const src = read('app', 'change-password.js');
  assert.match(src, /apiPut\('\/users\/me\/password', \{ currentPassword: current, newPassword: next \}/);
  assert.match(src, /autoComplete="current-password"/);
  assert.match(src, /autoComplete="new-password"/);
});

test('every role profile links to the screen and restaurant settings no longer show a placeholder', () => {
  assert.match(read('components', 'AccountPrivacyLink.js'), /router\.push\('\/change-password'\)/);
  const settings = read('app', 'restaurant', 'restaurant-settings.js');
  assert.match(settings, /router\.push\('\/change-password'\)/);
  assert.doesNotMatch(settings, /securityInfoBody/);
});
