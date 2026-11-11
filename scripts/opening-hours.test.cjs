const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('restaurant settings open the opening-hours screen instead of a placeholder', () => {
  const settings = read('app', 'restaurant', 'restaurant-settings.js');
  assert.match(settings, /router\.push\('\/restaurant\/opening-hours'\)/);
  assert.doesNotMatch(settings, /hoursInfoBody/);
  assert.match(read('app', 'restaurant', '_layout.js'), /name="opening-hours"/);
});

test('opening-hours screen saves a Monday-to-Sunday schedule', () => {
  const src = read('app', 'restaurant', 'opening-hours.js');
  assert.match(src, /const DAYS = \['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'\]/);
  assert.match(src, /updateMyRestaurant\(restaurant\._id, \{ openingHours: payload \}/);
});
