'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const explore = fs.readFileSync(path.join(root, 'app', '(tabs)', 'explore.js'), 'utf8');
const webHome = fs.readFileSync(path.join(root, 'app', 'index.web.js'), 'utf8');
const nativeHome = fs.readFileSync(path.join(root, 'app', '(tabs)', 'index.js'), 'utf8');

test('le bouton Commander ouvre les partenaires sans masquer définitivement l\'annuaire', () => {
  assert.match(webHome, /openExplorer\('Africaine', '', true\)/);
  assert.match(webHome, /if \(partnersOnly\) params\.partners = '1'/);
  assert.match(nativeHome, /category=restaurants&partners=1/);
  assert.match(explore, /routeParams\.partners/);
  assert.match(explore, /setPartnersOnly\(\(current\) => !current\)/);
  assert.match(explore, /setPartnersOnly\(false\)/);
});

test('Explorer préserve les annuaires mais privilégie les établissements partenaires', () => {
  assert.match(explore, /const matchesPartner = !partnersOnly \|\| !isPublicDirectoryPlace\(item\)/);
  assert.match(explore, /matchesQuery && matchesFilter && matchesAvailability && matchesPartner/);
  assert.match(explore, /if \(aDirectory !== bDirectory\) return aDirectory - bDirectory/);
  assert.match(explore, /!isPublicPlace \? \(/);
  assert.match(explore, /explore\.partnerBadge/);
});

test('La sélection restaurant ne se transforme pas en sélection de toutes les épiceries partenaires', () => {
  assert.match(explore, /const businessType = normalizeSearch\(item\?\.businessType\)/);
  assert.match(explore, /const isRestaurantCategory = isPublicDirectoryPlace\(item\)/);
  assert.match(explore, /businessType === '' \|\| businessType === 'restaurant'/);
  assert.match(explore, /normalizedFilter === 'africaine' && isRestaurantCategory/);
});

for (const language of ['fr', 'en', 'de', 'es', 'it', 'zh']) {
  test(`Les textes de découverte des partenaires sont disponibles en ${language}`, () => {
    const translations = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'locales', `${language}.json`), 'utf8'));
    for (const key of ['partnersOnly', 'partnersOnlyHint', 'partnerBadge']) {
      assert.ok(typeof translations.explore?.[key] === 'string' && translations.explore[key].length > 0);
    }
  });
}
