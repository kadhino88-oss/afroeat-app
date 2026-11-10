const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('« Devenir livreur » mène à la candidature livreur (plus d’impasse)', () => {
  assert.match(read('app/auth/role.js'), /router\.push\('\/courier-apply'\)/);
  assert.match(read('app/auth/login.js'), /return '\/courier-apply'/);
  assert.match(read('app/_layout.js'), /name="courier-apply"/);
});

test('la candidature livreur envoie le type « courier » et demande le consentement', () => {
  const src = read('app/courier-apply.js');
  assert.match(src, /businessType: 'courier'/);
  assert.match(src, /if \(!consent\)/);
});

test("la page d'invitation s'adapte au livreur et renvoie vers l'espace livreur", () => {
  const src = read('app/auth/invite.js');
  assert.match(src, /invite\?\.businessType === 'courier'/);
  assert.match(src, /role: isCourier \? 'livreur' : 'restaurant'/);
});
