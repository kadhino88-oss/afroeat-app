'use strict';

// Les cartes de l'annuaire affichent le logo seul (compact), sans grand cadre rectangulaire.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (p) => fs.readFileSync(p, 'utf8');

test('le composant PlaceLogo existe et ne dessine aucun panneau de fond', () => {
  const src = read('components/PlaceCover.js');
  assert.match(src, /export function PlaceLogo/);
  const logo = src.slice(src.indexOf('export function PlaceLogo'), src.indexOf('export default function PlaceCover'));
  assert.doesNotMatch(logo, /circle|panel|backgroundColor: base/);
});

test('Explorer, accueil mobile et accueil web utilisent le logo seul pour les lieux répertoriés', () => {
  for (const file of ['app/(tabs)/explore.js', 'app/(tabs)/index.js', 'app/index.web.js']) {
    const src = read(file);
    assert.match(src, /import \{ PlaceLogo \} from '.*components\/PlaceCover'/, file);
    assert.match(src, /<PlaceLogo /, file);
    assert.doesNotMatch(src, /<PlaceCover /, `${file} : le grand cadre PlaceCover ne doit plus être utilisé dans les cartes`);
  }
});

test('Explorer : carte compacte en ligne pour l’annuaire et les commerces sans photo', () => {
  const src = read('app/(tabs)/explore.js');
  assert.match(src, /const compactCard = showPlaceholder \|\| isPublicPlace/);
  assert.match(src, /cardRow:\s*\{[^}]*flexDirection: 'row'/s);
});
