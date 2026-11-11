const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('add and edit dish screens use the photo picker, not a URL field', () => {
  for (const f of ['AddMenuItem.js', 'EditMenuItem.js']) {
    const src = read('app', 'restaurant', f);
    assert.match(src, /<ImageUploadField value=\{image\} onChange=\{setImage\}/, f);
    assert.doesNotMatch(src, /placeholder="https:\/\/\.\.\."/, f);
  }
});

test('upload resizes the picture and posts it to the images endpoint', () => {
  const src = read('services', 'imageUploadService.js');
  assert.match(src, /manipulateAsync/);
  assert.match(src, /API_ENDPOINTS\.images\.upload/);
  assert.match(read('constants', 'api.js'), /images: \{\s*upload: '\/images'/);
});

test('restaurant profile lets the owner upload a logo and a cover photo', () => {
  const src = read('app', 'restaurant', 'restaurant-profile.js');
  assert.match(src, /saveRestaurantImage\('image', url\)/);
  assert.match(src, /saveRestaurantImage\('coverImage', url\)/);
});
