const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveApiConfig } = require('../constants/apiConfig');

test('development without explicit URL uses the configured LAN address', () => {
  const config = resolveApiConfig({
    appEnv: 'development',
    configuredApiUrl: '',
    localIp: '192.168.1.121',
    localPort: '5000',
    platform: 'ios',
  });
  assert.equal(config.baseUrl, 'http://192.168.1.121:5000/api');
  assert.equal(config.isProduction, false);
  assert.equal(config.protocol, 'http');
  assert.equal(config.port, '5000');
});

test('Android emulator maps localhost to 10.0.2.2', () => {
  const config = resolveApiConfig({
    appEnv: 'development',
    localIp: 'localhost',
    localPort: '5000',
    platform: 'android',
  });
  assert.equal(config.baseUrl, 'http://10.0.2.2:5000/api');
});

test('a configured development URL is used without hardcoded production domains', () => {
  const config = resolveApiConfig({
    appEnv: 'development',
    configuredApiUrl: 'http://192.168.1.20:5000/api',
  });
  assert.equal(config.baseUrl, 'http://192.168.1.20:5000/api');
  assert.equal(config.host, '192.168.1.20');
  assert.equal(config.port, '5000');
});

test('preview refuses to silently fall back to a developer LAN IP', () => {
  assert.throws(
    () => resolveApiConfig({ appEnv: 'preview', configuredApiUrl: '' }),
    /obligatoire pour les builds preview et production/
  );
});

test('production refuses to silently fall back to a developer LAN IP', () => {
  assert.throws(
    () => resolveApiConfig({ appEnv: 'production', configuredApiUrl: '' }),
    /obligatoire pour les builds preview et production/
  );
});

test('production only accepts public HTTPS API domains', () => {
  for (const configuredApiUrl of [
    'http://api.afroeat.com/api',
    'https://localhost/api',
    'https://192.168.1.25/api',
    'https://10.0.0.2/api',
    'https://api.afroeat.example/api',
    'https://api.afroeat.com/v1',
    'https://user:pass@api.afroeat.com/api',
    'https://api.afroeat.com/api?debug=1',
    'https://api.afroeat.com/api#token',
  ]) {
    assert.throws(
      () => resolveApiConfig({ appEnv: 'production', configuredApiUrl }),
      undefined,
      `Expected production URL to be rejected: ${configuredApiUrl}`
    );
  }
});

test('production accepts a public HTTPS API URL ending exactly in /api', () => {
  const config = resolveApiConfig({
    appEnv: 'production',
    configuredApiUrl: 'https://api.afroeat.com/api',
  });
  assert.equal(config.baseUrl, 'https://api.afroeat.com/api');
  assert.equal(config.isProduction, true);
  assert.equal(config.protocol, 'https');
  assert.equal(config.host, 'api.afroeat.com');
  assert.equal(config.port, null);
});

test('unknown environments and invalid local ports are rejected', () => {
  assert.throws(() => resolveApiConfig({ appEnv: 'prod' }), /doit être development, preview ou production/);
  assert.throws(
    () => resolveApiConfig({ appEnv: 'development', localPort: '70000' }),
    /port valide entre 1 et 65535/
  );
  assert.throws(
    () => resolveApiConfig({ appEnv: 'development', localIp: '192.168.1.2/path' }),
    /uniquement un nom d’hôte ou une adresse IP/
  );
});
