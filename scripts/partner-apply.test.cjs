const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('la fiche d\'un lieu référencé propose de rejoindre AFROEAT', () => {
  const place = read('app', 'place', '[id].js');
  assert.match(place, /pathname: '\/partner-apply'/);
  assert.match(place, /partnerApply\.joinButton/);
  assert.match(read('app', '_layout.js'), /name="partner-apply"/);
});

test('le formulaire envoie la demande sans jeton et avec le champ anti-robot vide', () => {
  const screen = read('app', 'partner-apply.js');
  const service = read('services', 'partnerApplicationService.js');
  assert.match(screen, /company: ''/);
  assert.match(screen, /consent/);
  assert.match(service, /apiPost\(API_ENDPOINTS\.partnerApplications\.create\(\), application, null/);
  assert.match(read('constants', 'api.js'), /'\/partner-applications'/);
});

test('les textes d\'inscription existent dans les 6 langues', () => {
  const keys = Object.keys(JSON.parse(read('i18n', 'locales', 'fr.json')).partnerApply);
  assert.ok(keys.length >= 25);
  for (const l of ['de', 'en', 'es', 'it', 'zh']) {
    const other = Object.keys(JSON.parse(read('i18n', 'locales', `${l}.json`)).partnerApply);
    assert.deepEqual(other.sort(), [...keys].sort(), l);
  }
});

test('en développement sans variable, l\'appli vise l\'API de test en ligne', () => {
  const config = read('app.config.js');
  assert.match(config, /DEFAULT_DEV_API_URL = 'https:\/\/afroeat-api-staging\.vercel\.app\/api'/);
  assert.match(config, /EXPO_PUBLIC_USE_LOCAL_API/);
  assert.match(config, /!String\(process\.env\.EAS_BUILD_PROFILE/);
});
