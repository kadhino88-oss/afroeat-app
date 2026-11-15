import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Switch } from 'react-native';
import { router, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import DeliveryMap from '../../components/DeliveryMap';
import { useAuth } from '../../context/AuthContext';
import {
  getAssignedOrders,
  getMyDeliveryProfile,
  getMyDeliveryEarnings,
  setMyAvailability,
  updateDeliveryStatus,
  updateDriverLocation,
  getNextDeliveryStatus,
  getDeliveryStats,
} from '../../services/deliveryService';

/**
 * Accueil livreur (web) — centre de contrôle : indicateurs, disponibilité, mission en cours
 * sur carte OpenStreetMap et liste des missions.
 */
const REFRESH_MS = 12000;
const GPS_PUSH_MS = 15000;
const STATUS_KEY = {
  'En attente': 'order.status.pending',
  'Confirmée': 'livraison.status.confirmed',
  'En préparation': 'livraison.status.preparing',
  'En livraison': 'livraison.status.delivering',
  'Livrée': 'livraison.status.delivered',
  'Annulée': 'order.status.cancelled',
};
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const point = (loc) => {
  if (!loc || typeof loc !== 'object') return null;
  const lat = num(loc.lat ?? loc.latitude ?? loc.coordinates?.[1]);
  const lng = num(loc.lng ?? loc.longitude ?? loc.coordinates?.[0]);
  return lat !== null && lng !== null ? { lat, lng } : null;
};
const money = (value, currency = 'EUR') => {
  try {
    return new Intl.NumberFormat('fr', { style: 'currency', currency }).format(Number(value) || 0);
  } catch {
    return `${(Number(value) || 0).toFixed(2)} ${currency}`;
  }
};

export default function CourierDashboardWeb() {
  const { t } = useTranslation();
  const { token, user, role, isAuthenticated, loading: authLoading } = useAuth() || {};
  const currentRole = String(role || user?.role || '').toLowerCase();
  const isDriver = ['livreur', 'driver', 'delivery'].includes(currentRole);

  const [orders, setOrders] = useState([]);
  const [online, setOnline] = useState(false);
  const [verified, setVerified] = useState(null);
  const [earnings, setEarnings] = useState({ total: 0, currency: 'EUR' });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [myPosition, setMyPosition] = useState(null);
  const lastPush = React.useRef(0);

  const load = useCallback(async () => {
    if (!token || !isDriver) return;
    const [list, profile, gains] = await Promise.all([
      getAssignedOrders(token).catch(() => null),
      getMyDeliveryProfile(token).catch(() => null),
      getMyDeliveryEarnings(token).catch(() => null),
    ]);
    if (Array.isArray(list)) setOrders(list);
    if (profile) {
      setOnline(Boolean(profile.isAvailable));
      setVerified(Boolean(profile.isIdentityVerified) && profile.isWorkAuthorized !== false);
    }
    if (gains) setEarnings(gains);
    setLoading(false);
  }, [token, isDriver]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const active = useMemo(() => orders.find((o) => o.status === 'En livraison') || null, [orders]);
  const stats = useMemo(() => getDeliveryStats(orders), [orders]);

  useEffect(() => {
    if (!active?._id || typeof navigator === 'undefined' || !navigator.geolocation) return undefined;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyPosition(p);
        if (Date.now() - lastPush.current > GPS_PUSH_MS) {
          lastPush.current = Date.now();
          updateDriverLocation(active._id, p, token).catch(() => {});
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [active?._id, token]);

  const toggle = useCallback(
    async (value) => {
      setOnline(value);
      try {
        setOnline(await setMyAvailability(value, token));
      } catch {
        setOnline(!value);
      }
    },
    [token]
  );

  const advance = useCallback(
    async (order) => {
      const next = getNextDeliveryStatus(order.status);
      if (!next) return;
      setBusyId(order._id);
      try {
        await updateDeliveryStatus(order._id, next, token);
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [token, load]
  );

  const labels = useMemo(
    () => ({ driver: t('livraison.trackingWeb.you'), dropoff: t('livraison.trackingWeb.client'), recenter: t('livraison.tracking.recenterButton') }),
    [t]
  );

  if (authLoading) return <View style={styles.page}><ActivityIndicator color="#2CFFB0" /></View>;
  if (!isAuthenticated) return <Redirect href="/auth/login?role=livreur" />;
  if (!isDriver) return <Redirect href={currentRole === 'admin' ? '/admin' : currentRole === 'restaurant' ? '/restaurant/RestaurantDashboard' : '/'} />;
  if (String(user?.status || user?.approvalStatus || '').toLowerCase() === 'pending') {
    return <Redirect href="/auth/pending-approval?role=livreur" />;
  }

  const open = orders.filter((o) => !['Livrée', 'Annulée'].includes(o.status));

  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <View>
          <Text style={styles.kicker}>{t('livraison.tracking.panelTitle')}</Text>
          <Text style={styles.title}>{user?.name || t('livraison.profile.defaultName')}</Text>
        </View>
        <View style={styles.availability}>
          <Text style={[styles.status, online && { color: '#2CFFB0' }]}>
            ● {online ? t('livraison.profile.onlineStatus') : t('livraison.profile.offlineStatus')}
          </Text>
          <Switch value={online} onValueChange={toggle} disabled={verified === false} trackColor={{ true: '#2CFFB0', false: '#2F5A47' }} />
        </View>
      </View>

      {verified === false ? (
        <Pressable accessibilityRole="button" style={styles.alert} onPress={() => router.push('/account/verification')}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#FFB020" />
          <Text style={styles.alertText}>{t('livraison.profile.verificationTitle')} — {t('livraison.profile.verificationNext')}</Text>
        </Pressable>
      ) : null}

      <View style={styles.kpis}>
        <View style={styles.kpi}><Text style={styles.kicker}>{t('livraison.dashboard.revenue')}</Text><Text style={styles.kpiValue}>{money(earnings.total, earnings.currency)}</Text></View>
        <View style={styles.kpi}><Text style={styles.kicker}>{t('livraison.dashboard.active')}</Text><Text style={styles.kpiValue}>{open.length}</Text></View>
        <View style={styles.kpi}><Text style={styles.kicker}>{t(STATUS_KEY['Livrée'])}</Text><Text style={styles.kpiValue}>{stats.delivered}</Text></View>
        <View style={styles.kpi}><Text style={styles.kicker}>{t(STATUS_KEY['En livraison'])}</Text><Text style={styles.kpiValue}>{stats.delivering}</Text></View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2CFFB0" style={{ marginTop: 40 }} />
      ) : (
        <View style={styles.grid}>
          <View style={styles.mapWrap}>
            <DeliveryMap
              driver={myPosition || point(active?.driverLocation)}
              dropoff={point(active?.customerLocation)}
              labels={labels}
            />
          </View>
          <ScrollView style={styles.list} contentContainerStyle={{ gap: 12 }}>
            {open.length === 0 ? (
              <View style={styles.card}><Text style={styles.muted}>{t('livraison.dashboard.empty')}</Text></View>
            ) : (
              open.map((order) => {
                const next = getNextDeliveryStatus(order.status);
                return (
                  <View key={order._id} style={styles.card}>
                    <Pressable accessibilityRole="button" onPress={() => router.push(`/livraison/OrderTracking?id=${order._id}`)}>
                      <Text style={styles.cardTitle}>{order.restaurantName || order.restaurant?.name || 'AFROEAT'}</Text>
                      <Text style={styles.muted} numberOfLines={2}>{order.deliveryAddress}</Text>
                      <View style={styles.row}>
                        <Text style={styles.pill}>{t(STATUS_KEY[order.status] || 'order.status.pending')}</Text>
                        <Text style={styles.price}>{money(order.totalPrice, order.currency)}</Text>
                      </View>
                    </Pressable>
                    {next ? (
                      <Pressable accessibilityRole="button" disabled={busyId === order._id} style={[styles.cta, busyId === order._id && { opacity: 0.6 }]} onPress={() => advance(order)}>
                        <Text style={styles.ctaText}>{t('livraison.trackingWeb.advance', { status: t(STATUS_KEY[next]) })}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#050F0A', padding: 22, minHeight: 700, borderRadius: 24, gap: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  kicker: { color: '#6FBF98', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  availability: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  status: { color: '#7FAE96', fontWeight: '800' },
  alert: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,176,32,.5)', backgroundColor: 'rgba(255,176,32,.08)' },
  alertText: { color: '#FFD58A', flex: 1, lineHeight: 20 },
  kpis: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  kpi: { flexGrow: 1, flexBasis: 160, backgroundColor: 'rgba(14,40,28,.72)', borderColor: 'rgba(120,255,190,.2)', borderWidth: 1, borderRadius: 16, padding: 16, gap: 6 },
  kpiValue: { color: '#E8FFF3', fontSize: 26, fontWeight: '900' },
  grid: { flex: 1, flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  mapWrap: { flex: 2, minWidth: 340, minHeight: 440 },
  list: { flex: 1, minWidth: 300, maxHeight: 560 },
  card: { backgroundColor: 'rgba(14,40,28,.72)', borderColor: 'rgba(120,255,190,.2)', borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  cardTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  muted: { color: '#7FAE96', fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  pill: { color: '#06120C', backgroundColor: '#2CFFB0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, fontWeight: '800', fontSize: 12, overflow: 'hidden' },
  price: { color: '#E8FFF3', fontWeight: '900' },
  cta: { backgroundColor: '#2CFFB0', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  ctaText: { color: '#06120C', fontWeight: '900' },
});
