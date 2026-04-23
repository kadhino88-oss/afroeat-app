import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * =========================================================
 * COMPONENT
 * =========================================================
 */

const StatCard = ({ title, value, icon, color }) => (
  <View style={styles.card}>
    <View style={[styles.iconWrap, { backgroundColor: `${color}20` }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={styles.value}>{value}</Text>
    <Text style={styles.label}>{title}</Text>
  </View>
);

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function RestaurantAnalytics() {
  const { user } = useAuth() || {};

  /**
   * Fake data (à brancher backend ensuite)
   */
  const stats = useMemo(() => {
    return {
      totalOrders: 128,
      revenue: 3245,
      avgOrder: 25,
      rating: 4.6,
    };
  }, []);

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>
          Performance globale de ton restaurant
        </Text>

        <View style={styles.grid}>
          <StatCard
            title="Commandes"
            value={normalizeNumber(stats.totalOrders)}
            icon="receipt-outline"
            color="#1F6F43"
          />

          <StatCard
            title="Revenu (€)"
            value={normalizeNumber(stats.revenue)}
            icon="cash-outline"
            color="#D96C2D"
          />

          <StatCard
            title="Panier moyen"
            value={`${normalizeNumber(stats.avgOrder)}€`}
            icon="basket-outline"
            color="#245EA8"
          />

          <StatCard
            title="Note"
            value={stats.rating}
            icon="star-outline"
            color="#D4A017"
          />
        </View>

        <View style={styles.bottomCard}>
          <Ionicons name="trending-up-outline" size={24} color="#1F6F43" />
          <Text style={styles.bottomText}>
            Ton restaurant est en croissance. Continue d’optimiser ton menu et ton service.
          </Text>
        </View>
      </ScrollView>
    </FadeInView>
  );
}

/**
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { padding: 20 },

  title: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 6,
    color: '#111',
  },

  subtitle: {
    color: '#666',
    marginBottom: 20,
  },

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

  value: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111',
  },

  label: {
    color: '#666',
    marginTop: 4,
  },

  bottomCard: {
    marginTop: 20,
    backgroundColor: '#E8F5ED',
    padding: 16,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },

  bottomText: {
    marginLeft: 10,
    color: '#1F6F43',
    fontWeight: '700',
  },
});