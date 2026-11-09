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

test('Apple Pay / Google Pay : bouton natif, confirmation serveur obligatoire, caché sur le web', () => {
  const service = read('services', 'stripeService.js');
  assert.match(service, /confirmPlatformPayPayment\(clientSecret/);
  assert.match(service, /const payWithWallet = async/);
  // Le serveur confirme toujours le paiement auprès de Stripe avant le succès.
  const walletPart = service.slice(service.indexOf('const payWithWallet'));
  assert.match(walletPart, /confirmOrderPayment\(orderId, paymentIntentId, token\)/);
  assert.match(read('components', 'WalletPayButton.js'), /isPlatformPaySupported/);
  assert.match(read('components', 'WalletPayButton.web.js'), /return null/);
  assert.match(payment, /<WalletPayButton/);
});

test('les versions imposées par Expo SDK 58 sont fixées et protégées contre les mises à jour automatiques', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['@stripe/stripe-react-native'], '0.81.0');
  assert.equal(pkg.dependencies['react-dom'], pkg.dependencies.react);
  assert.match(pkg.devDependencies.typescript, /^~6\./);
  const dependabot = read('.github', 'dependabot.yml');
  for (const name of ['@stripe/stripe-react-native', 'typescript', 'react-dom', 'expo-*', 'react-native-*']) {
    assert.ok(dependabot.includes(`dependency-name: "${name}"`), name);
  }
  assert.match(dependabot, /version-update:semver-major/);
});

test('profil paiement : sur le web, ajout de carte via Stripe Checkout (redirection)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'profile', 'payment.js'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '..', 'constants', 'api.js'), 'utf8');
  assert.match(api, /createCardSetupSession:\s*'\/payments\/cards\/setup-session'/);
  assert.match(src, /API_ENDPOINTS\.payments\.createCardSetupSession/);
  assert.match(src, /window\.location\.assign\(session\.url\)/);
  assert.match(src, /params\?\.cardSetup/);
});
