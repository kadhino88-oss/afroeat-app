const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Chaque lien interne (router.push / pathname) doit viser un écran qui existe dans app/.
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []
  );

const exists = (route) => {
  const p = route.split('?')[0].replace(/\/$/, '');
  const candidates = [`app${p}`, `app/(tabs)${p.replace('/(tabs)', '')}`, `app${p.replace('/(tabs)', '/(tabs)')}`];
  return candidates.some((base) =>
    ['.js', '.web.js', '/index.js', '/index.web.js'].some((ext) => fs.existsSync(`${base}${ext}`))
  ) || p === '';
};

test('tous les liens internes mènent à un écran existant', () => {
  const files = [...walk('app'), ...walk('components')];
  const missing = [];
  const re = /(?:pathname:\s*|router\.(?:push|replace|navigate)\(\s*)['"](\/[^'"]*)['"]/g;
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(re)) {
      if (!exists(m[1])) missing.push(`${file}: ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});
