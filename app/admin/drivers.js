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
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

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

const DATE_LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-ES', it: 'it-IT', zh: 'zh-CN' };

const formatDateValue = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString(DATE_LOCALE_MAP[i18n.language] || 'fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) return i18n.t('admin.ops.dateUnavailable');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return i18n.t('admin.ops.dateUnavailable');

  return date.toLocaleString(DATE_LOCALE_MAP[i18n.language] || 'fr-FR');
};

const getStatusStyle = (status, t) => {
  switch (String(status).toLowerCase()) {
    case 'active':
      return { bg: '#E3F0E8', text: '#084424', label: t('admin.users.statusActiveLabel'), icon: 'checkmark-circle-outline' };
    case 'suspended':
      return { bg: '#F8E1DD', text: '#C8331A', label: t('admin.users.statusSuspendedLabel'), icon: 'ban-outline' };
    case 'pending_verification':
      return { bg: '#F3E7CA', text: '#301904', label: t('admin.users.statusPendingLabel'), icon: 'time-outline' };
    case 'rejected':
      return { bg: '#F2ECE0', text: '#084424', label: t('admin.users.statusRejectedLabel'), icon: 'close-circle-outline' };
    default:
      return { bg: '#F2ECE0', text: '#555', label: t('admin.users.statusUnknownLabel'), icon: 'help-circle-outline' };
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
      i18n.t('admin.drivers.driverNameFallback')
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
  const { t } = useTranslation();
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
        setErrorMessage(error?.message || t('admin.drivers.fetchErrorFallback'));
      } finally {
        setLoading(false);
        setRefreshing(false);
        setInitialLoaded(true);
      }
    },
    [token, search, activeStatus, canAccess, t]
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
      Alert.alert(t('common.error'), t('admin.drivers.updateStatusErrorFallback'));
    } finally {
      setUpdatingDriverId(null);
    }
  }, [token, t]);

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
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin'))}
              style={styles.back}
            >
              <Ionicons name="arrow-back" size={21} color="#0D1C11" />
            </Pressable>
            <Text style={styles.eyebrow}>AFROEAT · ADMIN</Text>
            <Text style={styles.pageTitle}>{t('admin.drivers.title')}</Text>
            <Text style={styles.pageSubtitle}>{t('admin.drivers.subtitle')}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {errorMessage || t('admin.drivers.emptyTitle')}
            </Text>
            {!errorMessage && (
              <>
                <Text style={styles.emptyBody}>{t('admin.drivers.emptyBody')}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/admin/partner-applications')}
                >
                  <Text style={styles.open}>{t('admin.drivers.emptyAction')}</Text>
                </Pressable>
              </>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDrivers(true)}
          />
        }
        renderItem={({ item }) => {
          const status = getStatusStyle(item.accountStatus, t);

          const verified = item.isIdentityVerified && item.isWorkAuthorized;
          return (
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/admin/drivers-details/${item._id}`)}
              >
                <Text style={styles.title}>{item.name}</Text>
                <Text>{item.email}</Text>
              </Pressable>

              <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: status.bg }]}>
                  <Text style={{ color: status.text }}>{status.label}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: verified ? '#E3F0E8' : '#F3E7CA' }]}>
                  <Text style={{ color: verified ? '#084424' : '#301904' }}>
                    {verified ? t('admin.drivers.verified') : t('admin.drivers.toVerify')}
                  </Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/admin/drivers-details/${item._id}`)}
              >
                <Text style={styles.open}>{t('admin.drivers.openDetails')}</Text>
              </Pressable>

              <Pressable onPress={() => toggleStatus(item)}>
                <Text style={styles.action}>
                  {item.accountStatus === 'suspended'
                    ? t('admin.users.reactivateButton')
                    : t('admin.users.suspendButton')}
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
  container: { flex: 1, backgroundColor: '#FBF6EC' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  list: { paddingBottom: 40, maxWidth: 900, width: '100%', alignSelf: 'center' },
  header: { paddingHorizontal: 12, paddingTop: 20, paddingBottom: 4 },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFFDF9', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#E3DECF' },
  eyebrow: { color: '#C8331A', fontSize: 11, letterSpacing: 1.5, fontWeight: '900' },
  pageTitle: { color: '#0D1C11', fontSize: 28, marginTop: 7, fontWeight: '900' },
  pageSubtitle: { color: '#606D5D', fontSize: 14, lineHeight: 21, marginTop: 6 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  open: { marginTop: 10, color: '#084424', fontWeight: 'bold' },
  empty: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#0D1C11' },
  emptyBody: { marginTop: 8, color: '#4A5A50', lineHeight: 20 },
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
    color: '#EAB02F',
    fontWeight: 'bold',
  },
});