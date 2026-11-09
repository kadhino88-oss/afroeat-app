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
      "Commandes : contenu, montant, statut et historique de tes commandes.",
      "Paiement : le paiement est traité par Stripe. Nous ne voyons ni ne stockons ton numéro de carte complet ; nous gardons uniquement une référence de moyen de paiement (marque et quatre derniers chiffres).",
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
      "Nos prestataires techniques : hébergement (Vercel), base de données (MongoDB Atlas), paiement (Stripe), cartes et adresses (OpenStreetMap). Ils n'agissent que pour notre compte.",
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
      updated="9 novembre 2026"
      sections={SECTIONS}
    />
  );
}
