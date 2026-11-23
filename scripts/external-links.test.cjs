const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isAllowedPaymentUrl, sanitizeEmail } = require('../services/inputGuards');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('F1: only Stripe hosted pages are allowed for payment URLs', () => {
  for (const ok of [
    'https://checkout.stripe.com/c/pay/cs_test_123',
    'https://connect.stripe.com/setup/e/acct_1/abc',
    'https://billing.stripe.com/p/session/x',
    'HTTPS://Checkout.Stripe.com/c/pay',
  ]) assert.equal(isAllowedPaymentUrl(ok), true, ok);
  for (const bad of [
    '', null, undefined,
    'http://checkout.stripe.com/x',
    'https://checkout.stripe.com.evil.test/x',
    'https://evil.test/https://checkout.stripe.com/',
    'https://checkout.stripe.com@evil.test/x',
    'https://checkout.stripe.com:444/x',
    'https://js.stripe.com/x',
    'javascript:alert(1)',
    'intent://x#Intent;end',
    'otpauth://totp/AfroEat:a@b.c?secret=ABC',
  ]) assert.equal(isAllowedPaymentUrl(bad), false, String(bad));
});

test('F1: otpauth is accepted only when explicitly allowed', () => {
  const u = 'otpauth://totp/AfroEat:a@b.c?secret=ABC&issuer=AfroEat';
  assert.equal(isAllowedPaymentUrl(u, { allowOtpauth: true }), true);
  assert.equal(isAllowedPaymentUrl('otpauth://evil/x', { allowOtpauth: true }), false);
  assert.equal(isAllowedPaymentUrl('https://evil.test', { allowOtpauth: true }), false);
});

test('F1: screens gate their URL opening through the helper', () => {
  assert.equal((read('app', 'profile', 'payment.js').match(/isAllowedPaymentUrl\(session\.url\)/g) || []).length, 2);
  assert.equal((read('app', 'account', 'payouts.js').match(/isAllowedPaymentUrl\(result\.url\)/g) || []).length, 2);
  assert.match(read('app', 'admin', 'security.js'), /isAllowedPaymentUrl\(setup\.otpauthUrl, \{ allowOtpauth: true \}\)/);
});

test('F3: sanitizeEmail strips mailto header injection characters', () => {
  assert.equal(sanitizeEmail('contact@resto.ch'), 'contact@resto.ch');
  assert.equal(sanitizeEmail('a@b.ch?subject=x&bcc=evil@e.com'), '');
  assert.equal(sanitizeEmail('a@b.ch?subject=hi'), 'a@b.chsubjecthi');
  assert.equal(sanitizeEmail('a@b.ch\r\nBcc: e@e.com'), '');
  assert.ok(!/[?&\r\n\s]/.test(sanitizeEmail('a@b.ch?x=1&y=2\n')));
  assert.equal(sanitizeEmail('not an email'), '');
  assert.equal(sanitizeEmail(null), '');
  assert.match(read('app', 'place', '[id].js'), /mailto:\$\{email\}/);
});

test('F7: the destructive debug reset screen is gone', () => {
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'app', 'auth', 'reset.js')), false);
  assert.doesNotMatch(read('app', 'root_layout.js'), /auth\/reset"/);
});
