# Afroeat — guide de lancement

## État actuel

- L’export Expo Android a réussi. Le bundle et ses ressources sont dans `.expo-export-android-20261023-update/`.
- Cet export n’est pas un APK ou un AAB installable. Il faut encore lancer une compilation EAS avec un compte connecté et la configuration de production.
- Les restaurants peuvent saisir leur temps moyen réel de préparation. Si aucun temps n’est fourni, l’application ne doit pas en inventer un.
- Les notes de restaurant ne s’affichent que si une note et un nombre d’évaluations existent. Le dépôt d’avis vérifiés et les notes par plat ne sont pas encore implémentés.
- La mention « Restaurant premium » dépend du réglage `isFeatured`. Les plats mis en avant sont maintenant étiquetés comme des plats à découvrir.
- Le temps de préparation n’est pas une estimation complète de livraison. Afroeat n’a pas encore de calcul ETA combinant préparation, distance routière et disponibilité des livreurs.

## Ce que « mondial » implique

Le catalogue et la politique de commission sont configurés par pays et par devise. La table contient actuellement les marchés de lancement France et Suisse ; de nouveaux marchés peuvent être ajoutés sans changer le modèle tarifaire. Leur ouverture réelle dépend encore des moyens de paiement, des règles fiscales, des corridors Stripe Connect, des livreurs et de l’assistance locale.

## À fournir ou configurer avant une bêta publique

1. Déployer l’API sur une URL HTTPS et préparer MongoDB en production, ses sauvegardes et sa surveillance.
2. Dans les secrets EAS, configurer `EXPO_PUBLIC_API_URL` avec l’URL publique terminée par `/api`, `EXPO_PUBLIC_STRIPE_KEY` avec la clé publique live, et `ANDROID_GOOGLE_MAPS_API_KEY` avec une clé restreinte à l’application et à son certificat.
3. Dans l’environnement sécurisé du backend, renseigner `MONGO_URI`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_API_URL`, `PUBLIC_WEB_URL` et les paramètres Stripe Connect autorisés.
4. Configurer `MARKETPLACE_RATES_JSON` par couple pays/devise, par exemple `FR:EUR`. La politique initiale est de 12 % de commission en lancement, puis 15 % après validation du marché, et au moins 90 % des frais de livraison reversés au livreur. Les versements Connect restent désactivés jusqu'à validation technique et opérationnelle du pays concerné.
5. Vérifier la politique de confidentialité, les conditions, les remboursements, la sécurité alimentaire et les obligations légales dans chaque pays ouvert.
6. Faire les essais de bout en bout sur vrais appareils : inscription, commande, paiement, annulation/remboursement, versement partenaire, livraison, notifications et suppression du compte.

Ne partage pas de clés secrètes dans le dépôt ni dans une conversation. Configure-les dans les gestionnaires de secrets des services concernés.

## Produire les versions des magasins

Depuis `AfroeatApp`, après connexion au compte EAS et configuration des secrets :

```powershell
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production
```

La publication nécessite aussi les comptes développeur Play Console et Apple, leurs informations légales et les fiches de magasin. L’export Expo déjà généré ne publie rien et ne crée pas ces comptes.

## Ce qui reste à construire côté produit

- Des avis vérifiés après livraison, avec notes par restaurant et par plat, signalement et modération.
- Une ETA de livraison fiable, reliée à un fournisseur d’itinéraires et au dispatch réel des livreurs.
- Les parcours opérationnels et le support capables de traiter retards, incidents, remboursements, fraudes et litiges à l’échelle.

Afroeat possède déjà des briques d’application de commande, de catalogue, de favoris, de paiement et de gestion partenaire. Cela ne suffit pas encore à affirmer que l’application dépasse Uber Eats ou Deliveroo : cette comparaison exige les fonctions listées ci-dessus, une bêta mesurée, des opérations fiables et une adoption réelle. Aucun code ne peut garantir un chiffre d’affaires d’un milliard.

### Paiement carte sur le web

Pour activer le paiement web, configure `PUBLIC_WEB_URL` côté backend avec l’URL HTTPS exacte du site AFROEAT (sans chemin final), ainsi que `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET`. Le navigateur est redirigé vers Stripe Checkout, puis AFROEAT confirme la session auprès du backend au retour. Ne considère jamais la page de retour seule comme une preuve de paiement.
