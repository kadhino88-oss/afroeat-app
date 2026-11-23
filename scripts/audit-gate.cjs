#!/usr/bin/env node
/**
 * Contrôle des vulnérabilités (dépendances de production) : échoue sur toute alerte high/critical,
 * sauf celles listées dans IGNORED, chacune justifiée, datée et approuvée par le propriétaire du dépôt.
 * Échoue aussi (fail closed) si la sortie de `npm audit` est vide ou invalide (pas de `metadata`).
 */
'use strict';
const { execSync } = require('child_process');

const IGNORED = {};

const evaluateAuditReport = (raw, ignored = IGNORED) => {
  if (!raw || !String(raw).trim()) {
    return { ok: false, errors: ["Sortie de npm audit vide : l'audit n'a pas pu s'exécuter."] };
  }
  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    return { ok: false, errors: ['Sortie de npm audit illisible (JSON invalide).'] };
  }
  if (!report || typeof report !== 'object' || !report.metadata || typeof report.metadata !== 'object') {
    return {
      ok: false,
      errors: [`Rapport npm audit invalide (pas de metadata)${report?.error?.summary ? ` : ${report.error.summary}` : ''}.`],
    };
  }
  const blocking = new Set();
  for (const [name, vuln] of Object.entries(report.vulnerabilities || {})) {
    for (const via of vuln.via || []) {
      if (typeof via !== 'object') continue; // alerte héritée : comptée sur le paquet d'origine
      if (!['high', 'critical'].includes(via.severity)) continue;
      const id = String(via.url || '').split('/').pop();
      if (ignored[id]) continue;
      blocking.add(`${name} (${via.severity}) ${via.title} ${via.url}`);
    }
  }
  return { ok: blocking.size === 0, errors: [...blocking] };
};

const runAudit = () => {
  try {
    return execSync('npm audit --omit=dev --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (error) {
    return error.stdout; // npm audit sort en erreur dès qu'il trouve une alerte
  }
};

if (require.main === module) {
  const result = evaluateAuditReport(runAudit());
  if (!result.ok) {
    console.error('Audit en échec :\n' + result.errors.join('\n'));
    process.exit(1);
  }
  const ids = Object.keys(IGNORED);
  console.log(`Audit OK (exceptions documentées : ${ids.length ? ids.join(', ') : 'aucune'}).`);
}

module.exports = { evaluateAuditReport, IGNORED };
