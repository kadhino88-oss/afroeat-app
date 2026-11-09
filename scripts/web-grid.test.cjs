const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('grille : 1 colonne sur téléphone, 2 sur tablette, 3 sur ordinateur', () => {
  const src = read('hooks', 'use-grid-columns.js');
  assert.match(src, /width >= 1000\) return 3/);
  assert.match(src, /width >= 680\) return 2/);
  assert.match(src, /Platform\.OS !== 'web'\) return 1/);
});

test("Accueil et Explorer : listes de restaurants en grille responsive et contenu centré", () => {
  for (const file of ['index.js', 'explore.js']) {
    const src = read('app', '(tabs)', file);
    assert.match(src, /useGridColumns\(\)/, file);
    assert.match(src, /numColumns=\{columns\}/, file);
    assert.match(src, /key=\{`grid-\$\{columns\}`\}/, file);
    assert.match(src, /maxWidth: MAX_CONTENT_WIDTH/, file);
  }
});
