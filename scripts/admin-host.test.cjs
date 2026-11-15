const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('l’adresse dédiée à l’administration est reconnue par son nom', () => {
  const src = read('services', 'adminHost.js');
  const pattern = new RegExp(src.match(/ADMIN_HOST_PATTERN = \/(.+)\/;/)[1]);
  assert.equal(pattern.test('afroeat-admin.vercel.app'), true);
  assert.equal(pattern.test('afroeat-app.vercel.app'), false);
  assert.equal('afroeat-admin.vercel.app'.replace(pattern, 'afroeat-app.'), 'afroeat-app.vercel.app');
});

test('sur cette adresse, la page d’accueil ouvre l’administration', () => {
  assert.match(read('app', 'index.web.js'), /if \(isAdminHost\(\)\) return <Redirect href="\/admin" \/>;/);
});

test('« Voir le site » ouvre le site public à part, sans toucher à la connexion admin', () => {
  const src = read('components', 'WebNavBar.web.js');
  assert.match(src, /if \(onAdminArea && isAdminHost\(\)\) openPublicSite\(\);/);
  assert.match(read('services', 'adminHost.js'), /window\.open\(getPublicSiteUrl\(\), '_blank', 'noopener'\)/);
});
