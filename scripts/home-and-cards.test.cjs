const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (p) => fs.readFileSync(p, 'utf8');

test('la page d’accueil reste accessible : lien « Accueil » et aucun renvoi automatique des partenaires', () => {
  const nav = read('components/WebNavBar.web.js');
  assert.match(nav, /key: 'home', labelKey: 'nav\.home', href: '\/'/);
  assert.equal((nav.match(/key: 'site', labelKey: 'nav\.viewSite', href: '\/'/g) || []).length, 2);
  assert.doesNotMatch(read('app/index.web.js'), /staffRedirect/);
});

test('les cartes des commerces n’affichent plus de bloc noir : image du site ou panneau clair avec logo', () => {
  const cover = read('components/PlaceCover.js');
  assert.match(cover, /place\?\.imageUrl/);
  assert.doesNotMatch(cover, /#0D1C11'\s*}/);
  for (const f of ['app/(tabs)/explore.js', 'app/index.web.js', 'app/(tabs)/index.js']) {
    assert.match(read(f), /<PlaceCover place=/, f);
  }
});
