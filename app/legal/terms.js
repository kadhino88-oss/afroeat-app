import React from 'react';

import LegalPage from '../../components/LegalPage';

const SECTIONS = [
  {
    heading: 'Objet',
    body: [
      "AFROEAT est une plateforme qui permet de commander auprès de restaurants, épiceries et commerces africains et de se faire livrer. Les commerces partenaires sont responsables de leurs produits, de leurs prix et de leur disponibilité.",
    ],
  },
  {
    heading: 'Compte',
    body: [
      "Tu dois fournir des informations exactes et garder ton mot de passe confidentiel. Tu es responsable des commandes passées avec ton compte.",
    ],
  },
  {
    heading: 'Commandes et prix',
    body: [
      "Les prix affichés sont ceux du commerce, dans la devise indiquée (CHF ou EUR). Les frais de livraison et éventuels frais de service sont indiqués avant la validation. La commande est confirmée lorsque le commerce l'accepte.",
    ],
  },
  {
    heading: 'Paiement',
    body: [
      "Le paiement en ligne est traité par Stripe. Le montant est débité selon le mode de paiement choisi au moment de la commande.",
    ],
  },
  {
    heading: 'Livraison',
    body: [
      "Les délais indiqués sont des estimations. Tu dois être joignable à l'adresse de livraison. Une commande non réceptionnée par ta faute peut ne pas être remboursée.",
    ],
  },
  {
    heading: 'Annulation et réclamations',
    body: [
      "Tu peux demander l'annulation tant que le commerce n'a pas commencé la préparation. En cas de problème (article manquant, erreur, retard important), contacte-nous depuis la page Aide : nous examinons chaque demande avec le commerce.",
    ],
  },
  {
    heading: "Utilisation correcte",
    body: [
      "Il est interdit d'utiliser l'application pour fraude, usurpation d'identité ou atteinte à d'autres utilisateurs. Nous pouvons suspendre un compte en cas d'abus.",
    ],
  },
  {
    heading: 'Commerces partenaires',
    body: [
      "L'accès est réservé aux commerces africains. Chaque candidature est vérifiée avant activation. Les conditions commerciales (commission, versements) sont communiquées au commerce avant son activation.",
    ],
  },
  {
    heading: 'Droit applicable',
    body: [
      "Ces conditions sont régies par le droit suisse. En cas de litige, nous cherchons d'abord une solution à l'amiable.",
    ],
  },
];

export default function TermsScreen() {
  return (
    <LegalPage
      title="Conditions d'utilisation"
      updated="9 novembre 2026"
      sections={SECTIONS}
    />
  );
}
