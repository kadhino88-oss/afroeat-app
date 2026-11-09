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

1. **Demande** : sur le site, « Rejoindre AFROEAT » (nom du commerce, type, contact, adresse, ville).
   Elle est enregistrée côté API (statuts : nouveau, contacté, approuvé, refusé).
2. **Compte restaurant** : les comptes restaurant et livreur ne se créent pas librement. Le propriétaire
   d'AFROEAT choisit une des deux options :
   - activer l'inscription partenaire (variable `ALLOW_PARTNER_SELF_REGISTER=true` sur l'API) : le
     restaurant crée son compte lui-même, avec ses pièces ;
   - ou la laisser fermée et traiter les demandes une par une.
3. **Validation** : le compte reste « en attente » (écran « Dossier restaurant en attente ») jusqu'à
   ce que l'administrateur l'active dans l'espace admin (Restaurants / Utilisateurs).
4. **Saisie du menu** : une fois validé, le restaurant se connecte, renseigne son profil puis ajoute ses
   plats (Menu → Ajouter un plat).
5. **Mise en ligne** : le restaurant apparaît alors comme **partenaire** avec ses plats ; la fiche
   d'annuaire correspondante peut être retirée pour éviter un doublon.

## 4. Limites connues (à traiter)

- Aucune notification (e-mail) n'est envoyée quand une demande arrive : l'API les stocke seulement.
- Il n'existe pas encore d'écran admin pour lire les demandes (une route API les liste).
- La prise de commande en production est verrouillée (voir ci-dessus).
