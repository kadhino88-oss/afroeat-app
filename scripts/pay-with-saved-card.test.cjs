const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const stripe = read('services', 'stripeService.js');
const payment = read('app', 'payment.js');

test('le paiement par carte utilise la carte enregistrée, avec 3-D Secure dans l\'appli', () => {
  assert.match(stripe, /paymentMethodId = null/);
  assert.match(stripe, /confirmPayment\(clientSecret, \{\s*paymentMethodType: 'Card',\s*paymentMethodData: \{ paymentMethodId \}/);
  // La confirmation côté serveur reste obligatoire après le paiement.
  assert.match(stripe, /confirmOrderPayment\(\s*orderId,\s*paymentIntentId,\s*token\s*\)/);
});

test('la feuille de saisie de carte ne sert plus que de repli (web / sans carte choisie)', () => {
  assert.match(stripe, /\} else \{[\s\S]*initPaymentSheet\(/);
  assert.match(payment, /paymentMethodId: requiresSavedCard \? defaultCard\?\.id : null/);
});

test('sans carte enregistrée, on renvoie vers le profil au lieu de payer', () => {
  assert.match(payment, /const needsCard = requiresSavedCard && !cardsLoading && !defaultCard/);
  assert.match(payment, /if \(needsCard\) \{\s*goToCards\(\);\s*return;/);
  assert.match(payment, /router\.push\('\/profile\/payment'\)/);
});

test('le paiement à la livraison est conservé', () => {
  assert.match(payment, /id: 'cash'/);
  assert.match(payment, /handleCashPayment\(\)/);
});

test('le web garde son parcours actuel (pas d\'enregistrement de carte sur le web)', () => {
  assert.match(payment, /Platform\.OS !== 'web'/);
});

test('les textes existent dans les 6 langues', () => {
  const keys = Object.keys(JSON.parse(read('i18n', 'locales', 'fr.json')).paymentCards).sort();
  assert.deepEqual(keys, ['addCard', 'change', 'noCardText', 'noCardTitle', 'usedCard']);
  for (const l of ['de', 'en', 'es', 'it', 'zh']) {
    assert.deepEqual(Object.keys(JSON.parse(read('i18n', 'locales', `${l}.json`)).paymentCards).sort(), keys, l);
  }
});

test('web : les alertes (erreurs de formulaire) deviennent visibles', () => {
  const alert = read('services', 'webAlert.js');
  assert.match(alert, /Platform\.OS === 'web'/);
  assert.match(alert, /Alert\.alert = showWebAlert/);
  assert.match(alert, /window\.alert\(text\)/);
  assert.match(read('app', '_layout.js'), /import '\.\.\/services\/webAlert';/);
});
