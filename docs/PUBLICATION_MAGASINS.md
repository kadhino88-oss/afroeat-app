# Publier AFROEAT sur l'App Store et Google Play

Projet Expo : https://expo.dev/accounts/bk-entreprises-organization/projects/afroeat

## 1. Comptes (au nom de l'entreprise)

| | Lien | Coût | Remarque |
|---|---|---|---|
| Apple Developer | https://developer.apple.com/programs/enroll/ | 99 $/an | Compte « organisation » : numéro D-U-N-S requis (gratuit, quelques jours). |
| Google Play Console | https://play.google.com/console/signup | 25 $ (une fois) | Vérification d'identité ; règle de test fermé pour les comptes personnels récents (à vérifier à l'inscription). |
| Expo | https://expo.dev/signup | gratuit | Fait : organisation `bk-entreprises-organization`. |

## 2. Configuration Expo (une seule fois)

1. Vérifier que `app.json` correspond au projet de l'organisation : `expo.owner` =
   `bk-entreprises-organization` et `expo.extra.eas.projectId` = l'identifiant affiché sur la page du
   projet Expo (ce n'est pas un secret).
2. Sur expo.dev → projet → **Environment variables**, créer pour « preview » et « production » :
   - `EXPO_PUBLIC_API_URL` = adresse de l'API (`https://…/api`) — obligatoire, sinon la construction échoue ;
   - `EXPO_PUBLIC_STRIPE_KEY` = clé **publique** `pk_…` (jamais la clé secrète).
3. Créer un jeton : expo.dev → Settings → **Access tokens**, puis l'ajouter dans GitHub
   (`afroeat-app` → Settings → Secrets and variables → Actions) sous le nom `EXPO_TOKEN`.
   Ne jamais l'écrire dans une conversation.

## 3. Construire

GitHub → Actions → « Construire l'appli mobile (EAS) » → Run workflow.

- **Android** : fonctionne sans autre étape (EAS crée la clé de signature).
- **iOS** : la première fois, il faut se connecter au compte Apple. Depuis un ordinateur :
  `npx eas-cli build --platform ios --profile preview`, puis suivre les questions (connexion Apple,
  création des certificats). Ensuite le bouton GitHub suffit.

Le profil « preview » donne une appli à installer pour test ; « production » prépare l'envoi aux
magasins.

## 4. À préparer pour les fiches des magasins

- Icône 1024×1024 (sans transparence pour Apple) ; captures d'écran iPhone et Android, 6 langues si possible ;
- nom, sous-titre, description courte et longue (FR en priorité) ;
- **adresse de la politique de confidentialité** et des conditions d'utilisation (pages publiques) ;
- adresse d'assistance et e-mail de contact ;
- classification d'âge et déclaration de collecte de données (localisation, e-mail, téléphone, paiement) ;
- suppression de compte accessible depuis l'appli (exigence des deux magasins) ;
- compte de démonstration pour les relecteurs d'Apple/Google, **sur l'environnement de test**.

## 5. Avant d'envoyer

- la prise de commande en production est verrouillée (voir l'environnement de test) : le dire aux
  relecteurs ou fournir l'environnement de test, sinon l'appli peut être refusée pour « fonction non
  utilisable » ;
- tester sur de vrais appareils iOS et Android.
