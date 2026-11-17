#!/usr/bin/env node
/**
 * Contrôle des vulnérabilités (dépendances de production) : échoue sur toute alerte high/critical,
 * sauf celles listées ci-dessous, chacune justifiée, datée et approuvée par le propriétaire du dépôt.
 * Retirer une exception dès qu'un correctif est publié.
 */
'use strict';
const { execSync } = require('child_process');

const IGNORED = {
  // picomatch (ReDoS sur extglobs) — exception approuvée le 17/11/2026 : aucune version corrigée publiée.
  // Utilisé seulement par les outils de compilation d'Expo (Metro, CLI) sur nos propres motifs, pas dans l'appli livrée.
  'GHSA-fc5q-39xc-vjpf': 'picomatch — outils de compilation, pas de correctif disponible',
};

let raw;
try {
  raw = execSync('npm audit --omit=dev --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch (error) {
  raw = error.stdout; // npm audit sort en erreur dès qu'il trouve une alerte
}
const report = JSON.parse(raw || '{}');
const blocking = new Set();
for (const [name, vuln] of Object.entries(report.vulnerabilities || {})) {
  for (const via of vuln.via || []) {
    if (typeof via !== 'object') continue; // alerte héritée : comptée sur le paquet d'origine
    if (!['high', 'critical'].includes(via.severity)) continue;
    const id = String(via.url || '').split('/').pop();
    if (IGNORED[id]) continue;
    blocking.add(`${name} (${via.severity}) ${via.title} ${via.url}`);
  }
}
if (blocking.size) {
  console.error('Vulnérabilités bloquantes :\n' + [...blocking].join('\n'));
  process.exit(1);
}
console.log(`Audit OK (exceptions documentées : ${Object.keys(IGNORED).join(', ')}).`);
