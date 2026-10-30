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

test('home drinks shortcut opens the matching Explore category', () => {
  const home = fs.readFileSync(path.join(root, 'app', '(tabs)', 'index.js'), 'utf8');
  assert.match(home, /titleKey: 'home\.categories\.drinks'/);
  assert.match(home, /route: '\/\(tabs\)\/explore\?category=drinks'/);
  assert.match(explore, /drinks:\s*'Boissons'/);
  assert.match(explore, /normalizedFilter === 'boissons'/);
});

for (const locale of ['de', 'en', 'es', 'fr', 'it', 'zh']) {
  test(`locale ${locale} includes the drinks category`, () => {
    const file = path.join(root, 'i18n', 'locales', `${locale}.json`);
    const content = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(typeof content.home?.categories?.drinks, 'string');
    assert.ok(content.home.categories.drinks.length > 0);
    assert.equal(typeof content.cuisines?.boissons, 'string');
    assert.ok(content.cuisines.boissons.length > 0);
  });
}

test('home and Explore both expose North and Southern Africa', () => {
  const home = fs.readFileSync(path.join(root, 'app', '(tabs)', 'index.js'), 'utf8');
  for (const label of ['Afrique du Nord', 'Afrique australe']) {
    assert.ok(home.includes(`'${label}'`), `home is missing ${label}`);
    assert.ok(explore.includes(`'${label}'`), `Explore is missing ${label}`);
  }
});

test('restaurant catalog does not label partners as African cuisine when cuisine is missing', () => {
  assert.ok(explore.includes("const cuisine = normalizeText(item?.cuisine, 'Cuisine à préciser');"));
  assert.ok(explore.includes("name: normalizeText(item?.name, 'Restaurant'),"));
  assert.ok(!explore.includes("'Cuisine africaine'"));
  const service = fs.readFileSync(path.join(root, 'services', 'restaurantService.js'), 'utf8');
  assert.ok(service.includes("cuisine: normalizeText(item?.cuisine, 'Cuisine à préciser'),"));
  assert.ok(!service.includes("cuisine: normalizeText(item?.cuisine, 'Africaine')"));
});
