#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit): ESLint (config expo) sur le fichier modifié si les dépendances sont installées.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let file;
  try { file = JSON.parse(raw)?.tool_input?.file_path; } catch { process.exit(0); }
  if (!file || !/\.(jsx?|tsx?)$/.test(file) || file.includes('node_modules')) process.exit(0);
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!fs.existsSync(path.join(root, 'node_modules', '.bin', 'eslint'))) process.exit(0);
  const r = spawnSync('npx', ['--no-install', 'eslint', '--no-warn-ignored', file], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write(`ESLint a signalé des erreurs:\n${r.stdout}${r.stderr}`);
    process.exit(2);
  }
});
