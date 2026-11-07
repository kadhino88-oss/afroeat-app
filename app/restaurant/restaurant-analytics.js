import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { API_ENDPOINTS } from '../../constants/api';
import { apiGet } from '../../services/apiClient';

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getRestaurantPayload = (response) =>
  response?.restaurant ||
  response?.data?.restaurant ||
  response?.data?.item ||
  response?.item ||
  null;

const formatCurrency = (value, currency, locale) => {
  const amount = normalizeNumber(value, 0);
  const safeCurrency = String(currency || 'EUR').toUpperCase();

  try {
    return new Intl.NumberFormat(locale || 'fr-FR', {
      style: 'currency',
      currency: safeCurrency,
      minimumFractionDigits: ['XOF', 'XAF'].includes(safeCurrency) ? 0 : 2,
      maximumFractionDigits: ['XOF', 'XAF'].includes(safeCurrency) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${safeCurrency}`;
  }
};

const StatCard = ({ title, value, icon, color }) => (
  <View style={styles.card}>
    <View style={[styles.iconWrap, { backgroundColor: `${color}20` }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={styles.value}>{value}</Text>
    <Text style={styles.label}>{title}</Text>
  </View>
);

export default function RestaurantAnalytics() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth() || {};
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = useCallback(async () => {
    if (!token) {
      setAnalytics(null);
      setError(t('restaurant.analytics.sessionUnavailable'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiGet(API_ENDPOINTS.restaurants.my, token);
      const restaurant = getRestaurantPayload(response);
      if (!restaurant?._id && !restaurant?.id) {
        throw new Error(t('restaurant.analytics.unavailable'));
      }

      const stats = restaurant.stats || {};
      setAnalytics({
        totalOrders: normalizeNumber(stats.totalOrders, 0),
        paidOrders: normalizeNumber(stats.paidOrders, 0),
        revenue: normalizeNumber(stats.revenue, 0),
        rating: normalizeNumber(restaurant.ratingAverage, 0),
        ratingCount: normalizeNumber(restaurant.ratingCount, 0),
        currency: String(restaurant.currency || 'EUR').toUpperCase(),
      });
    } catch (fetchError) {
      setAnalytics(null);
      setError(fetchError?.message || t('restaurant.analytics.unavailable'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
    }, [fetchAnalytics])
  );

  const averageNetEarning = analytics?.paidOrders
    ? analytics.revenue / analytics.paidOrders
    : null;

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('restaurant.analytics.title')}</Text>
        <Text style={styles.subtitle}>
          {t('restaurant.analytics.subtitle')}
        </Text>

        {loading && !analytics ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color="#1F6F43" />
            <Text style={styles.stateText}>{t('restaurant.analytics.loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={28} color="#A6422A" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}
              onPress={fetchAnalytics}
            >
              <Text style={styles.retryText}>{t('restaurant.retry')}</Text>
            </Pressable>
          </View>
        ) : analytics ? (
          <>
            <View style={styles.grid}>
              <StatCard
                title={t('restaurant.analytics.ordersLabel')}
                value={analytics.totalOrders.toLocaleString(i18n.language)}
                icon="receipt-outline"
                color="#1F6F43"
              />

              <StatCard
                title={t('restaurant.analytics.revenueLabel')}
                value={formatCurrency(analytics.revenue, analytics.currency, i18n.language)}
                icon="cash-outline"
                color="#D96C2D"
              />

              <StatCard
                title={t('restaurant.analytics.avgOrderLabel')}
                value={averageNetEarning === null
                  ? '—'
                  : formatCurrency(averageNetEarning, analytics.currency, i18n.language)}
                icon="basket-outline"
                color="#245EA8"
              />

              <StatCard
                title={t('restaurant.analytics.ratingLabel')}
                value={analytics.ratingCount > 0 ? analytics.rating.toFixed(1) : '—'}
                icon="star-outline"
                color="#D4A017"
              />
            </View>

            <View style={styles.bottomCard}>
              <Ionicons name="information-circle-outline" size={24} color="#1F6F43" />
              <Text style={styles.bottomText}>
                {t('restaurant.analytics.dataSource', { count: analytics.paidOrders })}
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { padding: 20, flexGrow: 1 },
  title: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
    color: '#111',
  },
  subtitle: { color: '#666', marginBottom: 20 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
    elevation: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  value: { fontSize: 20, fontWeight: '900', color: '#111' },
  label: { color: '#666', marginTop: 4 },
  stateCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 24,
    minHeight: 220,
  },
  stateText: { marginTop: 12, color: '#666', textAlign: 'center' },
  errorText: { color: '#6A3023', textAlign: 'center', marginVertical: 14 },
  retryButton: {
    backgroundColor: '#1F6F43',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  retryText: { color: '#FFF', fontWeight: '800' },
  buttonPressed: { opacity: 0.8 },
  bottomCard: {
    marginTop: 20,
    backgroundColor: '#E8F5ED',
    padding: 16,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomText: { marginLeft: 10, color: '#1F6F43', fontWeight: '700', flex: 1 },
});
