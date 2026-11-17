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
