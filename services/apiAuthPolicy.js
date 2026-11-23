'use strict';

// Pure auth policy for the API client (no React Native imports, testable in node).

const getOrigin = (value) => {
  const match = /^(https?):\/\/([^/?#\\@\s]+)(?:[/?#]|$)/i.exec(String(value ?? '').trim());
  return match ? `${match[1].toLowerCase()}://${match[2].toLowerCase()}` : '';
};

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(String(value ?? '').trim());

// A Bearer token may only be sent to the API origin: relative endpoints, or absolute
// URLs whose origin equals the origin of API_BASE_URL.
const isTokenAllowedForUrl = (endpoint, apiBaseUrl) => {
  if (!isAbsoluteUrl(endpoint)) return true;
  const target = getOrigin(endpoint);
  const base = getOrigin(apiBaseUrl);
  return Boolean(target) && Boolean(base) && target === base;
};

// Routes where a 401 means "wrong credentials/code", not "session rejected".
const NO_LOGOUT_PATHS = [
  /^\/users\/login(\/2fa)?$/,
  /^\/users\/forgot-password$/,
  /^\/users\/reset-password$/,
  /^\/users\/me\/password$/,
  /^\/users\/verify-identity$/,
  /^\/admin\/2fa\/[^/]+$/,
];

const getEndpointPath = (endpoint) => {
  let value = String(endpoint ?? '').trim();
  value = value.replace(/^https?:\/\/[^/?#]+/i, '');
  value = value.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  value = value.replace(/^\/api(?=\/)/, '');
  return value.startsWith('/') ? value : `/${value}`;
};

// Any 401 on an authenticated request ends the session, except credential-check routes.
const shouldLogoutOnUnauthorized = ({ status, token, endpoint }) => {
  if (!token || Number(status) !== 401) return false;
  const path = getEndpointPath(endpoint);
  return !NO_LOGOUT_PATHS.some((pattern) => pattern.test(path));
};

module.exports = {
  getOrigin,
  isAbsoluteUrl,
  isTokenAllowedForUrl,
  getEndpointPath,
  shouldLogoutOnUnauthorized,
};
