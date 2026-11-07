'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const localeDirectory = path.join(__dirname, '..', 'i18n', 'locales');
const requiredKeys = [
  'title',
  'intro',
  'statusError',
  'statusConnected',
  'statusPlatformPaused',
  'statusReview',
  'statusIncomplete',
  'requirementsDue',
  'countryCodeError',
  'countryLabel',
  'countryPlaceholder',
  'countryHelp',
  'continueButton',
  'connectButton',
  'refreshButton',
  'secureNotice',
  'profileLink',
  'manageButton',
  'reconciliationTitle',
  'reconciliationSubtitle',
  'reconciliationEmpty',
  'reconciliationLoadError',
  'reconciliationRetry',
  'retryDone',
  'retryFailed',
  'resolutionNoteError',
  'resolutionNotePlaceholder',
  'reconciliationResolve',
];

for (const locale of ['de', 'en', 'es', 'fr', 'it', 'zh']) {
  test(`locale ${locale}.json is valid and includes payout translations`, () => {
    const file = path.join(localeDirectory, `${locale}.json`);
    const content = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.ok(content.payouts, 'payout translations must exist');
    for (const key of requiredKeys) {
      assert.equal(typeof content.payouts[key], 'string', `missing payouts.${key}`);
      assert.ok(content.payouts[key].length > 0, `empty payouts.${key}`);
    }
  });
}

// Parité complète : chaque langue doit contenir exactement les mêmes clés que le français.
const flattenKeys = (object, prefix = '') =>
  Object.entries(object).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? flattenKeys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  );

const readLocale = (locale) =>
  JSON.parse(fs.readFileSync(path.join(localeDirectory, `${locale}.json`), 'utf8'));

const referenceKeys = new Set(flattenKeys(readLocale('fr')));

for (const locale of ['de', 'en', 'es', 'it', 'zh']) {
  test(`locale ${locale}.json has exactly the same keys as fr.json`, () => {
    const keys = new Set(flattenKeys(readLocale(locale)));
    const missing = [...referenceKeys].filter((key) => !keys.has(key));
    const extra = [...keys].filter((key) => !referenceKeys.has(key));
    assert.deepEqual(missing, [], `${locale}: clés manquantes (${missing.length})`);
    assert.deepEqual(extra, [], `${locale}: clés en trop (${extra.length})`);
  });

  test(`locale ${locale}.json has no empty translation`, () => {
    const empty = [];
    const walk = (object, prefix = '') =>
      Object.entries(object).forEach(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) walk(value, `${prefix}${key}.`);
        else if (typeof value === 'string' && value.trim() === '') empty.push(`${prefix}${key}`);
      });
    walk(readLocale(locale));
    assert.deepEqual(empty, [], `${locale}: traductions vides`);
  });
}
