import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { API_BASE_URL, API_ENDPOINTS } from '../../constants/api';
import { useAuth } from '../../context/AuthContext';
import { deleteMyAccount } from '../../services/userService';

export default function AccountPrivacyScreen() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (auth.loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#C8331A" />
      </View>
    );
  }

  if (!auth.isAuthenticated || !auth.token) {
    return <Redirect href="/auth/role" />;
  }

  const openWebDeletionPage = async () => {
    const url = `${API_BASE_URL}${API_ENDPOINTS.auth.accountDeletionPage}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('common.error'), t('profile.home.deleteAccountTryAgain'));
    }
  };

  const submitDeletion = async () => {
    if (!password) {
      Alert.alert(t('common.error'), t('profile.home.deleteAccountPasswordError'));
      return;
    }

    try {
      setDeleting(true);
      await deleteMyAccount(password, auth.token);
      setPassword('');
      await auth.clearAllLocalAppData();
      router.replace('/(tabs)');
    } catch (error) {
      const message =
        error?.data?.code === 'ACCOUNT_HAS_ACTIVE_ORDERS'
          ? t('profile.home.deleteAccountActiveOrders')
          : error?.status === 401
            ? t('profile.home.deleteAccountPasswordError')
            : error?.message || t('profile.home.deleteAccountTryAgain');
      Alert.alert(t('profile.home.deleteAccountErrorTitle'), message);
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeletion = () => {
    Alert.alert(
      t('profile.home.deleteAccountConfirmTitle'),
      t('profile.home.deleteAccountConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.home.deleteAccountConfirmButton'),
          style: 'destructive',
          onPress: submitDeletion,
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Ionicons name="arrow-back" size={21} color="#0D1C11" />
      </Pressable>

      <Text style={styles.eyebrow}>AFROEAT</Text>
      <Text style={styles.title}>{t('profile.home.deleteAccountTitle')}</Text>
      <Text style={styles.body}>{t('profile.home.deleteAccountIntro')}</Text>

      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={21} color="#301904" />
        <Text style={styles.noticeText}>{t('profile.home.deleteAccountRetention')}</Text>
      </View>

      <Text style={styles.sectionTitle}>{t('profile.home.deleteAccountTitle')}</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        editable={!deleting}
        placeholder={t('profile.home.deleteAccountPasswordPlaceholder')}
        placeholderTextColor="#606D5D"
        accessibilityLabel={t('profile.home.deleteAccountPasswordLabel')}
        style={styles.input}
      />

      <Pressable
        accessibilityRole="button"
        disabled={deleting}
        onPress={confirmDeletion}
        style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed, deleting && styles.disabled]}
      >
        {deleting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
        )}
        <Text style={styles.deleteButtonText}>{t('profile.home.deleteAccountButton')}</Text>
      </Pressable>

      <View style={styles.webCard}>
        <Text style={styles.webTitle}>{t('profile.home.deleteAccountWebTitle')}</Text>
        <Text style={styles.body}>{t('profile.home.deleteAccountWebText')}</Text>
        <Pressable
          accessibilityRole="link"
          onPress={openWebDeletionPage}
          style={({ pressed }) => [styles.webButton, pressed && styles.pressed]}
        >
          <Text style={styles.webButtonText}>{t('profile.home.deleteAccountWebButton')}</Text>
          <Ionicons name="open-outline" size={18} color="#084424" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBF6EC' },
  content: { padding: 20, paddingBottom: 48 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backButton: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    marginBottom: 18, borderRadius: 22, backgroundColor: '#FFFFFF',
  },
  eyebrow: { color: '#084424', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 6, color: '#0D1C11', fontSize: 26, fontWeight: '900' },
  body: { marginTop: 10, color: '#606D5D', fontSize: 14, lineHeight: 21 },
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 20,
    padding: 14, borderRadius: 14, backgroundColor: '#F3E7CA',
  },
  noticeText: { flex: 1, color: '#301904', fontSize: 13, lineHeight: 19 },
  sectionTitle: { marginTop: 24, marginBottom: 9, color: '#0D1C11', fontSize: 15, fontWeight: '800' },
  input: {
    minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: '#E3DECF',
    borderRadius: 12, backgroundColor: '#FFFFFF', color: '#0D1C11', fontSize: 15,
  },
  deleteButton: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 9, marginTop: 14, borderRadius: 13, backgroundColor: '#C8331A',
  },
  deleteButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.7 },
  pressed: { opacity: 0.78 },
  webCard: { marginTop: 24, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF' },
  webTitle: { color: '#0D1C11', fontSize: 15, fontWeight: '800' },
  webButton: {
    minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F2ECE0',
  },
  webButtonText: { color: '#084424', fontSize: 14, fontWeight: '800' },
});
