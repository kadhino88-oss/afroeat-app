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
