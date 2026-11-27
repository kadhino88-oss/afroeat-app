'use strict';

// Garde-fous de préparation aux magasins (Apple App Store / Google Play).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const app = JSON.parse(read('app.json')).expo;

// En-tête PNG : largeur/hauteur aux octets 16-23, type de couleur à l'octet 25 (2 = RGB sans alpha, 6 = RGBA).
const pngInfo = (p) => {
  const buf = fs.readFileSync(path.join(root, p));
  assert.equal(buf.subarray(1, 4).toString(), 'PNG', `${p} n'est pas un PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
};

test('icône de l’application : 1024×1024 opaque (sans canal alpha, exigence Apple ITMS-90717)', () => {
  const icon = pngInfo(app.icon.replace('./', ''));
  assert.equal(icon.width, 1024);
  assert.equal(icon.height, 1024);
  assert.equal(icon.colorType, 2, 'l’icône ne doit pas avoir de canal alpha');
});

test('icône adaptative Android et icône de notification présentes et distinctes de l’icône principale', () => {
  const fg = pngInfo(app.android.adaptiveIcon.foregroundImage.replace('./', ''));
  assert.equal(fg.width, 1024);
  const notif = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-notifications')[1];
  assert.notEqual(notif.icon, app.icon, 'l’icône de notification Android doit être une silhouette, pas l’icône couleur');
  const n = pngInfo(notif.icon.replace('./', ''));
  assert.equal(n.colorType, 6, 'la silhouette de notification doit avoir un canal alpha');
});

test('les images du modèle Expo ne sont plus embarquées', () => {
  const files = fs.readdirSync(path.join(root, 'assets', 'images'));
  assert.deepEqual(files.filter((f) => /react-logo|android-icon-/.test(f)), []);
  assert.equal(fs.existsSync(path.join(root, 'app', 'assets')), false, 'doublon app/assets (dans le dossier des routes)');
});

test('caméra : aucune utilisation tant que l’autorisation n’est pas déclarée', () => {
  const picker = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker')[1];
  assert.equal(picker.cameraPermission, false);
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (/\.(js|jsx|ts|tsx)$/.test(entry.name) && /launchCameraAsync|requestCameraPermissionsAsync/.test(read(rel))) offenders.push(rel);
    }
  };
  ['app', 'components', 'services', 'hooks', 'context'].forEach(walk);
  assert.deepEqual(offenders, []);
});

test('iPad non déclaré pour la v1, mode clair forcé (pas de thème sombre implémenté)', () => {
  assert.equal(app.ios.supportsTablet, false);
  assert.equal(app.userInterfaceStyle, 'light');
});

test('textes d’autorisation iOS dans les six langues, avec position du livreur et documents justificatifs', () => {
  for (const lang of ['fr', 'en', 'de', 'es', 'it', 'zh']) {
    assert.ok(app.locales[lang], `locale ${lang} non déclarée dans app.json`);
    const strings = JSON.parse(read(app.locales[lang].replace('./', '')));
    assert.ok(strings.NSLocationWhenInUseUsageDescription.length > 30, lang);
    assert.ok(strings.NSPhotoLibraryUsageDescription.length > 20, lang);
  }
  assert.match(JSON.parse(read('store/locales/fr.json')).NSLocationWhenInUseUsageDescription, /livreurs/);
  assert.match(JSON.parse(read('store/locales/fr.json')).NSPhotoLibraryUsageDescription, /justificatifs/);
});

test('politique de confidentialité et conditions accessibles sur les écrans natifs d’inscription, connexion et profil', () => {
  for (const screen of ['app/auth/login.js', 'app/auth/register-client.js', 'app/auth/register-driver.js', 'app/auth/register-restaurant.js']) {
    assert.match(read(screen), /<LegalLinks\s*\/>/, `${screen} sans liens légaux`);
  }
  assert.match(read('components/AccountPrivacyLink.js'), /<LegalLinkRows\s*\/>/);
  const links = read('components/LegalLinks.js');
  assert.match(links, /\/legal\/privacy/);
  assert.match(links, /\/legal\/terms/);
});
