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

Les textes des fiches (descriptions FR/EN, mots-clés, adresses, déclaration des données, notes pour
les relecteurs) sont prêts dans [FICHES_MAGASINS.md](FICHES_MAGASINS.md).

## 5. Réglages propres au mobile (une seule fois)

- **Variables EAS « production »** : en plus de `EXPO_PUBLIC_API_URL` et `EXPO_PUBLIC_STRIPE_KEY`
  (clé `pk_live_…`, sinon la construction s'arrête), définir `ANDROID_GOOGLE_MAPS_API_KEY`
  (clé Google Maps limitée à l'appli Android `com.bkentreprise.afroeat`) : obligatoire pour la carte Android.
- **Notifications Android** : créer un projet Firebase, puis déposer la clé de compte de service FCM V1
  sur expo.dev → projet → Credentials → Android. Sans elle, l'appli fonctionne mais n'envoie pas de
  notifications sur Android. Sur iOS, EAS crée la clé de notifications lors de la première construction.
- **Apple Pay** (désactivé dans `eas.json` pour la v1 ; à activer seulement après vérification de l’identifiant marchand) : enregistrer l'identifiant marchand `merchant.com.afroeat`
  dans le compte Apple Developer et le certificat associé dans Stripe. Sinon, passer
  `EXPO_PUBLIC_ENABLE_APPLE_PAY` à `false` dans `eas.json` avant la construction iOS.
- **Envoi automatique** : pour Google, déposer la clé de compte de service Play Console sur expo.dev
  (Credentials → Android → Google Service Account) ; pour Apple, se connecter une fois avec
  `npx eas-cli submit --platform ios` depuis un ordinateur. Ensuite, cocher « Envoyer automatiquement »
  dans le bouton GitHub (profil production). Google reçoit la version en brouillon sur la piste de
  test interne : rien n'est publié sans validation dans la Play Console.

## 6. Avant d'envoyer

- au moins un commerce actif avec un menu doit être visible, sinon l'appli peut être refusée pour
  « fonction non utilisable » ;
- fournir un compte client de démonstration aux relecteurs (voir FICHES_MAGASINS.md) ;
- tester sur de vrais appareils iOS et Android (installer d'abord une construction « preview »).
