const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('animations : bandeau, décor flottant et frise respectent « réduire les animations »', () => {
  assert.match(read('hooks', 'use-reduce-motion.js'), /isReduceMotionEnabled/);
  assert.match(read('components', 'Marquee.js'), /reduceMotion/);
  assert.match(read('components', 'FloatingDecor.js'), /useReduceMotion/);
  // Le nombre de copies est plafonné (pas de boucle d'emballement).
  assert.match(read('components', 'Marquee.js'), /Math\.min\(6,/);
});

test('animations : Accueil, Explorer, en-tête et page d\'accueil du site', () => {
  assert.match(read('app', '(tabs)', 'index.js'), /<DishMarquee \/>/);
  assert.match(read('app', 'index.web.js'), /<DishMarquee \/>/);
  assert.match(read('components', 'HomeHeader.js'), /<FloatingDecor \/>/);
  for (const f of ['index.js', 'explore.js']) assert.match(read('app', '(tabs)', f), /<FadeInView/);
});

test('même visuel partout : plus de violet, de bleu d\'interface ni de Georgia', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []);
  const root = path.join(__dirname, '..');
  const files = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'components'))];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(src, /#5A32A3|#7C3AED|#6D4CDB|#245EA8|#2457C5/i, path.relative(root, file));
    assert.doesNotMatch(src, /fontFamily:\s*'Georgia'/, path.relative(root, file));
  }
});

test('page d\'accueil du site : palette de la marque (vert forêt, crème)', () => {
  const src = read('app', 'index.web.js');
  assert.match(src, /cocoa: '#084424'/);
  assert.match(src, /paper: '#FBF6EC'/);
});

test('dépendances : @react-navigation/* est géré par Expo, exclu des mises à jour automatiques', () => {
  assert.match(read('.github', 'dependabot.yml'), /dependency-name: "@react-navigation\/\*"/);
});
