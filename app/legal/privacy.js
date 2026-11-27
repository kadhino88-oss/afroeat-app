import React from 'react';

import LegalPage from '../../components/LegalPage';

const SECTIONS = [
  {
    heading: 'Qui sommes-nous',
    body: [
      "AFROEAT est une application de livraison réservée aux restaurants, épiceries et commerces africains. Elle met en relation des clients, des commerces partenaires et des livreurs (zone pilote : Genève, Annemasse, Annecy).",
    ],
  },
  {
    heading: 'Données que nous collectons',
    body: [
      "Compte : nom, adresse e-mail, numéro de téléphone, mot de passe (stocké sous forme chiffrée, jamais en clair).",
      "Livraison : adresses de livraison que tu enregistres et, si tu l'autorises, ta position pour trouver les commerces proches.",
      "Position : avec ton autorisation, et uniquement pendant que tu utilises l'application, pour trouver les commerces proches et suivre ta livraison. Si tu es livreur, ta position est partagée avec AFROEAT, le commerce et le client pendant une course, afin de suivre la livraison ; elle n'est pas suivie en arrière-plan. Tu peux refuser ou retirer cette autorisation dans les réglages de ton téléphone.",
      "Notifications : si tu les acceptes, nous enregistrons un identifiant de notification de ton appareil (jeton) pour t'envoyer l'avancement de tes commandes ou de tes courses. Il transite par les services de notification d'Expo, d'Apple (APNs) et de Google (FCM). Tu peux les désactiver à tout moment dans les réglages de ton téléphone.",
      "Photos : uniquement celles que tu choisis toi-même dans ta galerie (profil, logo, plats, documents justificatifs). Nous n'accédons pas au reste de ta galerie et nous n'utilisons pas la caméra.",
      "Alcool : pour les commandes contenant de l'alcool, nous enregistrons ta confirmation d'avoir 18 ans ou plus ; une pièce d'identité peut être demandée à la livraison.",
      "Commandes : contenu, montant, statut et historique de tes commandes.",
      "Paiement : le paiement est traité par Stripe. Nous ne voyons ni ne stockons ton numéro de carte complet ; nous gardons uniquement une référence de moyen de paiement (marque et quatre derniers chiffres).",
    ],
  },
  {
    heading: 'Pièces justificatives des partenaires',
    body: [
      "Les livreurs et les commerçants envoient une pièce d'identité et, selon le cas, une autorisation de travail ou un extrait du registre du commerce. Nous les utilisons uniquement pour vérifier l'identité et le droit d'exercer, avec ton accord donné à l'envoi.",
      "Les fichiers sont chiffrés, ne sont visibles que de l'administration AFROEAT, et chaque consultation est enregistrée. Ils sont effacés automatiquement 90 jours après l'envoi sans décision, ou 30 jours après la décision. Seule la décision (date et résultat) est conservée.",
      "Tu peux retirer un document non validé à tout moment depuis l'application, ou demander l'effacement de ton dossier au support.",
    ],
  },
  {
    heading: "À quoi servent ces données",
    body: [
      "Créer et sécuriser ton compte, préparer et livrer tes commandes, traiter les paiements, te prévenir de l'avancement de ta commande et répondre à tes demandes d'aide.",
      "Nous ne vendons pas tes données et nous ne les utilisons pas pour de la publicité ciblée.",
    ],
  },
  {
    heading: 'Qui reçoit tes données',
    body: [
      "Le commerce reçoit ce qui est nécessaire pour préparer ta commande (nom, contenu, adresse de livraison, téléphone). Le livreur reçoit l'adresse et le téléphone pour livrer.",
      "Nos prestataires techniques : hébergement (Vercel), base de données (MongoDB Atlas), paiement (Stripe), cartes et adresses (OpenStreetMap ; Google Maps sur Android), notifications (Expo, Apple, Google), envoi d'e-mails. Ils n'agissent que pour notre compte.",
      "Certains de ces prestataires sont situés ou stockent des données hors de Suisse et de l'Union européenne (notamment aux États-Unis). Les transferts s'appuient sur les garanties prévues par la loi (clauses contractuelles types ou décision d'adéquation).",
    ],
  },
  {
    heading: 'Durée de conservation',
    body: [
      "Les données de ton compte sont conservées tant que ton compte existe. Les données de commande et de facturation sont conservées pendant la durée légale applicable, puis supprimées ou anonymisées.",
    ],
  },
  {
    heading: 'Tes droits',
    body: [
      "Tu peux accéder à tes données, les corriger, demander leur suppression ou t'opposer à leur traitement, conformément à la loi suisse sur la protection des données (nLPD) et au RGPD.",
      "Suppression du compte : dans l'application, ouvre Profil puis Confidentialité et suppression du compte. Tu peux aussi le faire depuis le site web. La suppression est définitive.",
      "Si tu estimes que tes droits ne sont pas respectés, tu peux t'adresser au Préposé fédéral à la protection des données et à la transparence (PFPDT, Suisse) ou à la CNIL (France).",
    ],
  },
  {
    heading: 'Sécurité',
    body: [
      "Les échanges sont chiffrés (HTTPS). L'accès aux données est limité aux personnes qui en ont besoin. Aucun système n'étant infaillible, nous te prévenons en cas d'incident te concernant.",
    ],
  },
  {
    heading: 'Modifications',
    body: [
      "Nous pouvons mettre cette politique à jour. La date de dernière mise à jour figure en haut de cette page.",
    ],
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      updated="27 novembre 2026"
      sections={SECTIONS}
    />
  );
}
