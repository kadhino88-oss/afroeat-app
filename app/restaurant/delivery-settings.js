import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';

import { useAuth } from '../../context/AuthContext';
import { Brand, BrandFonts } from '../../constants/brand';
import { getMyRestaurant, updateMyRestaurant } from '../../services/restaurantService';

const toAmount = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.').trim());
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1000 ? Math.round(parsed * 100) / 100 : null;
};

export default function RestaurantDeliverySettingsScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const token = auth.token;
  const [restaurant, setRestaurant] = useState(null);
  const [fee, setFee] = useState('');
  const [minimum, setMinimum] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const data = await getMyRestaurant(token);
          if (!active) return;
          setRestaurant(data);
          setFee(String(data?.deliveryFee ?? 0));
          setMinimum(String(data?.minimumOrderAmount ?? 0));
        } catch (error) {
          if (active) Alert.alert(t('common.error'), error?.message || '');
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [token, t])
  );

  const save = async () => {
    const deliveryFee = toAmount(fee);
    const minimumOrderAmount = toAmount(minimum);
    if (deliveryFee === null || minimumOrderAmount === null) {
      Alert.alert(t('common.error'), t('restaurant.deliverySettings.invalid'));
      return;
    }
    try {
      setSaving(true);
      const updated = await updateMyRestaurant(restaurant._id, { deliveryFee, minimumOrderAmount }, token);
      setRestaurant(updated);
      Alert.alert(t('restaurant.deliverySettings.title'), t('restaurant.deliverySettings.saved'));
    } catch (error) {
      Alert.alert(t('common.error'), error?.message || '');
    } finally {
      setSaving(false);
    }
  };

  // Sans position, le restaurant n'apparaît pas aux clients à proximité.
  const hasPosition = Number.isFinite(
    Number(restaurant?.latitude ?? restaurant?.location?.latitude ?? NaN)
  ) && (restaurant?.latitude ?? restaurant?.location?.latitude) !== null;

  const placeRestaurant = async (mode) => {
    try {
      setLocating(true);
      let payload = { locateFromAddress: true };
      if (mode === 'device') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error(t('restaurant.deliverySettings.locationDenied'));
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        payload = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      }
      const updated = await updateMyRestaurant(restaurant._id, payload, token);
      setRestaurant(updated);
      Alert.alert(t('restaurant.deliverySettings.positionTitle'), t('restaurant.deliverySettings.positionSaved'));
    } catch (error) {
      Alert.alert(t('common.error'), error?.message || '');
    } finally {
      setLocating(false);
    }
  };

  const currency = restaurant?.currency || 'CHF';

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/restaurant/restaurant-settings'))}
        style={styles.back}
      >
        <Ionicons name="arrow-back" size={21} color={Brand.foreground} />
      </Pressable>
      <Text style={styles.title}>{t('restaurant.deliverySettings.title')}</Text>
      <Text style={styles.subtitle}>{t('restaurant.deliverySettings.subtitle')}</Text>

      {loading ? (
        <ActivityIndicator color={Brand.primary} size="large" style={styles.loader} />
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>
            {t('restaurant.deliverySettings.fee')} ({currency})
          </Text>
          <TextInput value={fee} onChangeText={setFee} keyboardType="decimal-pad" style={styles.input} />
          <Text style={styles.label}>
            {t('restaurant.deliverySettings.minimum')} ({currency})
          </Text>
          <TextInput value={minimum} onChangeText={setMinimum} keyboardType="decimal-pad" style={styles.input} />
          <Pressable
            accessibilityRole="button"
            disabled={saving || !restaurant?._id}
            onPress={save}
            style={[styles.button, (saving || !restaurant?._id) && styles.buttonDisabled]}
          >
            {saving ? (
              <ActivityIndicator color={Brand.primaryForeground} />
            ) : (
              <Text style={styles.buttonText}>{t('restaurant.deliverySettings.save')}</Text>
            )}
          </Pressable>
        </View>
      )}

      {!loading && restaurant?._id ? (
        <View style={[styles.card, styles.cardSpaced]}>
          <Text style={styles.sectionTitle}>{t('restaurant.deliverySettings.positionTitle')}</Text>
          <Text style={[styles.status, hasPosition ? styles.statusOk : styles.statusMissing]}>
            {hasPosition
              ? t('restaurant.deliverySettings.positionSet')
              : t('restaurant.deliverySettings.positionMissing')}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={locating}
            onPress={() => placeRestaurant('address')}
            style={[styles.button, locating && styles.buttonDisabled]}
          >
            {locating ? (
              <ActivityIndicator color={Brand.primaryForeground} />
            ) : (
              <Text style={styles.buttonText}>{t('restaurant.deliverySettings.useAddress')}</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={locating}
            onPress={() => placeRestaurant('device')}
            style={[styles.buttonGhost, locating && styles.buttonDisabled]}
          >
            <Text style={styles.buttonGhostText}>{t('restaurant.deliverySettings.useDevice')}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.background },
  content: { padding: 20, paddingBottom: 60, maxWidth: 560, width: '100%', alignSelf: 'center' },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: Brand.card, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: Brand.border },
  title: { fontFamily: BrandFonts.display, fontSize: 28, color: Brand.foreground },
  subtitle: { color: Brand.mutedForeground, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 16 },
  loader: { marginTop: 40 },
  card: { backgroundColor: Brand.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: Brand.border },
  label: { color: Brand.foreground, fontWeight: '800', fontSize: 13, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Brand.border, borderRadius: 12, padding: 12, color: Brand.foreground, backgroundColor: '#FFFFFF' },
  button: { marginTop: 18, minHeight: 48, borderRadius: 14, backgroundColor: Brand.primary, justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: Brand.primaryForeground, fontWeight: '800', fontSize: 15 },
  cardSpaced: { marginTop: 16 },
  sectionTitle: { fontFamily: BrandFonts.displaySemi, fontSize: 18, color: Brand.foreground },
  status: { marginTop: 8, fontSize: 14, lineHeight: 20 },
  statusOk: { color: Brand.primary },
  statusMissing: { color: Brand.ember },
  buttonGhost: { marginTop: 10, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: Brand.primary, justifyContent: 'center', alignItems: 'center' },
  buttonGhostText: { color: Brand.primary, fontWeight: '800', fontSize: 15 },
});
