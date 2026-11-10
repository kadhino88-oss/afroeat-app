const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test("la page d'invitation est publique et le partenaire choisit lui-même son mot de passe", () => {
  const src = read('app/auth/invite.js');
  assert.doesNotMatch(src, /useAuth|<Redirect/);
  assert.match(src, /registerWithPartnerInvite\(inviteToken, \{ name, phone, password \}\)/);
  assert.match(src, /autoComplete="new-password"/);
  assert.match(src, /secureTextEntry/);
  // Le mot de passe n'est jamais journalisé ni mis dans l'adresse.
  assert.doesNotMatch(src, /console\.log/);
  assert.match(read('app/auth/_layout.js'), /name="invite"/);
});

test("l'admin génère le lien d'invitation et ne le voit qu'une fois", () => {
  const src = read('app/admin/partner-applications.js');
  assert.match(src, /createPartnerInvite\(application\._id, auth\.token\)/);
  assert.match(src, /affiché une seule fois/);
  const svc = read('services/partnerApplicationService.js');
  assert.match(svc, /partnerApplicationInvite/);
  assert.match(read('constants/api.js'), /inviteRegister: \(token\)/);
});
