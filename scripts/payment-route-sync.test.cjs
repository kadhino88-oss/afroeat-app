const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readSource = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

// Le paiement espèces est appelé depuis l'écran de paiement ; Stripe passe par les services.
const paymentScreen = () => readSource('app/payment.js');
const nativeService = () => readSource('services/stripeService.js');
const webService = () => readSource('services/stripeService.web.js');

test('cash payment uses the canonical backend endpoint', () => {
  const api = readSource('constants/api.js');
  const all = [paymentScreen(), nativeService(), webService()].join('\n');

  assert.match(api, /cash:\s*['"]\/payments\/cash['"]/);
  assert.match(all, /API_ENDPOINTS\.payments\.cash/);
  assert.doesNotMatch(all, /API_ENDPOINTS\.payments\.selectCash/);
});

test('payment API constants do not advertise unsupported legacy routes', () => {
  const api = readSource('constants/api.js');
  const service = nativeService();
  assert.match(api, /createIntent:\s*['"]\/payments\/create-payment-intent['"]/);
  assert.match(api, /confirm:\s*['"]\/payments\/confirm['"]/);
  assert.match(api, /methods:\s*['"]\/payments\/methods['"]/);
  assert.match(api, /cash:\s*['"]\/payments\/cash['"]/);
  assert.doesNotMatch(api, /['"]\/payments\/(verify|history|create-payment-sheet)['"]/);
  assert.doesNotMatch(api, /\/payments\/orders\/\$\{safePathParam\(orderId\)\}\/(confirm|refund)/);
  assert.match(service, /API_ENDPOINTS\.payments\.createIntent/);
  assert.match(service, /API_ENDPOINTS\.payments\.confirm/);
  assert.match(paymentScreen(), /API_ENDPOINTS\.payments\.methods/);
});

test('web payment service has no placeholder Stripe key and no legacy cash route', () => {
  const web = webService();
  assert.doesNotMatch(web, /API_ENDPOINTS\.payments\.selectCash/);
  assert.doesNotMatch(web, /pk_test_VOTRE_CLE_PUBLIQUE/);
  // Une clé absente doit rester vide (erreur visible), jamais une clé de remplacement.
  assert.match(web, /STRIPE_PUBLISHABLE_KEY = String\(\s*process\.env\.EXPO_PUBLIC_STRIPE_KEY \|\| ''\s*\)\.trim\(\)/);
});
