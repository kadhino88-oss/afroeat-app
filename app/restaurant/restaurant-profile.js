import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, Redirect } from 'expo-router';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { getMyRestaurant } from '../../services/restaurantService';

const normalizeText = (v, f = '') => {
  const n = String(v ?? '').trim();
  return n || f;
};

const normalizeRole = (v) => String(v || '').trim().toLowerCase();
const normalizeStatus = (v) => String(v || '').trim().toLowerCase();

const normalizeBoolean = (v, f = false) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const n = v.trim().toLowerCase();
    if (n === 'true' || n === '1') return true;
    if (n === 'false' || n === '0') return false;
  }
  if (typeof v === 'number') return v === 1;
  return f;
};

const getRestaurantStatus = (user, auth) => {
  return normalizeStatus(
    user?.status ||
      user?.approvalStatus ||
      user?.restaurantStatus ||
      auth?.status ||
      ''
  );
};

const normalizeRestaurant = (data) => {
  if (!data || typeof data !== 'object') return null;

  const r = data?.restaurant || data?.data?.restaurant || data?.data || data;
  if (!r || typeof r !== 'object') return null;

  return {
    _id: r._id || r.id,
    name: normalizeText(r.name, 'Restaurant partenaire'),
    cuisine: normalizeText(r.cuisine, 'Cuisine africaine'),
    address: normalizeText(r.address, 'Adresse non renseignée'),
    phone: normalizeText(r.phone, 'Non renseigné'),
    email: normalizeText(r.email),
    description: normalizeText(r.description),
    city: normalizeText(r.city),
    country: normalizeText(r.country),
    currency: normalizeText(r.currency, 'EUR'),
    deliveryFee: Number.isFinite(Number(r.deliveryFee)) ? Number(r.deliveryFee) : 0,
    isOpen: normalizeBoolean(r.isOpen, true),
  };
};

const getOpenState = (r) => {
  return r?.isOpen === false
    ? { label: 'Fermé', color: '#B83232', bg: '#FDECEC' }
    : { label: 'Ouvert', color: '#1F6F43', bg: '#E8F5ED' };
};

const formatPrice = (value, currency = 'EUR') => {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  const c = normalizeText(currency, 'EUR').toUpperCase();

  if (c === 'USD') return `$${amount.toFixed(2)}`;
  if (c === 'GBP') return `£${amount.toFixed(2)}`;
  if (c === 'XOF' || c === 'XAF') return `${amount.toFixed(0)} ${c}`;
  if (c === 'CAD') return `${amount.toFixed(2)} $CA`;

  return `${amount.toFixed(2)} €`;
};

const InfoCard = ({ title, children }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    {children}
  </View>
);

const MetaRow = ({ icon, label, value, valueStyle, multiline = false }) => (
  <View style={styles.metaRow}>
    <Ionicons name={icon} size={16} color="#6B655E" />
    <Text style={styles.metaLabel}>{label}</Text>
    <Text
      style={[
        styles.metaValue,
        multiline && styles.metaValueMultiline,
        valueStyle,
      ]}
    >
      {value}
    </Text>
  </View>
);

