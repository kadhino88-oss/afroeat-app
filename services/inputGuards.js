'use strict';

// Pure helpers (no React Native imports) shared by the app and node tests.

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

const isValidObjectId = (value) =>
  typeof value === 'string' && OBJECT_ID_PATTERN.test(value.trim());

// Returns a validated 24-hex id from an expo-router param (string | string[]), or ''.
const getRouteObjectId = (value) => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  return OBJECT_ID_PATTERN.test(trimmed) ? trimmed : '';
};

// Strips characters that could inject extra mailto: headers or break the URL.
const sanitizeEmail = (value) => {
  const cleaned = String(value ?? '')
    .replace(/[\s\u0000-\u001f\u007f<>"',;?&=%]/g, '')
    .trim();
  return /^[^@]+@[^@]+\.[^@]+$/.test(cleaned) ? cleaned : '';
};

const ALLOWED_PAYMENT_ORIGINS = [
  'https://checkout.stripe.com',
  'https://connect.stripe.com',
  'https://billing.stripe.com',
];

const getUrlOrigin = (value) => {
  const match = /^(https?):\/\/([^/?#\\@\s]+)(?:[/?#]|$)/i.exec(String(value ?? '').trim());
  if (!match) return '';
  return `${match[1].toLowerCase()}://${match[2].toLowerCase()}`;
};

const isAllowedPaymentUrl = (url, { allowOtpauth = false } = {}) => {
  const value = String(url ?? '').trim();
  if (!value) return false;
  if (allowOtpauth && /^otpauth:\/\/(totp|hotp)\//i.test(value)) return true;
  return ALLOWED_PAYMENT_ORIGINS.includes(getUrlOrigin(value));
};

module.exports = {
  isValidObjectId,
  getRouteObjectId,
  sanitizeEmail,
  isAllowedPaymentUrl,
  getUrlOrigin,
  ALLOWED_PAYMENT_ORIGINS,
};
