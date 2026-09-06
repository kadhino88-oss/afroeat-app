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
import { useTranslation } from 'react-i18next';
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
  const { t }       = useTranslation();
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
    if (role === 'restaurant') return t('profile.help.faqRestaurant', { returnObjects: true });
    if (role === 'livreur')    return t('profile.help.faqLivreur', { returnObjects: true });
    return t('profile.help.faqClient', { returnObjects: true });
  }, [role, t]);

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
      Alert.alert(t('profile.help.emailAlertTitle'), t('profile.help.emailAlertBody', { email: SUPPORT_EMAIL }));
    });
  }, []);

  const handleWhatsApp = useCallback(() => {
    const url = `whatsapp://send?phone=${SUPPORT_WHATSAPP.replace(/\D/g, '')}&text=Bonjour Afroeat Support,`;
    Linking.openURL(url).catch(() => {
      Alert.alert(t('profile.help.whatsappAlertTitle'), t('profile.help.whatsappAlertBody', { phone: SUPPORT_WHATSAPP }));
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert(t('profile.help.missingFieldsTitle'), t('profile.help.missingFieldsBody'));
      return;
    }
    if (message.trim().length < 20) {
      Alert.alert(t('profile.help.messageTooShortTitle'), t('profile.help.messageTooShortBody'));
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

  const categoriesTranslated = t('profile.help.categories', { returnObjects: true });
  const CATEGORIES = [
    { id: 'commande',   label: categoriesTranslated.commande   },
    { id: 'paiement',   label: categoriesTranslated.paiement   },
    { id: 'livraison',  label: categoriesTranslated.livraison  },
    { id: 'compte',     label: categoriesTranslated.compte     },
    { id: 'autre',      label: categoriesTranslated.autre      },
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
        <Text style={styles.topTitle}>{t('profile.help.topTitle')}</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Contact rapide ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.help.contactTitle')}</Text>
          <Text style={styles.sectionSub}>{t('profile.help.supportHours')}</Text>

          <View style={styles.contactRow}>
            <Pressable
              style={({ pressed }) => [styles.contactBtn, pressed && { opacity: 0.8 }]}
              onPress={handleEmail}
            >
              <View style={[styles.contactIcon, { backgroundColor: '#EEF4FF' }]}>
                <Ionicons name="mail-outline" size={22} color="#245EA8" />
              </View>
              <Text style={styles.contactLabel}>{t('profile.help.emailLabel')}</Text>
              <Text style={styles.contactSub}>{t('profile.help.emailSub')}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.contactBtn, pressed && { opacity: 0.8 }]}
              onPress={handleWhatsApp}
            >
              <View style={[styles.contactIcon, { backgroundColor: '#EDFAF1' }]}>
                <Ionicons name="logo-whatsapp" size={22} color="#1F6F43" />
              </View>
              <Text style={styles.contactLabel}>{t('profile.help.whatsappLabel')}</Text>
              <Text style={styles.contactSub}>{t('profile.help.whatsappSub')}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.contactBtn, pressed && { opacity: 0.8 }]}
              onPress={() => router.push('/auth/reset')}
            >
              <View style={[styles.contactIcon, { backgroundColor: '#FFF3D8' }]}>
                <Ionicons name="construct-outline" size={22} color="#8A6500" />
              </View>
              <Text style={styles.contactLabel}>{t('profile.help.diagnosticLabel')}</Text>
              <Text style={styles.contactSub}>{t('profile.help.diagnosticSub')}</Text>
            </Pressable>
          </View>
        </View>

        {/* ── FAQ ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.help.faqTitle')}</Text>
          <View style={styles.faqCard}>
            {faqs.map((item, i) => (
              <FaqItem key={i} item={item} isLast={i === faqs.length - 1} />
            ))}
          </View>
        </View>

        {/* ── Formulaire réclamation ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.help.claimTitle')}</Text>

          {sent ? (
            <View style={styles.sentBox}>
              <Ionicons name="checkmark-circle" size={40} color="#1F6F43" />
              <Text style={styles.sentTitle}>{t('profile.help.sentTitle')}</Text>
              <Text style={styles.sentText}>{t('profile.help.sentText')}</Text>
              <Pressable
                style={styles.sentBtn}
                onPress={() => setSent(false)}
              >
                <Text style={styles.sentBtnText}>{t('profile.help.sendAnother')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.formCard}>

              {/* Catégorie */}
              <Text style={styles.label}>{t('profile.help.categoryLabel')}</Text>
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
              <Text style={styles.label}>{t('profile.help.subjectLabel')}</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                placeholder={t('profile.help.subjectPlaceholder')}
                placeholderTextColor="#AAA"
                maxLength={100}
              />

              {/* Message */}
              <Text style={styles.label}>{t('profile.help.messageLabel')}</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={message}
                onChangeText={setMessage}
                placeholder={t('profile.help.messagePlaceholder')}
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
                  <Text style={styles.submitText}>{t('profile.help.sendingText')}</Text>
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#111" />
                    <Text style={styles.submitText}>{t('profile.help.submitButton')}</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Infos légales ── */}
        <View style={styles.legalRow}>
          <Text style={styles.legalText}>{t('profile.help.legalText')}</Text>
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