export default function RestaurantProfile() {
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

  const currentStatus = useMemo(
    () => getRestaurantStatus(user, auth),
    [user, auth]
  );

  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const restaurantId = restaurant?._id || null;
  const openState = getOpenState(restaurant);

  const fetchRestaurant = useCallback(async (manual = false) => {
    if (!token || currentRole !== 'restaurant') {
      setRestaurant(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      manual ? setRefreshing(true) : setLoading(true);
      const data = await getMyRestaurant(token);
      const safe = normalizeRestaurant(data);
      setRestaurant(safe?._id ? safe : null);
    } catch (e) {
      console.log('Erreur profile restaurant :', e);
      setRestaurant(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, currentRole]);

  useFocusEffect(
    useCallback(() => {
      fetchRestaurant(false);
    }, [fetchRestaurant])
  );

  if (authLoading || loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#1F6F43" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login?role=restaurant" />;
  }

  if (currentRole !== 'restaurant') {
    if (currentRole === 'admin') return <Redirect href="/admin" />;
    if (
      currentRole === 'livreur' ||
      currentRole === 'driver' ||
      currentRole === 'delivery'
    ) {
      return <Redirect href="/livraison" />;
    }
    return <Redirect href="/(tabs)/index" />;
  }

  if (
    currentStatus === 'pending' ||
    currentStatus === 'pending_verification' ||
    currentStatus === 'submitted' ||
    currentStatus === 'draft'
  ) {
    return <Redirect href="/auth/pending-approval?role=restaurant" />;
  }

  if (!restaurantId) {
    return (
      <FadeInView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="storefront-remove-outline"
            size={56}
            color="#C8BBAA"
          />
          <Text style={styles.emptyTitle}>Restaurant introuvable</Text>
          <Text style={styles.emptyText}>
            Impossible de charger les informations du restaurant.
          </Text>
        </View>
      </FadeInView>
    );
  }

  return (
    <FadeInView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchRestaurant(true)}
          />
        }
      >
        <View style={styles.topRow}>
          <Pressable style={styles.topButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
          </Pressable>

          <Pressable
            style={styles.topButton}
            onPress={() => fetchRestaurant(true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#1E1E1E" />
            ) : (
              <Ionicons name="refresh-outline" size={20} color="#1E1E1E" />
            )}
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>Restaurant</Text>
          <Text style={styles.title}>Profil partenaire</Text>
          <Text style={styles.subtitle}>
            Vue premium de l’identité, de la vitrine commerciale et des informations clés.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons
              name="storefront-outline"
              size={28}
              color="#1F6F43"
            />
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{restaurant.name}</Text>
            <Text style={styles.heroText}>
              {restaurant.description || 'Restaurant partenaire AFROEAT.'}
            </Text>

            <View style={styles.heroTags}>
              <View style={styles.heroTag}>
                <Text style={styles.heroTagText}>{restaurant.cuisine}</Text>
              </View>

              <View style={[styles.heroTag, { backgroundColor: openState.bg }]}>
                <Text style={[styles.heroTagText, { color: openState.color }]}>
                  {openState.label}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <InfoCard title="Informations générales">
          <MetaRow
            icon="storefront-outline"
            label="Nom"
            value={restaurant.name}
          />
          <MetaRow
            icon="restaurant-outline"
            label="Cuisine"
            value={restaurant.cuisine}
          />
          <MetaRow
            icon="location-outline"
            label="Adresse"
            value={restaurant.address}
            multiline
          />
          <MetaRow
            icon="business-outline"
            label="Ville"
            value={normalizeText(restaurant.city, 'Non renseignée')}
          />
          <MetaRow
            icon="earth-outline"
            label="Pays"
            value={normalizeText(restaurant.country, 'Non renseigné')}
          />
        </InfoCard>

        <InfoCard title="Contact & exploitation">
          <MetaRow
            icon="call-outline"
            label="Téléphone"
            value={restaurant.phone}
          />
          <MetaRow
            icon="mail-outline"
            label="Email"
            value={normalizeText(restaurant.email, 'Non renseigné')}
          />
          <MetaRow
            icon="cash-outline"
            label="Devise"
            value={restaurant.currency}
          />
          <MetaRow
            icon="car-outline"
            label="Livraison"
            value={formatPrice(restaurant.deliveryFee, restaurant.currency)}
          />
          <MetaRow
            icon="time-outline"
            label="Statut"
            value={openState.label}
            valueStyle={{ color: openState.color, fontWeight: '900' }}
          />
        </InfoCard>

        <View style={styles.actionsBlock}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/restaurant/MenuScreen')}
          >
            <Ionicons name="restaurant-outline" size={18} color="#111111" />
            <Text style={styles.primaryButtonText}>Voir mon menu</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push('/restaurant/restaurant-orders')}
          >
            <Ionicons name="receipt-outline" size={18} color="#1F6F43" />
            <Text style={styles.secondaryButtonText}>Voir mes commandes</Text>
          </Pressable>
        </View>
      </ScrollView>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 60 },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },

  header: { marginBottom: 18 },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F6F43',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    color: '#6B655E',
    fontSize: 14,
    lineHeight: 21,
  },

  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    elevation: 2,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#E8F5ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  heroContent: { flex: 1 },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111',
    marginBottom: 8,
  },
  heroText: {
    color: '#666',
    fontSize: 14,
    lineHeight: 21,
  },
  heroTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  heroTag: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  heroTagText: {
    color: '#555',
    fontSize: 12,
    fontWeight: '700',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111',
    marginBottom: 14,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metaLabel: {
    marginLeft: 8,
    width: 92,
    color: '#6B655E',
    fontSize: 13,
    fontWeight: '700',
  },
  metaValue: {
    flex: 1,
    color: '#111',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  metaValueMultiline: {
    lineHeight: 20,
  },

  actionsBlock: {
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    minHeight: 50,
    backgroundColor: '#D4A017',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryButtonText: {
    color: '#111111',
    fontWeight: '900',
    marginLeft: 8,
    fontSize: 14,
  },
  secondaryButton: {
    minHeight: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6EAD9',
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  secondaryButtonText: {
    color: '#1F6F43',
    fontWeight: '900',
    marginLeft: 8,
    fontSize: 14,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    textAlign: 'center',
    color: '#111',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#777',
    fontSize: 15,
    lineHeight: 22,
  },
});