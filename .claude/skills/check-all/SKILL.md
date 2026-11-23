---
name: check-all
description: Lance toute la validation locale de l'app (lint, tests check:*, audit, export web) comme la CI.
disable-model-invocation: true
---
Lis `.github/workflows/ci.yml` pour la liste à jour, puis exécute dans l'ordre et rapporte chaque résultat (arrête-toi et analyse au premier échec):
1. `npm run lint`
2. Tous les `npm run check:*` et les `node --test scripts/*.test.cjs` listés dans la CI
3. `node scripts/audit-gate.cjs`
4. `npx expo export --platform web` (si le temps le permet)
Termine par un verdict: « prêt pour PR » ou les corrections exactes à faire.
