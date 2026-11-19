const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const homepage = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.web.js'), 'utf8');

test('accueil web : un accès direct permet de découvrir les restaurants pour commander', () => {
  assert.match(homepage, /Voir les restaurants pour commander/);
  assert.match(homepage, /onPress=\{\(\) => openExplorer\('Africaine', '', true\)\}/);
  assert.match(homepage, /if \(partnersOnly\) params\.partners = '1'/);
  assert.match(homepage, /La commande en ligne est proposée uniquement par les partenaires/);
});

test('accueil web : inscription partenaire via la candidature existante', () => {
  assert.match(homepage, /Vous êtes commerçant \? Rejoignez-nous/);
  assert.match(homepage, /Déposer ma candidature/);
  assert.match(homepage, /<Pressable style=\{styles\.partnerBannerButton\} onPress=\{\(\) => router\.push\('\/partner-apply'\)\}/);
  assert.match(homepage, /<Text style=\{styles\.footerLink\}>Devenir partenaire<\/Text>/);
});

test('accueil web : annuaire public distinct des établissements commandables', () => {
  assert.match(homepage, /leur présence ici/i);
  assert.match(homepage, /ne signifie pas qu’ils acceptent des commandes/);
  assert.match(homepage, /Commandez chez les restaurants partenaires/);
});
