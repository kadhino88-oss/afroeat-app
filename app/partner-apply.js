import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { submitPartnerApplication } from '../services/partnerApplicationService';

const firstParam = (value) => (Array.isArray(value) ? value[0] : value);
const text = (value) => String(firstParam(value) || '').trim();

const TYPES = ['restaurant', 'grocery', 'shop', 'drinks', 'other'];

const typeFromCategory = (category) => {
  if (category === 'african-grocery') return 'grocery';
  if (category === 'restaurant' || category === 'african-fast-food') return 'restaurant';
  return 'shop';
};

export default function PartnerApplyScreen() {
  const params = useLocalSearchParams();
  const { t } = useTranslation();

  const initial = useMemo(
    () => ({
      businessName: text(params.name),
      businessType: typeFromCategory(text(params.category)),
      address: text(params.address),
      city: text(params.city),
      phone: text(params.phone),
      website: text(params.website),
    }),
    [params]
  );

  const [form, setForm] = useState({
    ...initial,
    contactName: '',
    email: '',
    message: '',
    consent: false,
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const setField = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (sending) return;
    setError('');
    setSending(true);
    try {
      await submitPartnerApplication({
        ...form,
        osmPlaceId: text(params.id),
        company: '', // champ piège anti-robot : toujours vide pour un humain
      });
      setSent(true);
    } catch (submitError) {
      setError(submitError?.message || t('partnerApply.errorGeneric'));
    } finally {
      setSending(false);
    }
  };

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace('/(tabs)/explore');

  if (sent) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={38} color="#FFFFFF" />
        </View>
        <Text style={styles.successTitle}>{t('partnerApply.successTitle')}</Text>
        <Text style={styles.successText}>{t('partnerApply.successText')}</Text>
        <Pressable style={styles.submit} onPress={goBack} accessibilityRole="button">
          <Text style={styles.submitText}>{t('partnerApply.done')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#155B38" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Pressable style={styles.back} onPress={goBack} accessibilityRole="button">
            <Ionicons name="arrow-back" size={21} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title}>{t('partnerApply.title')}</Text>
          <Text style={styles.intro}>{t('partnerApply.intro')}</Text>
        </View>

        <View style={styles.benefits}>
          {['benefit1', 'benefit2', 'benefit3'].map((key) => (
            <View key={key} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={18} color="#1F6F43" />
              <Text style={styles.benefitText}>{t(`partnerApply.${key}`)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Field label={t('partnerApply.businessName')} value={form.businessName} onChangeText={setField('businessName')} />

          <Text style={styles.label}>{t('partnerApply.businessType')}</Text>
          <View style={styles.chips}>
            {TYPES.map((type) => (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityState={{ selected: form.businessType === type }}
                onPress={() => setField('businessType')(type)}
                style={[styles.chip, form.businessType === type && styles.chipActive]}
              >
                <Text style={[styles.chipText, form.businessType === type && styles.chipTextActive]}>
                  {t(`partnerApply.type_${type}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Field label={t('partnerApply.contactName')} value={form.contactName} onChangeText={setField('contactName')} autoComplete="name" />
          <Field label={t('partnerApply.email')} value={form.email} onChangeText={setField('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Field label={t('partnerApply.phone')} value={form.phone} onChangeText={setField('phone')} keyboardType="phone-pad" autoComplete="tel" />
          <Field label={t('partnerApply.address')} value={form.address} onChangeText={setField('address')} />
          <Field label={t('partnerApply.city')} value={form.city} onChangeText={setField('city')} />
          <Field label={t('partnerApply.website')} value={form.website} onChangeText={setField('website')} keyboardType="url" autoCapitalize="none" />
          <Field label={t('partnerApply.message')} value={form.message} onChangeText={setField('message')} multiline />

          <Pressable
            style={styles.consentRow}
            onPress={() => setField('consent')(!form.consent)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: form.consent }}
          >
            <Ionicons
              name={form.consent ? 'checkbox' : 'square-outline'}
              size={24}
              color={form.consent ? '#1F6F43' : '#867A6C'}
            />
            <Text style={styles.consentText}>{t('partnerApply.consent')}</Text>
          </Pressable>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.submit, sending && styles.submitDisabled]}
            onPress={submit}
            disabled={sending}
            accessibilityRole="button"
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>{t('partnerApply.submit')}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, multiline, ...inputProps }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholderTextColor="#A39A8E"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 28 },
  content: { paddingBottom: 40 },
  hero: { paddingTop: 64, paddingHorizontal: 24, paddingBottom: 26, backgroundColor: '#155B38' },
  back: { position: 'absolute', top: 46, left: 18, width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  title: { marginTop: 34, color: '#FFFFFF', fontSize: 27, fontWeight: '900' },
  intro: { marginTop: 10, color: '#DDEBE2', fontSize: 14, lineHeight: 21 },
  benefits: { margin: 16, padding: 16, borderRadius: 18, backgroundColor: '#F2F7F2', borderWidth: 1, borderColor: '#DCEBDD' },
  benefitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  benefitText: { marginLeft: 9, flex: 1, color: '#183B28', fontSize: 14, fontWeight: '700' },
  card: { marginHorizontal: 16, padding: 18, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0E6D9' },
  field: { marginBottom: 12 },
  label: { marginBottom: 6, color: '#867A6C', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#E7DDD0', paddingHorizontal: 13, color: '#24211E', fontSize: 15, backgroundColor: '#FFFDF9' },
  inputMultiline: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  chip: { marginRight: 8, marginBottom: 8, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16, borderWidth: 1, borderColor: '#E7DDD0', backgroundColor: '#FFFDF9' },
  chipActive: { backgroundColor: '#155B38', borderColor: '#155B38' },
  chipText: { color: '#4A443C', fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  consentRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  consentText: { flex: 1, marginLeft: 10, color: '#4A443C', fontSize: 13, lineHeight: 19 },
  error: { marginBottom: 10, color: '#B3261E', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  submit: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155B38', paddingHorizontal: 24, marginTop: 6 },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  successIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F6F43', marginBottom: 20 },
  successTitle: { color: '#171717', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  successText: { marginTop: 10, marginBottom: 24, color: '#5C675F', fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
