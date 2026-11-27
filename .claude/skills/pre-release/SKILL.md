---
name: pre-release
description: Checklist avant build EAS / déploiement web: cohérence des profils eas.json, URL d'API, variables publiques, version, tests.
disable-model-invocation: true
---
1. Lis `eas.json` et `app.config.js`. Pour chaque profil (development, preview, production) liste `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_API_URL`, wallets Google/Apple Pay. **Signale toute incohérence** (ex.: profil `production` pointant vers une URL contenant « test »). **Exception connue et voulue** : l’API de production s’appelle `afroeat-api-staging.vercel.app` (nom de projet Vercel trompeur, c’est bien le vrai backend, cf. `GUIDE_LANCEMENT_FR.md`) : ne la signale pas ; signale en revanche toute URL de production qui n’est pas celle-là.
2. Vérifie qu'aucune variable secrète n'est dans `eas.json`/`app.config.js` (seules `EXPO_PUBLIC_*`).
3. Lance `/check-all`.
4. Vérifie version/`autoIncrement`, permissions (localisation, notifications, caméra) et pages légales présentes.
5. Rends un verdict GO / NO-GO avec la liste des blocages. Ne lance jamais `eas build` ni `eas submit` sans demande explicite.
