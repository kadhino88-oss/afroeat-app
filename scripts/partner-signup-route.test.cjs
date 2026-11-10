const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

// L'API refuse la création libre-service d'un compte restaurant (ALLOW_PARTNER_SELF_REGISTER) :
// l'ancien formulaire menait à une impasse (« La nationalité est obligatoire »).
test("« Créer un compte restaurant » mène à la candidature partenaire", () => {
  assert.match(read('app/auth/role.js'), /router\.push\('\/partner-apply'\)/);
  assert.doesNotMatch(read('app/auth/role.js'), /router\.push\('\/auth\/register-restaurant'\)/);
  assert.match(read('app/auth/login.js'), /return '\/partner-apply'/);
});
