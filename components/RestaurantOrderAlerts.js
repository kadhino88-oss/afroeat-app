import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../services/apiClient';
import { API_ENDPOINTS } from '../constants/api';
import {
  createNewIdsTracker,
  flashTabTitle,
  playAlertSound,
  requestBrowserNotifications,
  showBrowserNotification,
  stopTabTitle,
  unlockAlertSound,
} from '../services/orderAlerts';

const POLL_MS = 20000;
const RING_MS = 6000;
const NEW_STATUSES = ['En attente', 'Confirmée'];

const listOf = (response) => {
  const value = response?.orders || response?.data?.orders || response?.data || response;
  return Array.isArray(value) ? value : [];
};

/**
 * Alerte « nouvelle commande » sur tous les écrans du restaurant (comme la tablette Uber Eats) :
 * bandeau en haut, sonnerie répétée jusqu'à ouverture de la commande, notification du navigateur.
 */
export default function RestaurantOrderAlerts({ token }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState([]);
  const [soundReady, setSoundReady] = useState(Platform.OS !== 'web');
  const restaurantIdRef = useRef(null);
  const trackRef = useRef(createNewIdsTracker());

  const poll = useCallback(async () => {
    if (!token) return;
    try {
      if (!restaurantIdRef.current) {
        const mine = await apiGet(API_ENDPOINTS.restaurants.my, token);
        const r = mine?.restaurant || mine?.data || mine;
        restaurantIdRef.current = r?._id || r?.id || null;
        if (!restaurantIdRef.current) return;
      }
      const response = await apiGet(API_ENDPOINTS.orders.restaurantOrders(restaurantIdRef.current), token);
      const waiting = listOf(response).filter(
        // Seules les commandes payées sont à préparer : une commande carte non finalisée ne sonne pas.
        (order) => NEW_STATUSES.includes(order?.status) && (order?.paymentStatus === 'Payé' || order?.paymentMethod === 'cash')
      );
      const fresh = trackRef.current(waiting.map((o) => o._id));
      setPending(waiting);
      if (fresh.length) {
        const ref = String(fresh[0]).slice(-6).toUpperCase();
        showBrowserNotification(t('restaurant.alerts.newOrder'), `#${ref}`);
        flashTabTitle(`🔔 ${t('restaurant.alerts.newOrder')}`);
        playAlertSound();
      }
    } catch {
      // Réseau momentanément indisponible : nouvel essai au prochain passage.
    }
  }, [token, t]);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  // Sonnerie répétée tant qu'une nouvelle commande attend.
  useEffect(() => {
    if (!pending.length) {
      stopTabTitle();
      return undefined;
    }
    const timer = setInterval(playAlertSound, RING_MS);
    return () => clearInterval(timer);
  }, [pending.length]);

  const enableSound = () => {
    unlockAlertSound();
    requestBrowserNotifications();
    setSoundReady(true);
  };

  const openOrder = (order) => {
    unlockAlertSound();
    stopTabTitle();
    setPending((list) => list.filter((o) => o._id !== order._id));
    router.push(`/restaurant/restaurant-orders-details/${order._id}`);
  };

  if (!pending.length && soundReady) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {!soundReady ? (
        <Pressable accessibilityRole="button" style={[styles.banner, styles.soundBanner]} onPress={enableSound}>
          <Ionicons name="volume-high-outline" size={18} color="#0D1C11" />
          <Text style={styles.soundText}>{t('restaurant.alerts.enableSound')}</Text>
        </Pressable>
      ) : null}
      {pending.slice(0, 3).map((order) => (
        <Pressable key={order._id} accessibilityRole="button" style={styles.banner} onPress={() => openOrder(order)}>
          <Ionicons name="notifications" size={20} color="#FFFFFF" />
          <Text style={styles.text} numberOfLines={1}>
            {t('restaurant.alerts.newOrder')} · #{String(order._id).slice(-6).toUpperCase()}
          </Text>
          <Text style={styles.cta}>{t('restaurant.alerts.open')}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 12, left: 12, right: 12, zIndex: 1000, gap: 8, alignItems: 'center' },
  banner: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#C8331A',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  text: { flex: 1, color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  cta: { color: '#FFFFFF', fontWeight: '900', textDecorationLine: 'underline' },
  soundBanner: { backgroundColor: '#EAB02F' },
  soundText: { flex: 1, color: '#0D1C11', fontWeight: '800' },
});
