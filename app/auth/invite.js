import React, { useEffect, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';

import { Brand, BrandFonts } from '../../constants/brand';
import { getPartnerInvite, registerWithPartnerInvite } from '../../services/partnerApplicationService';

const PASSWORD_HELP =
  'Au moins 8 caractères, avec une majuscule, une minuscule, un chiffre et un caractère spécial.';

export default function PartnerInviteScreen() {
  const params = useLocalSearchParams();
  const inviteToken = String(params?.token || '').trim();

  const [state, setState] = useState('loading'); // loading | ready | error | done
  const [message, setMessage] = useState('');
  const [invite, setInvite] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    // Le chargement démarre dans un minuteur : aucune mise à jour d'état synchrone dans l'effet.
    const timer = setTimeout(async () => {
      if (!/^[a-f0-9]{64}$/.test(inviteToken)) {
        if (active) {
          setMessage("Ce lien d'invitation n'est pas valide.");
          setState('error');
        }
        return;
      }
      try {
        const result = await getPartnerInvite(inviteToken);
        if (!active) return;
        setInvite(result.invite);
        setName(result.invite?.contactName || '');
        setPhone(result.invite?.phone || '');
        setState('ready');
      } catch (error) {
        if (!active) return;
        setMessage(error?.message || "Ce lien d'invitation n'est pas valide.");
        setState('error');
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [inviteToken]);

  const submit = async () => {
    if (saving) return;
    if (password !== confirm) {
      Alert.alert('Mot de passe', 'Les deux mots de passe ne sont pas identiques.');
      return;
    }
    try {
      setSaving(true);
      await registerWithPartnerInvite(inviteToken, { name, phone, password });
      setPassword('');
      setConfirm('');
      setState('done');
    } catch (error) {
      Alert.alert('Création impossible', error?.message || 'Réessaie dans un instant.');
    } finally {
      setSaving(false);
    }
  };

  const goToLogin = () =>
    router.replace({ pathname: '/auth/login', params: { role: 'restaurant', email: invite?.email || '' } });

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>
          Afro<Text style={styles.brandAccent}>Eats</Text>
        </Text>

        {state === 'loading' ? <ActivityIndicator color={Brand.primary} size="large" style={styles.loader} /> : null}

        {state === 'error' ? (
          <View style={styles.card}>
            <Text style={styles.title}>Lien indisponible</Text>
            <Text style={styles.text}>{message}</Text>
          </View>
        ) : null}

        {state === 'done' ? (
          <View style={styles.card}>
            <Text style={styles.title}>Compte créé</Text>
            <Text style={styles.text}>
              Ton compte est prêt. Connecte-toi avec ton adresse e-mail et le mot de passe que tu viens de choisir.
            </Text>
            <Pressable accessibilityRole="button" onPress={goToLogin} style={styles.button}>
              <Text style={styles.buttonText}>Me connecter</Text>
            </Pressable>
          </View>
        ) : null}

        {state === 'ready' ? (
          <View style={styles.card}>
            <Text style={styles.title}>Bienvenue sur AfroEats</Text>
            <Text style={styles.text}>
              Ta candidature pour <Text style={styles.strong}>{invite?.businessName}</Text> est acceptée. Crée ton
              compte : tu choisis toi-même ton mot de passe, personne d&apos;autre ne le connaît.
            </Text>

            <Text style={styles.label}>Adresse e-mail (celle de ta candidature)</Text>
            <TextInput value={invite?.email || ''} editable={false} style={[styles.input, styles.inputLocked]} />

            <Text style={styles.label}>Ton nom</Text>
            <TextInput value={name} onChangeText={setName} autoComplete="name" style={styles.input} />

            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              style={styles.input}
            />

            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              style={styles.input}
            />
            <Text style={styles.help}>{PASSWORD_HELP}</Text>

            <Text style={styles.label}>Confirme le mot de passe</Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              style={styles.input}
            />

            <Pressable accessibilityRole="button" onPress={() => setShowPassword((value) => !value)}>
              <Text style={styles.link}>{showPassword ? 'Masquer' : 'Afficher'} les mots de passe</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={submit}
              style={[styles.button, saving && styles.buttonDisabled]}
            >
              {saving ? <ActivityIndicator color={Brand.primaryForeground} /> : <Text style={styles.buttonText}>Créer mon compte</Text>}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.background },
  content: { padding: 20, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' },
  brand: { fontFamily: BrandFonts.display, fontSize: 28, color: Brand.primary, marginBottom: 16 },
  brandAccent: { color: Brand.ember },
  loader: { marginTop: 40 },
  card: { backgroundColor: Brand.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: Brand.border },
  title: { fontFamily: BrandFonts.display, fontSize: 24, color: Brand.foreground, marginBottom: 8 },
  text: { color: Brand.foreground, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  strong: { fontWeight: '800' },
  label: { color: Brand.foreground, fontWeight: '800', fontSize: 13, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Brand.border, borderRadius: 12, padding: 12, color: Brand.foreground, backgroundColor: '#FFFFFF' },
  inputLocked: { backgroundColor: Brand.muted, color: Brand.mutedForeground },
  help: { color: Brand.mutedForeground, fontSize: 12, marginTop: 6 },
  link: { color: Brand.primary, fontWeight: '700', marginTop: 12 },
  button: { marginTop: 18, minHeight: 48, borderRadius: 14, backgroundColor: Brand.primary, justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Brand.primaryForeground, fontWeight: '800', fontSize: 15 },
});
