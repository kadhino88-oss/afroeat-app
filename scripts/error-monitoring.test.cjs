const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (p) => fs.readFileSync(p, 'utf8');

test('le site remonte ses erreurs JavaScript vers l’API, sans le bruit', () => {
  const src = read('services/webErrorReporter.js');
  assert.match(src, /\/monitoring\/client-error/);
  assert.match(src, /addEventListener\('error'/);
  assert.match(src, /addEventListener\('unhandledrejection'/);
  assert.match(src, /isStaleBundleError/);
  assert.match(src, /MAX_PER_PAGE = 10/);
  assert.match(read('app/_layout.js'), /import '\.\.\/services\/webErrorReporter';/);
});

test('l’écran des erreurs est réservé à l’administrateur et lié au tableau de bord', () => {
  assert.match(read('app/admin/errors.js'), /role !== 'admin'[\s\S]*Redirect/);
  assert.match(read('app/admin/AdminDashboard.js'), /route: '\/admin\/errors'/);
  assert.match(read('constants/api.js'), /errors:\s+'\/admin\/errors'/);
  assert.match(read('services/adminService.js'), /\/resolve`/);
});

test('la page partenaire affiche la commission issue de l’API, sans taux codé en dur', () => {
  const src = read('app/partner-apply.js');
  assert.match(src, /getPartnerTerms\(\)/);
  assert.match(src, /partnerApply\.commission/);
  assert.doesNotMatch(src, /15 ?%/);
  assert.match(read('constants/api.js'), /terms: \(\) => '\/partner-applications\/terms'/);
});

test('les espaces partenaires vouvoient', () => {
  const fr = JSON.parse(read('i18n/locales/fr.json'));
  assert.match(fr.restaurant.dashboard.subtitle, /^Gérez votre menu/);
  assert.match(fr.partnerApply.joinTitle, /votre commerce/);
  assert.doesNotMatch(read('app/courier-apply.js'), /\b(tu|ton|ta|tes)\b /);
});
