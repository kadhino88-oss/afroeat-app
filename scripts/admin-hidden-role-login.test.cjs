const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('sur le site public, l’administration se comporte comme une page inexistante', () => {
  assert.match(read('services', 'adminHost.js'), /PUBLIC_SITE_HOSTS = \['afroeat-app\.vercel\.app'\]/);
  assert.match(read('app', 'admin', '_layout.js'), /if \(!isAdminAreaAllowed\(\)\) \{\s+return <NotFoundScreen \/>;/);
  assert.match(read('app', 'auth', 'login.js'), /currentRole === 'admin' && !isAdminAreaAllowed\(\)/);
});

test('la connexion client est directe et les autres espaces restent accessibles', () => {
  assert.match(read('components', 'WebNavBar.web.js'), /router\.push\('\/auth\/login\?role=client'\)/);
  assert.match(read('app', 'index.web.js'), /router\.push\('\/auth\/login\?role=client'\)/);
  const login = read('app', 'auth', 'login.js');
  assert.match(login, /auth\.role\.chooseSpace/);
  assert.match(login, /router\.replace\('\/auth\/role'\)/);
  const role = read('app', 'auth', 'role.js');
  assert.doesNotMatch(role, /id: 'admin'/);
  assert.doesNotMatch(role, /resetLocalAccounts|heroStatsRow\}>/);
});

test('livreur non vérifié : avis clair et interrupteur désactivé', () => {
  const src = read('app', 'livraison', 'profile.js');
  assert.match(src, /disabled=\{savingOnline \|\| verified === false\}/);
  assert.match(src, /livraison\.profile\.verificationTitle/);
});

test('versements : le pays se choisit (Suisse ou France), il ne se tape plus', () => {
  const src = read('app', 'account', 'payouts.js');
  assert.match(src, /code: 'CH', labelKey: 'payouts\.countrySwitzerland'/);
  assert.match(src, /code: 'FR', labelKey: 'payouts\.countryFrance'/);
  assert.doesNotMatch(src, /<TextInput/);
});
