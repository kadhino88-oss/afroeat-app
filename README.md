# AFROEAT — application mobile

Application mobile React Native / Expo Router. L’API Node.js/Express/MongoDB est maintenue dans le dépôt privé [afroeat-backend](https://github.com/kadhino88-oss/afroeat-backend).

## Démarrage local

1. Installer les dépendances avec `npm ci`.
2. Copier `.env.example` vers `.env` et adapter l’adresse IP LAN de la machine.
3. Démarrer l’API sur le port 5000 et vérifier `GET http://localhost:5000/health`.
4. Lancer `npx expo start`.

Pour un téléphone physique, `EXPO_PUBLIC_API_URL` doit contenir l’adresse IP LAN de l’ordinateur, par exemple `http://192.168.1.121:5000/api`. Pour un émulateur Android, utiliser `http://10.0.2.2:5000/api`. L’URL configurée doit se terminer par `/api`.

## Builds EAS

Les profils EAS définissent `EXPO_PUBLIC_APP_ENV` (`development`, `preview` ou `production`). Les profils preview et production doivent recevoir une valeur explicite pour `EXPO_PUBLIC_API_URL` via l’environnement de build EAS.

Une build de production est refusée lorsque :
- l’URL API est absente, n’utilise pas HTTPS, ne termine pas par `/api`, ou ressemble à une adresse d’exemple/privée ;
- `EXPO_PUBLIC_STRIPE_KEY` n’est pas une véritable clé publique Stripe live ;
- le build Android ne reçoit pas `ANDROID_GOOGLE_MAPS_API_KEY`.

La clé Google Maps est incluse dans l’application : restreindre cette clé au nom de package Android AFROEAT et au certificat de signature. Ne jamais placer de clé secrète Stripe, de JWT secret ou de connexion MongoDB dans une variable `EXPO_PUBLIC_*`.

## Paiements et portefeuilles

La sélection des moyens de paiement dépend de l’API. Apple Pay et Google Pay restent désactivés tant que les identifiants marchands et la configuration wallet ne sont pas vérifiés. Le paiement carte en production est également bloqué côté backend jusqu’à la configuration approuvée des versements marketplace ; le paiement à la livraison reste bloqué tant que le registre d’encaissement/règlement n’existe pas.

Le checkout envoie uniquement les identifiants des plats et leurs quantités. Le total affiché dans l’écran de paiement provient de la réponse du serveur. Les nouvelles tentatives du même checkout réutilisent une clé d’idempotence pour éviter les commandes en double.

## Contrôles

`npm run lint` ou `npx eslint app/payment.js app/checkout.js services/stripeService.js services/stripeService.web.js constants/api.js app.config.js`

Le workflow GitHub Actions installe les dépendances, vérifie les fichiers modifiés et exporte la version web. Les paiements Stripe en mode test et les essais sur appareil réel restent nécessaires avant publication.

## Sécurité

Les fichiers `.env` locaux sont ignorés par Git. Ne jamais publier de secrets, certificats de signature ou identifiants de production. `.env.example` contient uniquement des valeurs de remplacement.
