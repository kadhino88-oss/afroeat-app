import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Brand, BrandFonts } from '../constants/brand';
import { submitPartnerApplication } from '../services/partnerApplicationService';

const VEHICLES = ['Vélo', 'Vélo électrique', 'Scooter', 'Voiture', 'À pied'];

/**
 * Candidature livreur : l'équipe AFROEAT la vérifie, puis envoie un lien d'invitation
 * avec lequel le livreur crée lui-même son compte et son mot de passe.
 */
export default function CourierApplyScreen() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    zone: '',
    country: 'Suisse',
    vehicle: 'Vélo',
  });
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const setField = (key) => (value) => setForm((previous) => ({ ...previous, [key]: value }));

  const submit = async () => {
    if (sending) return;
    if (!consent) {
      Alert.alert('Accord requis', 'Coche la case pour accepter que l’équipe AFROEAT te contacte.');
      return;
    }
    try {
      setSending(true);
      await submitPartnerApplication({
        businessType: 'courier',
        businessName: form.name,
        contactName: form.name,
        email: form.email,
        phone: form.phone,
        address: form.zone || form.city,
        city: form.city,
        country: form.country,
        message: `Véhicule : ${form.vehicle}`,
        consent: true,
      });
      setSent(true);
    } catch (error) {
      Alert.alert('Envoi impossible', error?.message || 'Réessaie dans un instant.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/auth/role'))}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={21} color={Brand.foreground} />
        </Pressable>

        {sent ? (
          <View style={styles.card}>
            <Text style={styles.title}>Candidature envoyée</Text>
            <Text style={styles.text}>
              Merci ! L’équipe AFROEAT te contacte rapidement. Si ta candidature est acceptée, tu recevras un lien
              pour créer ton compte livreur et choisir ton mot de passe.
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.button}>
              <Text style={styles.buttonText}>Retour à l’accueil</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.title}>Devenir livreur</Text>
            <Text style={styles.text}>
              Livre les plats des restaurants et épiceries africains près de chez toi. Remplis ce formulaire : nous
              vérifions ta candidature puis nous t’envoyons ton lien d’inscription.
            </Text>

            <Text style={styles.label}>Nom et prénom</Text>
            <TextInput value={form.name} onChangeText={setField('name')} autoComplete="name" style={styles.input} />

            <Text style={styles.label}>Adresse e-mail</Text>
            <TextInput
              value={form.email}
              onChangeText={setField('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.input}
            />

            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              value={form.phone}
              onChangeText={setField('phone')}
              keyboardType="phone-pad"
              autoComplete="tel"
              style={styles.input}
            />

            <Text style={styles.label}>Ville</Text>
            <TextInput value={form.city} onChangeText={setField('city')} placeholder="Genève, Annemasse, Annecy…" placeholderTextColor={Brand.mutedForeground} style={styles.input} />

            <Text style={styles.label}>Quartiers où tu veux livrer</Text>
            <TextInput value={form.zone} onChangeText={setField('zone')} style={styles.input} />

            <Text style={styles.label}>Pays</Text>
            <View style={styles.chips}>
              {['Suisse', 'France'].map((country) => (
                <Pressable
                  key={country}
                  accessibilityRole="button"
                  accessibilityState={{ selected: form.country === country }}
                  onPress={() => setField('country')(country)}
                  style={[styles.chip, form.country === country && styles.chipActive]}
                >
                  <Text style={[styles.chipText, form.country === country && styles.chipTextActive]}>{country}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Moyen de transport</Text>
            <View style={styles.chips}>
              {VEHICLES.map((vehicle) => (
                <Pressable
                  key={vehicle}
                  accessibilityRole="button"
                  accessibilityState={{ selected: form.vehicle === vehicle }}
                  onPress={() => setField('vehicle')(vehicle)}
                  style={[styles.chip, form.vehicle === vehicle && styles.chipActive]}
                >
                  <Text style={[styles.chipText, form.vehicle === vehicle && styles.chipTextActive]}>{vehicle}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              onPress={() => setConsent((value) => !value)}
              style={styles.consent}
            >
              <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={22} color={Brand.primary} />
              <Text style={styles.consentText}>
                J’accepte que l’équipe AFROEAT me contacte au sujet de ma candidature.
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={sending}
              onPress={submit}
              style={[styles.button, sending && styles.buttonDisabled]}
            >
              {sending ? <ActivityIndicator color={Brand.primaryForeground} /> : <Text style={styles.buttonText}>Envoyer ma candidature</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.background },
  content: { padding: 20, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: Brand.card, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: Brand.border },
  card: { backgroundColor: Brand.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: Brand.border },
  title: { fontFamily: BrandFonts.display, fontSize: 26, color: Brand.foreground, marginBottom: 8 },
  text: { color: Brand.foreground, fontSize: 15, lineHeight: 22, marginBottom: 8 },
  label: { color: Brand.foreground, fontWeight: '800', fontSize: 13, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Brand.border, borderRadius: 12, padding: 12, color: Brand.foreground, backgroundColor: '#FFFFFF' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: Brand.muted, borderWidth: 1, borderColor: Brand.border },
  chipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipText: { color: Brand.mutedForeground, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: Brand.primaryForeground },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  consentText: { flex: 1, color: Brand.foreground, fontSize: 13, lineHeight: 19 },
  button: { marginTop: 18, minHeight: 48, borderRadius: 14, backgroundColor: Brand.primary, justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Brand.primaryForeground, fontWeight: '800', fontSize: 15 },
});
