# Afroeat — guide de lancement

## État actuel

- Le site public est disponible sur `https://afroeat-app.vercel.app` et l’API sur `https://afroeat-api.vercel.app/api`.
- Le contrôle de santé de l’API confirme la connexion à la base de production `afroeat_live` et la présence de Stripe. La clé et le secret webhook ne sont jamais exposés dans ce guide.
- Les commandes de production et les versements Connect restent désactivés jusqu’à validation de la signature du webhook live, des comptes Connect, des scénarios d’échec et des opérations de livraison.
- Le rapport précédent mentionne un build Android de production basé sur un ancien commit ; aucun build magasin basé sur la révision web actuellement publiée n’est encore confirmé ici. Un export Expo n’est pas un APK ou un AAB installable.
- Les restaurants peuvent saisir leur temps moyen réel de préparation. Si aucun temps n’est fourni, l’application ne doit pas en inventer un.
- Les notes de restaurant ne s’affichent que si une note et un nombre d’évaluations existent. Le dépôt d’avis vérifiés et les notes par plat ne sont pas encore implémentés.
- La mention « Restaurant premium » dépend du réglage `isFeatured`. Les plats mis en avant sont maintenant étiquetés comme des plats à découvrir.
- Le temps de préparation n’est pas une estimation complète de livraison. Afroeat n’a pas encore de calcul ETA combinant préparation, distance routière et disponibilité des livreurs.

## Ce que « mondial » implique

Le catalogue et la politique de commission sont configurés par pays et par devise. La table contient actuellement les marchés de lancement France et Suisse ; de nouveaux marchés peuvent être ajoutés sans changer le modèle tarifaire. Leur ouverture réelle dépend encore des moyens de paiement, des règles fiscales, des corridors Stripe Connect, des livreurs et de l’assistance locale.

## À vérifier avant une bêta publique

1. Vérifier les sauvegardes/restaurations et la supervision de `afroeat_live` sans modifier les données existantes.
2. Vérifier les secrets EAS de production : `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_STRIPE_KEY` et `ANDROID_GOOGLE_MAPS_API_KEY`, puis générer et installer des builds candidats Android/iOS.
3. Confirmer que `STRIPE_WEBHOOK_SECRET` correspond à `https://afroeat-api.vercel.app/api/payments/webhook`, puis valider la signature avec un événement de test, sans paiement réel.
4. Les valeurs de pilote actuellement configurées sont 15 % de commission plateforme et 80 % des frais de livraison au livreur sur CHF/EUR, pour CH/FR. Toute autre devise ou zone reste fermée jusqu’à validation locale.
5. Vérifier les conditions commerciales, délais et zones, la disponibilité des livreurs, le support, les remboursements, la sécurité alimentaire et les obligations légales de chaque pays ouvert.
6. Tester sur appareils la connexion, le catalogue, l’adresse, les erreurs réseau, l’annulation, les notifications, le suivi et la suppression du compte. Ne jamais utiliser de fonds réels dans un test.

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
