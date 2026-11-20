'use strict';

const { spawn } = require('node:child_process');

const expoCli = require.resolve('expo/bin/cli');
const args = ['start', '--web', ...process.argv.slice(2)];
const env = {
  ...process.env,
  EXPO_PUBLIC_API_URL:
    process.env.EXPO_PUBLIC_LOCAL_API_URL || 'http://localhost:5000/api',
  EXPO_PUBLIC_USE_LOCAL_API: 'true',
};

const expo = spawn(process.execPath, [expoCli, ...args], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
  windowsHide: false,
});

expo.on('error', (error) => {
  console.error(`Impossible de démarrer Expo Web : ${error.message}`);
  process.exitCode = 1;
});

expo.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
