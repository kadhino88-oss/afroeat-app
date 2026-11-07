/**
 * =========================================================
 * MES INFORMATIONS — AFROEAT
 * app/profile/info.js
 * Inclut : photo de profil, édition adresse, infos compte
 * =========================================================
 */

import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Image,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { apiPut, apiUpload } from '../../services/apiClient';
import { API_ENDPOINTS } from '../../constants/api';
import i18n from '../../i18n';

// ─── Helpers ──────────────────────────────────────────────
const normalizeText = (v, f = '') => String(v ?? '').trim() || f;

const normalizeRole = (role) => {
  const r = normalizeText(role, 'client').toLowerCase();
  if (r === 'restaurant' || r === 'resto') return 'restaurant';
  if (r === 'livreur' || r === 'driver' || r === 'delivery') return 'livreur';
  if (r === 'admin' || r === 'administrator' || r === 'superadmin') return 'admin';
  return 'client';
};

const getRoleRedirect = (role) => {
  if (role === 'restaurant') return '/restaurant/RestaurantDashboard';
  if (role === 'livreur')    return '/livraison';
  if (role === 'admin')      return '/admin';
  return null;
};

const getDisplayName = (user) =>
  normalizeText(user?.name) ||
  normalizeText(`${user?.firstName || ''} ${user?.lastName || ''}`.trim()) ||
  normalizeText(user?.prenom) ||
  i18n.t('profile.info.notProvided');

const getDisplayRole = (role) => {
  switch (normalizeRole(role)) {
    case 'restaurant': return i18n.t('profile.info.roleRestaurant');
    case 'livreur':    return i18n.t('profile.info.roleLivreur');
    case 'admin':      return i18n.t('profile.info.roleAdmin');
    default:           return i18n.t('profile.info.roleClient');
  }
};

// ─── Avatar Component ─────────────────────────────────────
const AvatarPicker = ({ user, onUploaded }) => {
  const { t } = useTranslation();
  const [loading,  setLoading]  = useState(false);
  const [localUri, setLocalUri] = useState(null);

  const avatarUri = localUri || normalizeText(user?.profileImage || user?.avatar || user?.image);
  const initials  = useMemo(() => {
    const hasName = Boolean(
      normalizeText(user?.name) ||
      normalizeText(`${user?.firstName || ''} ${user?.lastName || ''}`.trim()) ||
      normalizeText(user?.prenom)
    );
    if (!hasName) return '?';
    const name = getDisplayName(user);
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  }, [user]);

  const requestPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('profile.info.permissionRequiredTitle'),
        t('profile.info.permissionRequiredBody'),
        [
          { text: t('profile.info.cancel'), style: 'cancel' },
          { text: t('profile.info.settingsButton'), onPress: () => ImagePicker.requestMediaLibraryPermissionsAsync() },
        ]
      );
      return false;
    }
    return true;
  }, [t]);

  const uploadImage = useCallback(async (asset) => {
    setLoading(true);
    setLocalUri(asset.uri);
    try {
      const formData = new FormData();
      const filename = asset.uri.split('/').pop();
      const type     = asset.type === 'image' ? 'image/jpeg' : asset.mimeType || 'image/jpeg';

      formData.append('image', {
        uri:  Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
        type,
        name: filename,
      });

      const response = await apiUpload(API_ENDPOINTS.uploads.image, formData);
      const imageUrl = response?.url || response?.imageUrl || response?.data?.url || response?.image;

      if (imageUrl) {
        if (typeof onUploaded === 'function') onUploaded(imageUrl);
        Alert.alert(t('profile.info.photoUpdatedTitle'), t('profile.info.photoUpdatedBody'));
      } else {
        throw new Error(t('profile.info.missingImageUrlError'));
      }
    } catch (err) {
      setLocalUri(null);
      Alert.alert(
        t('profile.info.uploadErrorTitle'),
        err?.message || t('profile.info.uploadErrorFallback'),
      );
    } finally {
      setLoading(false);
    }
  }, [onUploaded, t]);

  const handlePickImage = useCallback(async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    Alert.alert(
      t('profile.info.photoSourceTitle'),
      t('profile.info.photoSourceMessage'),
      [
        {
          text: t('profile.info.takePhoto'),
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
            });
            if (!result.canceled && result.assets?.[0]) {
              uploadImage(result.assets[0]);
            }
          },
        },
        {
          text: t('profile.info.chooseGallery'),
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
            });
            if (!result.canceled && result.assets?.[0]) {
              uploadImage(result.assets[0]);
            }
          },
        },
        { text: t('profile.info.cancel'), style: 'cancel' },
      ]
    );
  }, [requestPermission, t, uploadImage]);

  return (
    <Pressable
      style={({ pressed }) => [styles.avatarWrap, pressed && { opacity: 0.85 }]}
      onPress={handlePickImage}
      disabled={loading}
    >
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
      )}
      <View style={styles.avatarBadge}>
        {loading
          ? <ActivityIndicator size="small" color="#FFF" />
          : <Ionicons name="camera" size={16} color="#FFF" />
        }
      </View>
    </Pressable>
  );
};

