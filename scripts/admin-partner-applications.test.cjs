const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('admin : écran des candidatures partenaires réservé à l\'administrateur et branché sur l\'API', () => {
  const screen = read('app', 'admin', 'partner-applications.js');
  assert.match(screen, /getAdminPartnerApplications\(/);
  assert.match(screen, /updatePartnerApplication\(/);
  assert.match(screen, /toLowerCase\(\) !== 'admin'/);
  for (const status of ['contacted', 'rejected', 'approved']) assert.match(screen, new RegExp(`'${status}'`));
  const api = read('constants', 'api.js');
  assert.match(api, /partnerApplications: '\/admin\/partner-applications'/);
  assert.match(api, /partnerApplicationById/);
  assert.match(read('services', 'partnerApplicationService.js'), /apiPut\(API_ENDPOINTS\.admin\.partnerApplicationById/);
});

test('admin : écran enregistré et accessible depuis le tableau de bord', () => {
  assert.match(read('app', 'admin', '_layout.js'), /name="partner-applications"/);
  assert.match(read('app', 'admin', 'index.js'), /route: '\/admin\/partner-applications'/);
});

test('admin sees whether the invitation link was also emailed to the applicant', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'admin', 'partner-applications.js'), 'utf8');
  assert.match(src, /result\.emailSent/);
  assert.match(src, /admin\.partnerApplications\.inviteEmailed/);
});
