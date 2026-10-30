'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const explore = fs.readFileSync(path.join(root, 'app', '(tabs)', 'explore.js'), 'utf8');

for (const [label, slug] of [
  ['Malienne', 'malienne'],
  ['Algérienne', 'algerienne'],
  ['Tunisienne', 'tunisienne'],
]) {
  test(`Explore exposes the ${label} cuisine filter`, () => {
    assert.ok(explore.includes(`'${label}'`), `missing filter label ${label}`);
    assert.ok(explore.includes(`${label}: '${slug}'`), `missing translation slug for ${label}`);
    assert.ok(explore.includes(`${slug}:`), `missing country cuisine matching for ${slug}`);
  });
}

for (const locale of ['de', 'en', 'es', 'fr', 'it', 'zh']) {
  test(`locale ${locale} includes country cuisine labels`, () => {
    const file = path.join(root, 'i18n', 'locales', `${locale}.json`);
    const content = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const key of ['malienne', 'algerienne', 'tunisienne']) {
      assert.equal(typeof content.cuisines?.[key], 'string', `missing cuisines.${key}`);
      assert.ok(content.cuisines[key].length > 0, `empty cuisines.${key}`);
    }
  });
}
