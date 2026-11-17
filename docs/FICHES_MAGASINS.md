# Fiches App Store et Google Play — textes prêts à copier

Toutes les adresses ci-dessous sont publiques et répondent déjà. Quand le nom de domaine sera acheté,
remplacer `afroeat-app.vercel.app` et `afroeat-api-staging.vercel.app` par le domaine définitif.

## Informations générales

| Champ | Valeur |
|---|---|
| Nom de l'appli | Afroeat |
| Sous-titre (Apple, 30 caractères max.) | Saveurs africaines, tout près |
| Catégorie principale | Alimentation et boissons (Apple) / Cuisine et boissons (Google) |
| Catégorie secondaire (Apple) | Shopping |
| Identifiant | `com.bkentreprise.afroeat` (iOS et Android) |
| Politique de confidentialité | https://afroeat-app.vercel.app/legal/privacy |
| Conditions d'utilisation | https://afroeat-app.vercel.app/legal/terms |
| Suppression du compte (Google, obligatoire) | https://afroeat-api-staging.vercel.app/api/users/account-deletion |
| Assistance | https://afroeat-app.vercel.app/profile/help |
| Site web | https://afroeat-app.vercel.app |
| Pays de diffusion (lancement) | Suisse, France |

## Description courte (Google, 80 caractères max.)

**FR** : Plats, épiceries et boutiques africaines livrés près de chez vous.

**EN** : African dishes, groceries and shops delivered near you.

## Mots-clés (Apple, 100 caractères max., séparés par des virgules)

**FR** : livraison,restaurant africain,épicerie africaine,halal,mafé,yassa,attiéké,Genève,Annemasse,Annecy

**EN** : delivery,african food,african grocery,halal,mafe,yassa,attieke,Geneva,food,takeaway

## Description longue

### FR

Afroeat est la plateforme de livraison dédiée aux restaurants, épiceries et boutiques africains.

Commandez vos plats préférés, de l'Afrique de l'Ouest au Maghreb, et faites-vous livrer chez vous :
yassa, mafé, attiéké, thiéboudienne, couscous, grillades, fast-foods halal et bien plus.

- Restaurants, fast-foods, épiceries et boutiques africains réunis dans une seule appli
- Carte des commerces africains autour de vous
- Paiement sécurisé par carte (Stripe)
- Suivi de la commande et du livreur en temps réel
- Adresses enregistrées, favoris et codes promo
- Remboursement automatique si une commande payée est annulée

Commerçants : rejoignez Afroeat depuis l'appli, ajoutez votre logo et vos plats, et recevez vos revenus
automatiquement à chaque commande livrée.

Lancement à Genève, Annemasse et Annecy, puis dans toute la Suisse et en Auvergne-Rhône-Alpes.

### EN

Afroeat is the delivery platform dedicated to African restaurants, groceries and shops.

Order your favourite dishes, from West Africa to North Africa, delivered to your door: yassa, mafé,
attiéké, thieboudienne, couscous, grills, halal fast food and much more.

- African restaurants, fast food, groceries and shops in one app
- Map of African businesses around you
- Secure card payment (Stripe)
- Real-time order and courier tracking
- Saved addresses, favourites and promo codes
- Automatic refund if a paid order is cancelled

Business owners: join Afroeat from the app, add your logo and dishes, and get paid automatically for
every delivered order.

Launching in Geneva, Annemasse and Annecy, then across Switzerland and Auvergne-Rhône-Alpes.

## Classification d'âge

- Apple : 4+ ; Google (questionnaire IARC) : « Tout public ».
- **À revoir** si des commerces vendent de l'alcool via l'appli : l'âge minimum et les règles
  de vente d'alcool changent (Apple 17+, déclaration spécifique chez Google).

## Déclaration des données (Apple « Confidentialité de l'app » / Google « Sécurité des données »)

Données liées à l'identité de l'utilisateur, jamais vendues ni utilisées pour du pistage publicitaire :

| Donnée | Pourquoi | Obligatoire |
|---|---|---|
| Nom, e-mail, téléphone | Compte, commande, contact du livreur | Oui |
| Adresse de livraison | Livraison | Oui pour commander |
| Position précise (seulement pendant l'utilisation) | Commerces proches, suivi de livraison, position du livreur | Non (client), oui pendant une course (livreur) |
| Historique des commandes | Service, assistance, comptabilité | Oui |
| Informations de paiement | Traitées par Stripe ; l'appli ne stocke pas les numéros de carte | Oui pour payer par carte |
| Photos choisies | Profil, logo, plats | Non |
| Pièces d'identité / permis de travail (livreurs et commerçants uniquement) | Vérification avant activation, chiffrées | Oui pour ces comptes |
| Jeton de notification | Suivi de commande | Non |
| Diagnostic (erreurs techniques, sans contenu personnel) | Stabilité du service | Non |

- Données chiffrées en transit : **oui** (HTTPS).
- L'utilisateur peut demander la suppression : **oui**, depuis l'appli (Profil → Confidentialité) et
  via l'adresse de suppression ci-dessus.

## Notes pour les relecteurs (Apple « App Review Information » / Google « Accès à l'appli »)

> Afroeat est une plateforme de livraison pour commerces africains (Suisse et France).
> Un compte client de démonstration est fourni ci-dessous. Une commande payée par carte puis annulée
> avant sa préparation est remboursée automatiquement.

Avant l'envoi : créer un compte client de démonstration dédié (adresse e-mail réelle, mot de passe fort),
vérifier qu'au moins un commerce actif avec un menu est visible, et saisir ces identifiants **uniquement**
dans App Store Connect / Play Console (jamais dans une conversation ni dans ce dépôt).

## Visuels à fournir

- Icône 1024×1024 sans transparence (Apple) — `assets/images/icon.png` à vérifier ;
- iPhone 6,9" (1320×2868) : 3 à 10 captures ; iPad si `supportsTablet` reste activé ;
- Android : 2 à 8 captures téléphone + bannière 1024×500 ;
- écrans conseillés : accueil, page d'un commerce, panier, suivi de commande, carte des commerces.
