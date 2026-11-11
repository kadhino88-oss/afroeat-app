const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('login links to the forgot-password screen', () => {
  assert.match(read('app', 'auth', 'login.js'), /router\.push\('\/auth\/forgot-password'\)/);
  const layout = read('app', 'auth', '_layout.js');
  assert.match(layout, /name="forgot-password"/);
  assert.match(layout, /name="reset-password"/);
});

test('forgot-password posts the email only; reset-password posts token and new password', () => {
  assert.match(read('app', 'auth', 'forgot-password.js'), /apiPost\(API_ENDPOINTS\.auth\.forgotPassword, \{ email: value \}\)/);
  const reset = read('app', 'auth', 'reset-password.js');
  assert.match(reset, /apiPost\(API_ENDPOINTS\.auth\.resetPassword, \{ token, password \}\)/);
  assert.match(reset, /\^\[a-f0-9\]\{64\}\$/);
});
