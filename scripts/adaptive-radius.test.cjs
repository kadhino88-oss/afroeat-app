const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const service = read('services', 'placeService.js');
const explore = read('app', '(tabs)', 'explore.js');

test('zone élargie automatiquement quand il y a peu de résultats', () => {
  assert.match(service, /getNearbyPlacesAdaptive/);
  assert.match(service, /MIN_ADAPTIVE_RESULTS = 10/);
  assert.match(service, /NEARBY_RADIUS_OPTIONS\.filter\(\(km\) => km >= requested\)/);
  assert.match(explore, /getNearbyPlacesAdaptive\(/);
  assert.match(explore, /explore\.zoneExpanded/);
});

test('ouverts d\'abord, puis le plus proche à égalité', () => {
  assert.match(explore, /aOpen !== bOpen/);
  assert.match(explore, /aDistance - bDistance/);
});

test('le message d\'élargissement existe dans les 6 langues', () => {
  for (const l of ['de', 'en', 'es', 'fr', 'it', 'zh']) {
    const json = JSON.parse(read('i18n', 'locales', `${l}.json`));
    assert.ok(json.explore.zoneExpanded.includes('{{km}}'), l);
  }
});

test('lieux publics sans photo : pas de photo de plat trompeuse dans Explorer', () => {
  assert.match(explore, /showPlaceholder = isPublicPlace && !normalizeText\(item\?\.imageUrl\)/);
  assert.match(explore, /cardImagePlaceholder/);
});
