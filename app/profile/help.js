/**
 * =========================================================
 * AIDE & SUPPORT — AFROEAT
 * app/profile/help.js
 * =========================================================
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  TextInput,
  Alert,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const normalizeText = (v, f = '') => String(v ?? '').trim() || f;
const normalizeRole = (v) => {
  const r = normalizeText(v, 'client').toLowerCase();
  if (r === 'restaurant' || r === 'resto') return 'restaurant';
  if (r === 'livreur' || r === 'driver' || r === 'delivery') return 'livreur';
  if (r === 'admin' || r === 'administrator' || r === 'superadmin') return 'admin';
  return 'client';
};

// ─── CONTACT INFO ─────────────────────────────────────────
const SUPPORT_EMAIL   = 'support@afroeat.com';
const SUPPORT_WHATSAPP = '+33600000000';
const SUPPORT_HOURS   = 'Lun–Dim, 8h–22h';

// ─── FAQ DATA ─────────────────────────────────────────────
const FAQ_CLIENT = [
  {
    q: 'Comment passer une commande ?',
    a: 'Ouvre l\'onglet Explorer, choisis un restaurant, ajoute des plats au panier puis appuie sur "Commander". Assure-toi d\'avoir une adresse de livraison dans ton profil.',
  },
  {
    q: 'Je n\'ai pas reçu ma commande, que faire ?',
    a: 'Vérifie d\'abord le statut dans l\'onglet Commandes. Si la commande est marquée "livrée" mais que tu ne l\'as pas reçue, contacte le support immédiatement via ce formulaire.',
  },
  {
    q: 'Comment annuler une commande ?',
    a: 'L\'annulation est possible uniquement dans les 2 minutes suivant la commande, tant que le restaurant ne l\'a pas acceptée. Rends-toi dans Commandes → ta commande → Annuler.',
  },
  {
    q: 'Ma carte bancaire a été débitée mais la commande n\'apparaît pas ?',
    a: 'Le délai peut aller jusqu\'à 5 minutes. Si après 10 minutes la commande n\'apparaît toujours pas, contacte le support en indiquant le montant et l\'heure du débit.',
  },
  {
    q: 'Comment modifier mon adresse de livraison ?',
    a: 'Va dans Profil → Mes informations → Adresse. Tu peux modifier l\'adresse avant de passer commande. Les adresses ne peuvent pas être modifiées après validation.',
  },
  {
    q: 'Comment obtenir un remboursement ?',
    a: 'Les remboursements sont traités sous 3–5 jours ouvrés. Utilise le formulaire de réclamation ci-dessous en décrivant le problème. Un justificatif photo peut être demandé.',
  },
  {
    q: 'Les plats affichés sont-ils disponibles en temps réel ?',
    a: 'Oui, la disponibilité est mise à jour par le restaurant. Si un plat est marqué indisponible lors de ta commande, le restaurant te contactera pour proposer un remplacement.',
  },
  {
    q: 'Comment suivre ma livraison ?',
    a: 'Dans l\'onglet Commandes, appuie sur ta commande en cours pour voir le statut en temps réel et la position du livreur sur la carte.',
  },
];

const FAQ_RESTAURANT = [
  {
    q: 'Comment ajouter des plats à mon menu ?',
    a: 'Depuis ton Dashboard → Menu → Ajouter un plat. Tu peux renseigner le nom, la description, le prix, la catégorie et une photo.',
  },
  {
    q: 'Comment activer/désactiver mon restaurant ?',
    a: 'Dans Paramètres restaurant, le bouton "Ouvert/Fermé" change ton statut en temps réel. Les clients ne peuvent pas commander dans un restaurant fermé.',
  },
  {
    q: 'Comment voir mes statistiques ?',
    a: 'L\'onglet Analyses de ton dashboard affiche le chiffre d\'affaires, les commandes et les plats les plus vendus.',
  },
  {
    q: 'Comment recevoir mes paiements ?',
    a: 'Les paiements sont virés chaque semaine sur le compte bancaire renseigné lors de ton inscription. Vérifie tes informations dans Paramètres → Paiement.',
  },
];

const FAQ_LIVREUR = [
  {
    q: 'Comment démarrer une mission de livraison ?',
    a: 'Active ton statut "Disponible" dans ton dashboard livreur. Les commandes disponibles dans ta zone s\'afficheront automatiquement.',
  },
  {
    q: 'Comment déclarer un problème lors d\'une livraison ?',
    a: 'Sur la page de la mission active, appuie sur "Signaler un problème". Décris la situation — notre équipe te contactera rapidement.',
  },
  {
    q: 'Comment voir mes gains ?',
    a: 'Dashboard livreur → Onglet Gains. Les paiements sont effectués chaque semaine.',
  },
];

// ─── Composant FAQ Item ────────────────────────────────────
const FaqItem = ({ item, isLast }) => {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  }, []);

  return (
    <Pressable
      style={[styles.faqItem, !isLast && styles.faqBorder]}
      onPress={toggle}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQ}>{item.q}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#888"
        />
      </View>
      {open && <Text style={styles.faqA}>{item.a}</Text>}
    </Pressable>
  );
};

// ─── Screen ───────────────────────────────────────────────
export default function HelpScreen() {
  const auth        = useAuth() || {};
  const user        = auth.user ?? null;
  const role        = normalizeRole(auth.role || user?.role);
  const loading     = Boolean(auth.loading);
  const isAuth      = Boolean(auth.isAuthenticated);

  // Formulaire réclamation
  const [subject,  setSubject]  = useState('');
  const [message,  setMessage]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [category, setCategory] = useState('commande');

  const faqs = useMemo(() => {
    if (role === 'restaurant') return FAQ_RESTAURANT;
    if (role === 'livreur')    return FAQ_LIVREUR;
    return FAQ_CLIENT;
  }, [role]);

  if (loading) return null;

  // Redirect non-clients hors tabs
  const redirect = useMemo(() => {
    if (role === 'restaurant') return '/restaurant/RestaurantDashboard';
    if (role === 'livreur')    return '/livraison';
    if (role === 'admin')      return '/admin';
    return null;
  }, [role]);

  if (redirect) return <Redirect href={redirect} />;

  const handleEmail = useCallback(() => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Support Afroeat`).catch(() => {
      Alert.alert('Email', `Contacte-nous à : ${SUPPORT_EMAIL}`);
    });
  }, []);

  const handleWhatsApp = useCallback(() => {
    const url = `whatsapp://send?phone=${SUPPORT_WHATSAPP.replace(/\D/g, '')}&text=Bonjour Afroeat Support,`;
    Linking.openURL(url).catch(() => {
      Alert.alert('WhatsApp', `Contacte-nous sur WhatsApp : ${SUPPORT_WHATSAPP}`);
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Champs manquants', 'Remplis l\'objet et le message avant d\'envoyer.');
      return;
    }
    if (message.trim().length < 20) {
      Alert.alert('Message trop court', 'Décris ton problème en au moins 20 caractères.');
      return;
    }
    setSending(true);
    // Simule envoi (à brancher sur ton API)
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    setSent(true);
    setSubject('');
    setMessage('');
  }, [subject, message]);

  const CATEGORIES = [
    { id: 'commande',   label: '🛒 Commande'   },
    { id: 'paiement',   label: '💳 Paiement'   },
    { id: 'livraison',  label: '🚴 Livraison'  },
    { id: 'compte',     label: '👤 Compte'     },
    { id: 'autre',      label: '💬 Autre'      },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      {/* ── Header ── */}
      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#111" />
        </Pressable>
        <Text style={styles.topTitle}>Aide & Support</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Contact rapide ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nous contacter</Text>
          <Text style={styles.sectionSub}>{SUPPORT_HOURS}</Text>

          <View style={styles.contactRow}>
            <Pressable
              style={({ pressed }) => [styles.contactBtn, pressed && { opacity: 0.8 }]}
              onPress={handleEmail}
            >
              <View style={[styles.contactIcon, { backgroundColor: '#EEF4FF' }]}>
                <Ionicons name="mail-outline" size={22} color="#245EA8" />
              </View>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactSub}>24–48h</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.contactBtn, pressed && { opacity: 0.8 }]}
              onPress={handleWhatsApp}
            >
              <View style={[styles.contactIcon, { backgroundColor: '#EDFAF1' }]}>
                <Ionicons name="logo-whatsapp" size={22} color="#1F6F43" />
              </View>
              <Text style={styles.contactLabel}>WhatsApp</Text>
              <Text style={styles.contactSub}>Réponse rapide</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.contactBtn, pressed && { opacity: 0.8 }]}
              onPress={() => router.push('/auth/reset')}
            >
              <View style={[styles.contactIcon, { backgroundColor: '#FFF3D8' }]}>
                <Ionicons name="construct-outline" size={22} color="#8A6500" />
              </View>
              <Text style={styles.contactLabel}>Diagnostic</Text>
              <Text style={styles.contactSub}>Technique</Text>
            </Pressable>
          </View>
        </View>

        {/* ── FAQ ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Questions fréquentes</Text>
          <View style={styles.faqCard}>
            {faqs.map((item, i) => (
              <FaqItem key={i} item={item} isLast={i === faqs.length - 1} />
            ))}
          </View>
        </View>

        {/* ── Formulaire réclamation ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Réclamation ou signalement</Text>

          {sent ? (
            <View style={styles.sentBox}>
              <Ionicons name="checkmark-circle" size={40} color="#1F6F43" />
              <Text style={styles.sentTitle}>Message envoyé ✅</Text>
              <Text style={styles.sentText}>
                Notre équipe te répondra sous 24–48h à l\'adresse email de ton compte.
              </Text>
              <Pressable
                style={styles.sentBtn}
                onPress={() => setSent(false)}
              >
                <Text style={styles.sentBtnText}>Envoyer un autre message</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.formCard}>

              {/* Catégorie */}
              <Text style={styles.label}>Catégorie</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.catScroll}
              >
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[styles.catBtn, category === c.id && styles.catBtnActive]}
                    onPress={() => setCategory(c.id)}
                  >
                    <Text style={[styles.catText, category === c.id && styles.catTextActive]}>
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Objet */}
              <Text style={styles.label}>Objet</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="Ex: Commande non reçue le 22/04"
                placeholderTextColor="#AAA"
                maxLength={100}
              />

              {/* Message */}
              <Text style={styles.label}>Décris ton problème</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={message}
                onChangeText={setMessage}
                placeholder="Décris le problème en détail : date, montant, numéro de commande si disponible..."
                placeholderTextColor="#AAA"
                multiline
                textAlignVertical="top"
                maxLength={1000}
              />
              <Text style={styles.charCount}>{message.length}/1000</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  (sending || !subject.trim() || !message.trim()) && styles.submitDisabled,
                  pressed && styles.submitPressed,
                ]}
                onPress={handleSubmit}
                disabled={sending || !subject.trim() || !message.trim()}
              >
                {sending ? (
                  <Text style={styles.submitText}>Envoi en cours...</Text>
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#111" />
                    <Text style={styles.submitText}>Envoyer la réclamation</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Infos légales ── */}
        <View style={styles.legalRow}>
          <Text style={styles.legalText}>
            En nous contactant, tu acceptes que tes données soient traitées conformément à notre politique de confidentialité.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#FFF8F0' },
  topBar:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn:         { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EDE5D8' },
  topTitle:        { fontSize: 18, fontWeight: '900', color: '#111' },
  content:         { padding: 16, paddingBottom: 48 },
  section:         { marginBottom: 24 },
  sectionTitle:    { fontSize: 18, fontWeight: '900', color: '#111', marginBottom: 4 },
  sectionSub:      { fontSize: 13, color: '#888', marginBottom: 14, fontWeight: '600' },

  contactRow:      { flexDirection: 'row', gap: 10 },
  contactBtn:      { flex: 1, backgroundColor: '#FFF', borderRadius: 18, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#F2E9DD' },
  contactIcon:     { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  contactLabel:    { fontSize: 13, fontWeight: '900', color: '#111', marginBottom: 2 },
  contactSub:      { fontSize: 11, color: '#888', fontWeight: '600' },

  faqCard:         { backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: '#F2E9DD', overflow: 'hidden' },
  faqItem:         { padding: 16 },
  faqBorder:       { borderBottomWidth: 1, borderBottomColor: '#F2E9DD' },
  faqHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  faqQ:            { fontSize: 14, fontWeight: '800', color: '#111', flex: 1, lineHeight: 20 },
  faqA:            { fontSize: 13, color: '#555', lineHeight: 20, marginTop: 10, fontWeight: '500' },

  formCard:        { backgroundColor: '#FFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#F2E9DD' },
  label:           { fontSize: 13, fontWeight: '800', color: '#333', marginBottom: 8, marginTop: 12 },
  catScroll:       { marginBottom: 4 },
  catBtn:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0E9DF', marginRight: 8, borderWidth: 1, borderColor: '#E8DDD0' },
  catBtnActive:    { backgroundColor: '#111', borderColor: '#111' },
  catText:         { fontSize: 13, fontWeight: '700', color: '#777' },
  catTextActive:   { color: '#FFF' },
  input:           { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#ECE7DF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: '#111', marginBottom: 4 },
  textarea:        { minHeight: 110, paddingTop: 12 },
  charCount:       { fontSize: 11, color: '#BBB', textAlign: 'right', marginBottom: 8, fontWeight: '600' },
  submitBtn:       { backgroundColor: '#D4A017', borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  submitDisabled:  { opacity: 0.5 },
  submitPressed:   { opacity: 0.85 },
  submitText:      { fontSize: 15, fontWeight: '900', color: '#111' },

  sentBox:         { backgroundColor: '#FFF', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#C8EDD8' },
  sentTitle:       { fontSize: 18, fontWeight: '900', color: '#1F6F43', marginTop: 12, marginBottom: 8 },
  sentText:        { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20 },
  sentBtn:         { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F0E9DF' },
  sentBtnText:     { fontSize: 13, fontWeight: '800', color: '#555' },

  legalRow:        { padding: 12, alignItems: 'center' },
  legalText:       { fontSize: 11, color: '#BBB', textAlign: 'center', lineHeight: 16 },
});
