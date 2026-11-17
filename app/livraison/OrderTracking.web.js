import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { router, useLocalSearchParams, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import DeliveryMap from '../../components/DeliveryMap';
import OrderChat from '../../components/OrderChat';
import AlcoholIdNotice from '../../components/AlcoholIdNotice';
import { useAuth } from '../../context/AuthContext';
import {
  getDeliveryOrderById,
  updateDeliveryStatus,
  updateDriverLocation,
  getNextDeliveryStatus,
  canDriverUpdateStatus,
  calculateDistanceKm,
  calculateETA,
} from '../../services/deliveryService';

/**
 * Suivi de livraison (web) — tableau de bord livreur : carte OpenStreetMap, itinéraire,
 * position GPS du navigateur, progression et changement de statut.
 */
const REFRESH_MS = 12000;
const GPS_PUSH_MS = 15000;
const STEPS = ['Confirmée', 'En préparation', 'En livraison', 'Livrée'];
const STATUS_KEY = {
  'En attente': 'order.status.pending',
  'Confirmée': 'livraison.status.confirmed',
  'En préparation': 'livraison.status.preparing',
  'En livraison': 'livraison.status.delivering',
  'Livrée': 'livraison.status.delivered',
  'Annulée': 'order.status.cancelled',
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const toPoint = (loc) => {
  if (!loc || typeof loc !== 'object') return null;
  if (Array.isArray(loc.coordinates)) {
    const lng = num(loc.coordinates[0]);
    const lat = num(loc.coordinates[1]);
    return lat !== null && lng !== null ? { lat, lng } : null;
  }
  const lat = num(loc.lat ?? loc.latitude);
  const lng = num(loc.lng ?? loc.longitude);
  return lat !== null && lng !== null ? { lat, lng } : null;
};
const unwrap = (data) => data?.order || data?.data?.order || data?.data || data;
const formatMoney = (value, currency) => {
  const amount = Number(value) || 0;
  return `${currency === 'CHF' ? 'CHF ' : ''}${amount.toFixed(2)}${currency === 'CHF' ? '' : ' €'}`;
};

export default function OrderTrackingWeb() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const { token, role, isAuthenticated, loading: authLoading } = useAuth() || {};
  const orderId = Array.isArray(params?.id) ? params.id[0] : params?.id || params?.orderId;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [myPosition, setMyPosition] = useState(null);
  const [route, setRoute] = useState(null);
  const lastPush = useRef(0);

  const load = useCallback(async () => {
    if (!orderId || !token) return;
    try {
      const data = unwrap(await getDeliveryOrderById(orderId, token));
      if (!data?._id && !data?.id) throw new Error(t('livraison.tracking.notFoundError'));
      setOrder(data);
      setError('');
    } catch (e) {
      setError(e?.message || t('livraison.tracking.errorFetchDefault'));
    } finally {
      setLoading(false);
    }
  }, [orderId, token, t]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  // Position GPS du navigateur, transmise au client toutes les 15 s.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return undefined;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyPosition(point);
        if (orderId && token && Date.now() - lastPush.current > GPS_PUSH_MS) {
          lastPush.current = Date.now();
          updateDriverLocation(orderId, point, token).catch(() => {});
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [orderId, token]);

  const driver = myPosition || toPoint(order?.driverLocation);
  const dropoff = toPoint(order?.customerLocation);
  const pickup = toPoint(order?.restaurant?.location) || toPoint(order?.restaurant) || toPoint(order?.restaurantLocation);
  const status = order?.status || 'En attente';
  const next = getNextDeliveryStatus(status);
  const canAdvance = next && canDriverUpdateStatus(status);
  const stepIndex = STEPS.indexOf(status);

  const distanceKm = route?.distanceKm ?? (driver && dropoff ? calculateDistanceKm(driver, dropoff) : null);
  const minutes = route?.minutes ?? (distanceKm !== null ? calculateETA(distanceKm) : null);

  const advance = useCallback(async () => {
    if (!next) return;
    setBusy(true);
    try {
      await updateDeliveryStatus(orderId, next, token);
      await load();
    } catch (e) {
      setError(e?.message || t('livraison.tracking.errorFetchDefault'));
    } finally {
      setBusy(false);
    }
  }, [next, orderId, token, load, t]);

  const openNavigation = useCallback(() => {
    if (!dropoff) return;
    const from = driver ? `${driver.lat},${driver.lng};` : '';
    Linking.openURL(
      `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${from}${dropoff.lat},${dropoff.lng}`
    );
  }, [driver, dropoff]);

  const labels = useMemo(
    () => ({ driver: t('livraison.trackingWeb.you'), pickup: t('livraison.tracking.restaurantLabel'), dropoff: t('livraison.trackingWeb.client'), recenter: t('livraison.tracking.recenterButton') }),
    [t]
  );

  if (authLoading) return <View style={styles.page}><ActivityIndicator color="#2CFFB0" /></View>;
  if (!isAuthenticated) return <Redirect href="/auth/login" />;
  if (role && !['livreur', 'driver', 'delivery', 'admin'].includes(String(role).toLowerCase())) {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.page}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" style={styles.back} onPress={() => router.replace('/livraison/orders')}>
          <Ionicons name="arrow-back" size={18} color="#9DFFD0" />
          <Text style={styles.backText}>{t('livraison.trackingWeb.backButton')}</Text>
        </Pressable>
        <Text style={styles.live}>● {t('livraison.tracking.panelTitle')}</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#2CFFB0" /><Text style={styles.muted}>{t('livraison.tracking.loadingTitle')}</Text></View>
      ) : !order ? (
        <View style={styles.center}>
          <Text style={styles.value}>{error || t('livraison.tracking.fallbackTitle')}</Text>
          <Pressable accessibilityRole="button" style={styles.cta} onPress={load}><Text style={styles.ctaText}>{t('livraison.tracking.retryButton')}</Text></Pressable>
        </View>
      ) : (
        <View style={styles.layout}>
          <ScrollView style={styles.panel} contentContainerStyle={{ gap: 14 }}>
            <AlcoholIdNotice order={order} />
            {orderId ? <OrderChat orderId={orderId} token={token} /> : null}
            <View style={styles.card}>
              <Text style={styles.kicker}>{t('livraison.tracking.restaurantLabel')}</Text>
              <Text style={styles.big}>{order.restaurantName || order.restaurant?.name || t('livraison.tracking.restaurantFallback')}</Text>
              <Text style={styles.statusPill}>{t(STATUS_KEY[status] || 'order.status.pending')}</Text>
            </View>

            <View style={styles.stats}>
              <View style={styles.stat}><Text style={styles.kicker}>{t('livraison.tracking.distanceLabel')}</Text><Text style={styles.statValue}>{distanceKm !== null ? `${distanceKm.toFixed(1)} km` : '—'}</Text></View>
              <View style={styles.stat}><Text style={styles.kicker}>{t('livraison.tracking.etaSmartLabel')}</Text><Text style={styles.statValue}>{minutes !== null ? `${Math.max(1, Math.round(minutes))} min` : t('livraison.tracking.etaUnavailable')}</Text></View>
              <View style={styles.stat}><Text style={styles.kicker}>{t('livraison.tracking.amountLabel')}</Text><Text style={styles.statValue}>{formatMoney(order.totalPrice, order.currency)}</Text></View>
            </View>

            <View style={styles.card}>
              <Text style={styles.kicker}>{t('livraison.tracking.progressLabel')}</Text>
              <View style={styles.steps}>
                {STEPS.map((step, index) => (
                  <View key={step} style={styles.step}>
                    <View style={[styles.dot, index <= stepIndex && styles.dotOn]} />
                    <Text style={[styles.stepText, index <= stepIndex && styles.stepTextOn]}>{t(STATUS_KEY[step])}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.kicker}>{t('livraison.tracking.destinationLabel')}</Text>
              <Text style={styles.value}>{order.deliveryAddress || t('livraison.tracking.addressUnavailable')}</Text>
              {!driver ? <Text style={styles.muted}>{t('livraison.tracking.gpsUnavailable')}</Text> : null}
            </View>

            {canAdvance ? (
              <Pressable accessibilityRole="button" disabled={busy} style={[styles.cta, busy && { opacity: 0.6 }]} onPress={advance}>
                <Text style={styles.ctaText}>{t('livraison.trackingWeb.advance', { status: t(STATUS_KEY[next]) })}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" disabled={!dropoff} style={[styles.ghost, !dropoff && { opacity: 0.4 }]} onPress={openNavigation}>
              <Ionicons name="navigate-outline" size={18} color="#9DFFD0" />
              <Text style={styles.ghostText}>{t('livraison.tracking.openGpsButton')}</Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.mapWrap}>
            <DeliveryMap driver={driver} pickup={pickup} dropoff={dropoff} labels={labels} onRoute={setRoute} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#050F0A', padding: 20, minHeight: 700, borderRadius: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { color: '#9DFFD0', fontWeight: '700' },
  live: { color: '#2CFFB0', fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  layout: { flex: 1, flexDirection: 'row', gap: 18, flexWrap: 'wrap', alignItems: 'stretch' },
  panel: { flexGrow: 0, flexBasis: 380, maxWidth: '100%', minWidth: 300 },
  mapWrap: { flex: 1, minWidth: 320, minHeight: 560 },
  card: { backgroundColor: 'rgba(14,40,28,.72)', borderColor: 'rgba(120,255,190,.2)', borderWidth: 1, borderRadius: 18, padding: 16, gap: 6 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: 'rgba(14,40,28,.72)', borderColor: 'rgba(120,255,190,.2)', borderWidth: 1, borderRadius: 16, padding: 12, gap: 4 },
  statValue: { color: '#E8FFF3', fontSize: 18, fontWeight: '900' },
  kicker: { color: '#6FBF98', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  big: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  value: { color: '#E8FFF3', fontSize: 15, lineHeight: 22 },
  muted: { color: '#7FAE96', fontSize: 13 },
  statusPill: { alignSelf: 'flex-start', marginTop: 6, color: '#06120C', backgroundColor: '#2CFFB0', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, fontWeight: '800', fontSize: 12, overflow: 'hidden' },
  steps: { gap: 10, marginTop: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#2F5A47' },
  dotOn: { backgroundColor: '#2CFFB0', borderColor: '#2CFFB0' },
  stepText: { color: '#6A8F7D', fontWeight: '600' },
  stepTextOn: { color: '#E8FFF3' },
  cta: { backgroundColor: '#2CFFB0', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#06120C', fontWeight: '900', fontSize: 15 },
  ghost: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', borderColor: 'rgba(120,255,190,.35)', borderWidth: 1, borderRadius: 14, paddingVertical: 13 },
  ghostText: { color: '#9DFFD0', fontWeight: '800' },
  error: { color: '#FF8A9B', fontSize: 13 },
});
