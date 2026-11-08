# Ouvrir AFROEAT dans le navigateur du téléphone (iPhone compris)

La version web est la même application, exportée par Expo (`expo export -p web`) et hébergée sur Vercel.
Tout se fait depuis un téléphone, sans terminal.

## 1. Créer le projet Vercel (une seule fois)

1. Vercel → **Add New… → Project** → importer le dépôt `afroeat-app`.
2. Laisser les réglages détectés (ils viennent de `vercel.json`).
3. Dans **Environment Variables**, ajouter :
   - `EXPO_PUBLIC_API_URL` = l'adresse de l'API **terminant par `/api`**, par exemple `https://afroeat-api-staging.vercel.app/api`
4. **Deploy**. L'adresse obtenue (`https://….vercel.app`) s'ouvre dans Safari.

## 2. Autoriser le site auprès de l'API

Dans le projet **API** sur Vercel → Settings → Environment Variables, ajouter l'adresse du site web à `CORS_ORIGINS`
(adresses séparées par des virgules, sans `/` final), puis redéployer l'API.

## 3. Rendre l'API joignable

Dans le projet API → Settings → **Deployment Protection**, désactiver « Vercel Authentication » pour la production
(sinon le navigateur et l'application reçoivent une page de connexion Vercel au lieu des données).

## Limites de la version web

- La localisation demande l'autorisation du navigateur (HTTPS obligatoire, déjà le cas sur Vercel).
- Les paiements natifs (Apple Pay / Google Pay via Stripe) ne sont pas disponibles sur le web.
- Pour tester les fonctions natives sur iPhone : Expo Go (QR depuis un ordinateur) ou une build EAS.
