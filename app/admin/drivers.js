import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import {
  getAdminDrivers,
  updateAdminUserStatus,
} from '../../services/adminService';

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const STATUS_FILTERS = [
  'Tous',
  'active',
  'suspended',
  'pending_verification',
  'rejected',
];

const LIVE_REFRESH_MS = 15000;

const DEFAULT_PAGINATION = {
  total: 0,
  count: 0,
  page: 1,
  pages: 1,
  hasNextPage: false,
  hasPrevPage: false,
  limit: 100,
};

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeRole = (value) => normalizeText(value).toLowerCase();

const isAdminRole = (role) =>
  ['admin', 'administrator', 'superadmin', 'super-admin'].includes(role);

const isDriverRole = (role) =>
  ['livreur', 'driver', 'delivery'].includes(role);

const formatDateValue = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) return 'Date indisponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date indisponible';

  return date.toLocaleString('fr-FR');
};

const getStatusStyle = (status) => {
  switch (String(status).toLowerCase()) {
    case 'active':
      return { bg: '#E8F5ED', text: '#1F6F43', label: 'Actif', icon: 'checkmark-circle-outline' };
    case 'suspended':
      return { bg: '#FDECEC', text: '#B83232', label: 'Suspendu', icon: 'ban-outline' };
    case 'pending_verification':
      return { bg: '#FFF3D8', text: '#8A6500', label: 'En attente', icon: 'time-outline' };
    case 'rejected':
      return { bg: '#EFE9FF', text: '#6D4CDB', label: 'Refusé', icon: 'close-circle-outline' };
    default:
      return { bg: '#F4F4F4', text: '#555', label: 'Inconnu', icon: 'help-circle-outline' };
  }
};

/**
 * =========================================================
 * NORMALIZER
 * =========================================================
 */

const normalizeDriver = (driver) => {
  if (!driver || typeof driver !== 'object') return null;

  return {
    _id: driver._id || driver.id,
    name: normalizeText(
      driver.name ||
        `${normalizeText(driver.firstName)} ${normalizeText(driver.lastName)}`.trim(),
      'Livreur Afroeat'
    ),
    email: normalizeText(driver.email),
    phone: normalizeText(driver.phone),
    accountStatus: normalizeText(driver.accountStatus, 'unknown'),
    createdAt: driver.createdAt,
    isIdentityVerified: !!driver.isIdentityVerified,
    isWorkAuthorized: !!driver.isWorkAuthorized,
    isAvailable: !!driver.isAvailable,
    currentOrderId:
      driver?.currentOrder?._id ||
      driver?.currentOrderId ||
      null,
    completedDeliveries: normalizeNumber(driver.completedDeliveries),
    rating: normalizeNumber(driver.rating),
    city: normalizeText(driver.city),
    vehicleType: normalizeText(driver.vehicleType),
  };
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function AdminDriversScreen() {
  const auth = useAuth() || {};

  const token = auth.token;
  const isAuthenticated = !!auth.isAuthenticated;
  const role = auth.role;
  const user = auth.user;

  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [search, setSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('Tous');

  const [updatingDriverId, setUpdatingDriverId] = useState(null);

  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);

  const currentRole = useMemo(
    () => normalizeRole(role || user?.role),
    [role, user]
  );

  const canAccess = isAuthenticated && isAdminRole(currentRole);

  /**
   * =========================================================
   * FETCH
   * =========================================================
   */

  const fetchDrivers = useCallback(
    async (manual = false, silent = false) => {
      if (!canAccess || !token) return;

      try {
        if (manual) setRefreshing(true);
        else if (!silent) setLoading(true);

        const response = await getAdminDrivers(token, {
          search,
          status: activeStatus === 'Tous' ? '' : activeStatus,
        });

        const raw = response?.items || response?.drivers || response?.data || [];

        const normalized = raw.map(normalizeDriver).filter(Boolean);

        setDrivers(normalized);

        setPagination({
          total: normalizeNumber(response?.total, normalized.length),
          count: normalizeNumber(response?.count, normalized.length),
          page: normalizeNumber(response?.page, 1),
          pages: normalizeNumber(response?.pages, 1),
        });
      } catch (error) {
        console.log(error);
        setErrorMessage(error?.message || 'Erreur chargement');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setInitialLoaded(true);
      }
    },
    [token, search, activeStatus, canAccess]
  );

  useFocusEffect(useCallback(() => { fetchDrivers(); }, [fetchDrivers]));

  useEffect(() => {
    if (!canAccess) return;
    const interval = setInterval(() => fetchDrivers(false, true), LIVE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchDrivers, canAccess]);

  /**
   * =========================================================
   * ACTIONS
   * =========================================================
   */

  const toggleStatus = useCallback(async (driver) => {
    const next = driver.accountStatus === 'suspended' ? 'active' : 'suspended';

    try {
      setUpdatingDriverId(driver._id);

      await updateAdminUserStatus(driver._id, next, token);

      setDrivers((prev) =>
        prev.map((d) =>
          d._id === driver._id ? { ...d, accountStatus: next } : d
        )
      );
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de modifier le statut');
    } finally {
      setUpdatingDriverId(null);
    }
  }, [token]);

  /**
   * =========================================================
   * GUARDS
   * =========================================================
   */

  if (!isAuthenticated) return <Redirect href="/auth/login?role=admin" />;

  if (!isAdminRole(currentRole)) return <Redirect href="/(tabs)" />;

  /**
   * =========================================================
   * RENDER
   * =========================================================
   */

  if (loading && !initialLoaded) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        data={drivers}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDrivers(true)}
          />
        }
        renderItem={({ item }) => {
          const status = getStatusStyle(item.accountStatus);

          return (
            <View style={styles.card}>
              <Text style={styles.title}>{item.name}</Text>
              <Text>{item.email}</Text>

              <View style={[styles.badge, { backgroundColor: status.bg }]}>
                <Text style={{ color: status.text }}>{status.label}</Text>
              </View>

              <Pressable onPress={() => toggleStatus(item)}>
                <Text style={styles.action}>
                  {item.accountStatus === 'suspended'
                    ? 'Réactiver'
                    : 'Suspendre'}
                </Text>
              </Pressable>
            </View>
          );
        }}
      />
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
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    backgroundColor: '#FFF',
    margin: 12,
    padding: 16,
    borderRadius: 16,
  },

  title: {
    fontWeight: '900',
    fontSize: 16,
  },

  badge: {
    marginTop: 8,
    padding: 6,
    borderRadius: 8,
  },

  action: {
    marginTop: 10,
    color: '#D4A017',
    fontWeight: 'bold',
  },
});