// ─── Screen ───────────────────────────────────────────────
export default function InfoScreen() {
  const { t, i18n: i18nInstance } = useTranslation();
  const auth        = useAuth() || {};
  const user        = auth.user ?? null;
  const token       = auth.token ?? null;
  const isAuth      = Boolean(auth.isAuthenticated);
  const loading     = Boolean(auth.loading);
  const updateUser  = auth.updateUser;
  const role        = normalizeRole(auth.role || user?.role);

  const [editingAddress, setEditingAddress] = useState(false);
  const [address,        setAddress]        = useState(
    normalizeText(user?.address || user?.deliveryAddress || user?.adresse)
  );
  const [savingAddress,  setSavingAddress]  = useState(false);

  const roleRedirect = getRoleRedirect(role);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) { router.back(); return; }
    router.replace('/(tabs)/profile');
  }, []);

  const handlePhotoUploaded = useCallback(async (imageUrl) => {
    try {
      await apiPut(API_ENDPOINTS.auth.updateProfile, { profileImage: imageUrl }, token);
      if (typeof updateUser === 'function') {
        updateUser({ ...user, profileImage: imageUrl });
      }
    } catch {
      // Photo sauvée localement même si update échoue
    }
  }, [token, user, updateUser]);

  const handleSaveAddress = useCallback(async () => {
    const trimmed = normalizeText(address);
    if (trimmed.length < 5) {
      Alert.alert(t('profile.info.addressInvalidTitle'), t('profile.info.addressInvalidBody'));
      return;
    }
    setSavingAddress(true);
    try {
      await apiPut(API_ENDPOINTS.auth.updateProfile, { address: trimmed }, token);
      if (typeof updateUser === 'function') {
        updateUser({ ...user, address: trimmed });
      }
      setEditingAddress(false);
      Alert.alert(t('profile.info.addressUpdatedTitle'), t('profile.info.addressUpdatedBody'));
    } catch (err) {
      Alert.alert(t('common.error'), err?.message || t('profile.info.addressSaveErrorFallback'));
    } finally {
      setSavingAddress(false);
    }
  }, [address, token, user, updateUser, t, setEditingAddress, setSavingAddress]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5EFE8" />
        <ActivityIndicator size="large" color="#D4A017" />
      </View>
    );
  }

  if (!isAuth) return <Redirect href="/auth/login?role=client" />;
  if (roleRedirect) return <Redirect href={roleRedirect} />;

  const DATE_LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-ES', it: 'it-IT', zh: 'zh-CN' };
  const dateLocale = DATE_LOCALE_MAP[i18nInstance.language] || 'en-US';

  const userInfo = [
    { key: 'name',   label: t('profile.info.fullNameLabel'),      value: getDisplayName(user),           icon: 'person-outline'   },
    { key: 'email',  label: t('auth.fields.email'),             value: normalizeText(user?.email, t('profile.info.notProvided')),  icon: 'mail-outline'     },
    { key: 'phone',  label: t('auth.fields.phone'),         value: normalizeText(user?.phone, t('profile.info.notProvided')),  icon: 'call-outline'     },
    { key: 'role',   label: t('profile.info.accountTypeLabel'),    value: getDisplayRole(user?.role),     icon: 'shield-outline'   },
    { key: 'since',  label: t('profile.info.memberSinceLabel'),     value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' }) : t('profile.info.notProvided'), icon: 'calendar-outline' },
  ];

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5EFE8" />

      <View style={styles.topRow}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          onPress={handleBack}
        >
          <Ionicons name="arrow-back" size={22} color="#111" />
        </Pressable>
        <Text style={styles.pageTitle}>{t('profile.info.pageTitle')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Avatar ── */}
        <View style={styles.avatarSection}>
          <AvatarPicker user={user} onUploaded={handlePhotoUploaded} />
          <Text style={styles.avatarName}>{getDisplayName(user)}</Text>
          <Text style={styles.avatarRole}>{getDisplayRole(user?.role)}</Text>
          <Text style={styles.avatarHint}>{t('profile.info.avatarHint')}</Text>
        </View>

        {/* ── Adresse (éditable) ── */}
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.iconWrap}>
              <Ionicons name="location-outline" size={20} color="#D96C2D" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>{t('profile.info.deliveryAddressLabel')}</Text>
              {editingAddress ? (
                <TextInput
                  style={styles.addressInput}
                  value={address}
                  onChangeText={setAddress}
                  placeholder={t('profile.info.addressPlaceholder')}
                  placeholderTextColor="#BBB"
                  multiline
                  autoFocus
                />
              ) : (
                <Text style={styles.cardValue}>
                  {normalizeText(
                    user?.address || user?.deliveryAddress || user?.adresse,
                    t('profile.info.addressNotProvided')
                  )}
                </Text>
              )}
            </View>
            {!editingAddress && (
              <Pressable
                style={styles.editBtn}
                onPress={() => { setEditingAddress(true); setAddress(normalizeText(user?.address || user?.deliveryAddress || user?.adresse)); }}
              >
                <Ionicons name="pencil" size={16} color="#D4A017" />
              </Pressable>
            )}
          </View>

          {editingAddress && (
            <View style={styles.editActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setEditingAddress(false)}
                disabled={savingAddress}
              >
                <Text style={styles.cancelBtnText}>{t('profile.info.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, savingAddress && { opacity: 0.6 }]}
                onPress={handleSaveAddress}
                disabled={savingAddress}
              >
                {savingAddress
                  ? <ActivityIndicator size="small" color="#111" />
                  : <Text style={styles.saveBtnText}>{t('profile.info.save')}</Text>}
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Infos fixes ── */}
        {userInfo.map((item) => (
          <View key={item.key} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.iconWrap}>
                <Ionicons name={item.icon} size={20} color="#111" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardLabel}>{item.label}</Text>
                <Text style={styles.cardValue}>{item.value}</Text>
              </View>
            </View>
          </View>
        ))}

        <Text style={styles.hint}>{t('profile.info.contactHint')}</Text>
      </ScrollView>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F5EFE8' },
  loader:          { flex: 1, backgroundColor: '#F5EFE8', justifyContent: 'center', alignItems: 'center' },
  topRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  backButton:      { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EDE5D8' },
  pageTitle:       { fontSize: 18, fontWeight: '900', color: '#111' },
  content:         { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 8 },

  avatarSection:   { alignItems: 'center', marginBottom: 24, paddingTop: 8 },
  avatarWrap:      { position: 'relative', marginBottom: 12 },
  avatar:          { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#D4A017' },
  avatarFallback:  { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFF3D8', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#D4A017' },
  avatarInitials:  { fontSize: 34, fontWeight: '900', color: '#D4A017' },
  avatarBadge:     { position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#F5EFE8' },
  avatarName:      { fontSize: 20, fontWeight: '900', color: '#111', marginBottom: 4 },
  avatarRole:      { fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 4 },
  avatarHint:      { fontSize: 12, color: '#BBB', fontWeight: '600' },

  card:            { backgroundColor: '#FFF', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#EDE5D8' },
  cardTop:         { flexDirection: 'row', alignItems: 'flex-start' },
  iconWrap:        { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF8F0', justifyContent: 'center', alignItems: 'center', marginRight: 12, flexShrink: 0 },
  cardContent:     { flex: 1 },
  cardLabel:       { fontSize: 12, fontWeight: '800', color: '#AAA', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  cardValue:       { fontSize: 15, fontWeight: '700', color: '#111', lineHeight: 20 },
  editBtn:         { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFF3D8', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1DFA6', marginLeft: 8 },
  addressInput:    { fontSize: 15, color: '#111', borderWidth: 1, borderColor: '#D4A017', borderRadius: 10, padding: 10, minHeight: 60, marginTop: 4, fontWeight: '600', lineHeight: 20 },
  editActions:     { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn:       { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#DDD', alignItems: 'center' },
  cancelBtnText:   { fontSize: 14, fontWeight: '700', color: '#888' },
  saveBtn:         { flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: '#D4A017', alignItems: 'center' },
  saveBtnText:     { fontSize: 14, fontWeight: '900', color: '#111' },

  hint:            { fontSize: 12, color: '#BBB', textAlign: 'center', lineHeight: 18, marginTop: 8, paddingHorizontal: 16 },
});
