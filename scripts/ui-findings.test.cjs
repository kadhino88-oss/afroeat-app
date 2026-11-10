const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test("ajout au panier : confirmation sur le bouton, plus de fenêtre bloquante", () => {
  const src = read('app/restaurant/[id].js');
  assert.doesNotMatch(src, /Alert\.alert\(t\('restaurant\.addedToCart'\)/);
  assert.match(src, /setJustAddedId\(item\._id\)/);
});

test('candidature sans catégorie : type « restaurant » par défaut', () => {
  assert.match(read('app/partner-apply.js'), /\|\| !category\) return 'restaurant'/);
});

test('badge de statut au singulier, traduit dans les 6 langues', () => {
  assert.match(read('app/admin/partner-applications.js'), /partnerApplications\.status_\$\{value\}/);
  for (const lang of ['fr', 'en', 'de', 'es', 'it', 'zh']) {
    const d = JSON.parse(read(`i18n/locales/${lang}.json`));
    for (const k of ['new', 'contacted', 'approved', 'rejected']) assert.ok(d.admin.partnerApplications[`status_${k}`], `${lang} ${k}`);
  }
  assert.equal(JSON.parse(read('i18n/locales/fr.json')).admin.partnerApplications.status_approved, 'Approuvée');
});

test('page blanche après déploiement : rechargement unique', () => {
  const src = read('services/webChunkRecovery.js');
  assert.match(src, /Unexpected token '<'\|Requiring unknown module/);
  assert.match(src, /< 30000\) return/);
  assert.match(read('app/_layout.js'), /import '\.\.\/services\/webChunkRecovery';/);
});

test("admin : la liste des livreurs mène à la fiche de vérification", () => {
  const src = read('app/admin/drivers.js');
  assert.match(src, /router\.push\(`\/admin\/drivers-details\/\$\{item\._id\}`\)/);
  assert.match(src, /t\('admin\.drivers\.title'\)/);
});
