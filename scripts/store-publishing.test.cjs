const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (p) => fs.readFileSync(p, 'utf8');

test('les textes d’autorisation iOS existent en français et en anglais', () => {
  const app = JSON.parse(read('app.json')).expo;
  for (const lang of ['fr', 'en']) {
    const strings = JSON.parse(read(app.locales[lang].replace('./', '')));
    assert.ok(strings.NSLocationWhenInUseUsageDescription.length > 40);
    assert.ok(strings.NSPhotoLibraryUsageDescription.length > 30);
  }
});

test('la localisation reste limitée à l’utilisation (pas d’arrière-plan)', () => {
  const app = JSON.parse(read('app.json')).expo;
  const location = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-location')[1];
  assert.equal(location.isIosBackgroundLocationEnabled, false);
  assert.equal(location.isAndroidBackgroundLocationEnabled, false);
});

test('l’envoi Google se fait en brouillon sur la piste interne', () => {
  const eas = JSON.parse(read('eas.json'));
  assert.equal(eas.submit.production.android.track, 'internal');
  assert.equal(eas.submit.production.android.releaseStatus, 'draft');
  assert.match(read('.github/workflows/eas-build.yml'), /--auto-submit/);
});

test('les fiches magasins donnent les adresses obligatoires', () => {
  const doc = read('docs/FICHES_MAGASINS.md');
  assert.match(doc, /legal\/privacy/);
  assert.match(doc, /account-deletion/);
});

test('les constructions Android sautent l’analyse lint de publication (dépendance Stripe introuvable)', () => {
  const eas = JSON.parse(read('eas.json'));
  assert.match(eas.build.preview.android.gradleCommand, /^:app:assembleRelease .*-x lintVitalAnalyzeRelease/);
  assert.match(eas.build.production.android.gradleCommand, /^:app:bundleRelease .*-x lintVitalAnalyzeRelease/);
});
