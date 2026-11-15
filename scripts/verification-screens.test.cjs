const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('l’envoi exige l’accord explicite et n’est proposé qu’avec un serveur prêt', () => {
  const src = read('app/account/verification.js');
  assert.match(src, /if \(!consent\) \{/);
  assert.match(src, /pickAndUploadDocument\(token, kind, true\)/);
  assert.match(src, /data\?\.available === false/);
  assert.match(read('services/verificationService.js'), /consent: consent === true/);
});

test('l’administration consulte les pièces à la demande, motif obligatoire pour un refus', () => {
  const src = read('app/admin/verification.js');
  assert.match(src, /reason\.length < 3/);
  assert.match(src, /getVerificationFile\(id, token\)/);
  assert.match(src, /viewLogged/);
});

test('accès : livreur, restaurant et centre de contrôle admin', () => {
  assert.match(read('app/livraison/profile.js'), /router\.push\('\/account\/verification'\)/);
  assert.match(read('app/restaurant/restaurant-settings.js'), /router\.push\('\/account\/verification'\)/);
  assert.match(read('app/admin/AdminDashboard.js'), /route: '\/admin\/verification'/);
});

test('la politique de confidentialité décrit les pièces et leur durée de conservation', () => {
  const src = read('app/legal/privacy.js');
  assert.match(src, /Pièces justificatives des partenaires/);
  assert.match(src, /90 jours/);
  assert.match(src, /30 jours/);
});
