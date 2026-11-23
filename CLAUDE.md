# AfroEat App

Application Expo (SDK 58, React Native 0.88, expo-router, web via Vercel) pour clients, restaurants/partenaires, livreurs et admins. Backend: `afroeat-backend`. Concurrents visés: Uber Eats, Just Eat, Deliveroo → fluidité, fiabilité du paiement, sécurité, i18n irréprochables.

## Commandes
- `npm ci --legacy-peer-deps` (requis) · `npm start` · `npm run web`
- `npm run lint` (expo lint) · `npm run check:*` (tests `node --test` dans `scripts/`) — voir `.github/workflows/ci.yml` pour la liste complète exécutée en CI.
- Web: `npx expo export --platform web`. Builds: EAS (`eas.json`: development / preview / production).

## Architecture
`app/` (routes expo-router: `(tabs)`, `auth`, `order`, `restaurant`, `livraison`, `admin`, `payment`…) · `components/` · `services/` (client API + Stripe + notifications) · `store/` · `context/` · `i18n/` · `constants/` (config API) · `hooks/`. Variantes `.web.js` pour le web.

## Règles non négociables
- Aucune clé secrète dans l'app (seules les variables `EXPO_PUBLIC_*` publiques). Jamais de clé Stripe secrète.
- Tokens/sessions: stockage et expiration gérés dans `services/apiClient.js`/`authService.js`; ne pas les logger.
- Toute chaîne visible passe par i18n et existe dans **toutes** les langues (`npm run check:locales`).
- Fluidité: listes en `FlatList`/`FlashList` avec `keyExtractor` stable, `React.memo`/`useCallback` sur les items, images via `expo-image`, aucune requête réseau en cascade au rendu, états de chargement/erreur/vide systématiques, animations Reanimated (thread UI).
- Garder la parité mobile/web (`.web.js`) et la compatibilité des routes de paiement avec le backend (`check:payment-route-sync`).
- Accessibilité: labels, contrastes, zones tactiles ≥ 44 px.
- Ne pas modifier `.env*`, `package-lock.json` (hook de blocage); `eas.json`, `vercel.json`, `app.config.js`, workflows → confirmation.
- Toute logique nouvelle = un test `scripts/*.test.cjs` ajouté à la CI.

## Automatisations Claude (`.claude/`)
- Hooks: blocage fichiers secrets · ESLint après édition.
- Agents: `security-reviewer`, `performance-reviewer`, `i18n-checker`.
- Skills: `/check-all`, `/pre-release`.
- MCP: context7 (docs Expo / React Native / expo-router à jour).
