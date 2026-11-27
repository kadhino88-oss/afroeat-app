# Faire venir les restaurants partenaires d'AFROEAT

Les commerces affichés dans l'appli viennent d'OpenStreetMap ou d'une liste saisie à la main :
ce sont des **fiches d'annuaire**. On ne peut pas commander chez eux. Pour qu'un restaurant soit
commandable, il doit **s'inscrire comme partenaire**, être **validé**, puis **saisir lui-même** son
logo, ses plats, ses photos et ses prix. AFROEAT n'invente ni plat, ni photo, ni prix.

> État actuel : en production, la prise de commande reste volontairement verrouillée tant que les
> versements aux restaurants ne sont pas validés (voir `ENVIRONNEMENT_DE_TEST.md` de l'API).
> On peut donc dès maintenant inscrire et préparer les restaurants, sans encore ouvrir les commandes.

## 1. Message à envoyer (WhatsApp / SMS / e-mail)

> Bonjour {prénom},
>
> Je lance **AFROEAT**, une appli de livraison **100 % commerces africains** (restaurants, épiceries,
> boutiques) à Genève, Annemasse et Annecy. L'idée : que les commerces africains aient **leur propre
> service de livraison**, accessible à tous et **moins cher** que les grandes plateformes.
>
> Ton restaurant garde **son logo, ses plats, ses clients**. Aucun faux visuel : tu ajoutes toi-même
> tes photos et tes prix.
>
> Pour commencer (5 minutes) : {lien du site} → « Rejoindre AFROEAT ». Dis-moi quand c'est fait et je
> valide ton dossier.
>
> Merci ! {ton prénom}

## 2. Ce que le restaurant prépare

- Logo (image carrée) et, si possible, une photo de façade ou de salle ;
- pour chaque plat : **nom, prix, description, photo** (photos faites par le restaurant) ;
- horaires, adresse exacte, téléphone ;
- mentions utiles : halal, végétarien, végan.

## 3. Le parcours, étape par étape

1. **Demande** : sur le site, « Rejoindre AFROEAT » (nom du commerce, type, contact, adresse, ville,
   **pays France ou Suisse**, qui détermine la devise). Elle est enregistrée côté API (statuts : nouveau,
   contacté, approuvé, refusé) ; l'équipe reçoit un e-mail si `PARTNER_NOTIFY_EMAIL` et l'envoi d'e-mails
   sont configurés.
2. **Invitation** : dans l'espace admin, **Candidatures partenaires** → « Approuver et inviter ». Un lien à
   usage unique (7 jours) est généré, envoyé par e-mail si possible, et affiché une seule fois pour être
   copié. Le partenaire crée lui-même son compte et choisit son mot de passe. Les décisions sont
   inscrites au journal d'audit.
3. **Fiche masquée** : à la création du compte, la fiche restaurant existe mais est **masquée et fermée**.
   L'administrateur vérifie les pièces (Tableau de bord → « Vérification d'identité »), contrôle le pays et
   la devise (fiche du restaurant → « Pays et devise »), puis clique **« Rendre visible »**.
4. **Saisie du menu** : le restaurant se connecte, règle ses horaires, sa livraison (frais, minimum,
   **rayon de livraison**) et ajoute ses plats (Menu → Ajouter un plat). Il ne peut s'ouvrir aux commandes
   qu'avec une position sur la carte et au moins un plat disponible.
5. **Mise en ligne** : la fiche d'annuaire correspondante peut être retirée pour éviter un doublon.

## 4. Limites connues (à traiter)

- La prise de commande en production est verrouillée (`AFROEAT_LIVE_COMMERCE`, voir ci-dessus).
- Un partenaire créé par script ne peut pas recevoir de lien d'invitation : il passe par « Mot de passe
  oublié » (envoi d'e-mails requis).
- Les pièces justificatives ne se téléversent qu'en image (JPEG, PNG, WebP, 900 Ko maximum), pas en PDF.
- Tant que `STRIPE_CONNECT_PAYOUTS_ENABLED=false`, aucun partenaire n'est payé automatiquement.
