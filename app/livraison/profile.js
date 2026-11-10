import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  StatusBar,
  Switch,
  Alert,
} from 'react-native';
import { router, useFocusEffect, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import FadeInView from '../../components/FadeInView';
import AccountPrivacyLink from '../../components/AccountPrivacyLink';
import { useAuth } from '../../context/AuthContext';
import {
  getAssignedOrders,
  getMyDeliveryProfile,
  setMyAvailability,
} from '../../services/deliveryService';

/**
 * HELPERS
 */

const normalizeRole = (v) => String(v || '').trim().toLowerCase();
const isDriver = (r) =>
  r === 'livreur' || r === 'driver' || r === 'delivery';

const normalizeNumber = (v, f = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : f;
};

const normalizeArray = (v) => (Array.isArray(v) ? v : []);

const formatPrice = (v) => `${normalizeNumber(v).toFixed(2)} €`;

/**
 * SCREEN
 */

export default function LivraisonProfileScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};

  const user = auth.user ?? null;
  const role = auth.role;
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);

  const currentRole = useMemo(
    () => normalizeRole(role || user?.role),
    [role, user]
  );

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  // État réel enregistré sur le serveur (et non un simple interrupteur local).
  const [online, setOnline] = useState(false);
  const [savingOnline, setSavingOnline] = useState(false);

  /**
   * FETCH GLOBAL DRIVER DATA
   */

  const fetchData = useCallback(async () => {
    if (!token || !isDriver(currentRole)) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [data, profile] = await Promise.all([
        getAssignedOrders(token),
        getMyDeliveryProfile(token).catch(() => null),
      ]);

      setOrders(normalizeArray(data));
      if (profile) setOnline(Boolean(profile.isAvailable));
    } catch (e) {
      console.log(e);
      Alert.alert(t('common.error'), t('livraison.profile.errorLoadBody'));
    } finally {
      setLoading(false);
    }
  }, [token, currentRole, t]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  /**
   * STATS
   */

  const stats = useMemo(() => {
    const delivered = orders.filter((o) => o?.status === 'Livrée');

    const revenue = delivered.reduce(
      (s, o) => s + normalizeNumber(o?.totalPrice),
      0
    );

    const active = orders.filter(
      (o) => o?.status !== 'Livrée'
    ).length;

    return {
      total: delivered.length,
      revenue,
      active,
    };
  }, [orders]);

  /**
   * ACTIONS
   */

  const toggleOnline = async () => {
    if (savingOnline) return;
    const next = !online;
    try {
      setSavingOnline(true);
      const saved = await setMyAvailability(next, token);
      setOnline(saved);
      Alert.alert(
        t('livraison.profile.statusTitle'),
        saved ? t('livraison.profile.onlineNowMessage') : t('livraison.profile.offlineNowMessage')
      );
    } catch (error) {
      // Ex. : identité pas encore vérifiée par l'équipe AFROEAT.
      Alert.alert(t('common.error'), error?.message || t('livraison.profile.errorLoadBody'));
    } finally {
      setSavingOnline(false);
    }
  };

  /**
   * GUARDS
   */

  if (authLoading || loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#C8331A" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login?role=livreur" />;
  }

  if (!isDriver(currentRole)) {
    return <Redirect href="/(tabs)/index" />;
  }

  /**
   * RENDER
   */

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.content}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.name}>
            {user?.name || t('livraison.profile.defaultName')}
          </Text>
          <Text style={styles.sub}>
            {user?.email || ''}
          </Text>
        </View>

        {/* ONLINE SWITCH */}
        <View style={styles.card}>
          <Text style={styles.label}>{t('livraison.profile.availabilityLabel')}</Text>

          <View style={styles.row}>
            <Text style={styles.status}>
              {online ? t('livraison.profile.onlineStatus') : t('livraison.profile.offlineStatus')}
            </Text>

            <Switch value={online} onValueChange={toggleOnline} disabled={savingOnline} />
          </View>
        </View>

        {/* STATS */}
        <View style={styles.card}>
          <Text style={styles.label}>{t('livraison.profile.performanceLabel')}</Text>

          <Text>{t('livraison.profile.deliveriesCountLabel', { count: stats.total })}</Text>
          <Text>{t('livraison.profile.activeCountLabel', { count: stats.active })}</Text>
          <Text>{t('livraison.profile.revenueLabel', { amount: formatPrice(stats.revenue) })}</Text>
        </View>

        {/* NAV */}
        <View style={styles.card}>
          <Pressable
            style={styles.nav}
            onPress={() => router.push('/livraison/livraison-orders')}
          >
            <Ionicons name="list-outline" size={20} />
            <Text style={styles.navText}>{t('livraison.profile.myDeliveriesNav')}</Text>
          </Pressable>

          <Pressable
            style={styles.nav}
            onPress={() => router.push('/livraison/history')}
          >
            <Ionicons name="time-outline" size={20} />
            <Text style={styles.navText}>{t('livraison.profile.historyNav')}</Text>
          </Pressable>
          <Pressable
            style={styles.nav}
            onPress={() => router.push('/account/payouts')}
          >
            <Ionicons name="wallet-outline" size={20} />
            <Text style={styles.navText}>{t('payouts.profileLink')}</Text>
          </Pressable>
        </View>
        <AccountPrivacyLink />
      </View>
    </FadeInView>
  );
}

/**
 * STYLES
 */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EC' },

  content: {
    padding: 20,
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    marginBottom: 20,
  },

  name: {
    fontSize: 22,
    fontWeight: '900',
  },

  sub: {
    color: '#777',
  },

  card: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
  },

  label: {
    fontWeight: '800',
    marginBottom: 10,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  status: {
    fontWeight: '700',
  },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  navText: {
    marginLeft: 10,
    fontWeight: '700',
  },
});
