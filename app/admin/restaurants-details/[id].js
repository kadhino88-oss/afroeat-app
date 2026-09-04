// app/admin/restaurant-details/[id].jsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, router, Redirect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import FadeInView from '../../../components/FadeInView';
import { useAuth } from '../../../context/AuthContext';
import {
  getAdminRestaurantById,
  updateAdminUserStatus,
} from '../../../services/adminService';

const LIVE_REFRESH_MS = 15000;

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

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  return fallback;
};

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const normalizeRole = (value) => normalizeText(value).toLowerCase();

const isAdminRole = (value) => {
  const role = normalizeRole(value);
  return (
    role === 'admin' ||
    role === 'administrator' ||
    role === 'superadmin' ||
    role === 'super-admin'
  );
};

const isDriverRole = (value) => {
  const role = normalizeRole(value);
  return role === 'livreur' || role === 'driver' || role === 'delivery';
};

const getAuthStatus = (auth = {}) => {
  const user = auth?.user ?? null;
  return normalizeText(
    auth?.status || user?.status || user?.accountStatus || '',
    ''
  ).toLowerCase();
};

const getSafeParam = (value) => {
  if (Array.isArray(value)) return normalizeText(value[0]);
  return normalizeText(value);
};

const formatPrice = (value, currency = 'EUR') => {
  const amount = normalizeNumber(value, 0);
  const safeCurrency = normalizeText(currency, 'EUR').toUpperCase();

  if (safeCurrency === 'USD') return `$${amount.toFixed(2)}`;
  if (safeCurrency === 'GBP') return `£${amount.toFixed(2)}`;
  if (safeCurrency === 'CHF') return `CHF ${amount.toFixed(2)}`;
  if (safeCurrency === 'XOF' || safeCurrency === 'XAF') {
    return `${amount.toFixed(0)} ${safeCurrency}`;
  }
  if (safeCurrency === 'CAD') return `${amount.toFixed(2)} $CA`;

  return `${amount.toFixed(2)} €`;
};

const formatDateTime = (value) => {
  if (!value) return 'Date indisponible';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date indisponible';
  }

  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatDate = (value) => {
  if (!value) return 'Date indisponible';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date indisponible';
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getOwnerStatusStyle = (status) => {
  switch (normalizeText(status).toLowerCase()) {
    case 'active':
      return {
        bg: '#E8F5ED',
        text: '#1F6F43',
        label: 'Actif',
        icon: 'checkmark-circle-outline',
      };
    case 'suspended':
      return {
        bg: '#FDECEC',
        text: '#B83232',
        label: 'Suspendu',
        icon: 'ban-outline',
      };
    case 'pending_verification':
      return {
        bg: '#FFF3D8',
        text: '#8A6500',
        label: 'En attente',
        icon: 'time-outline',
      };
    case 'rejected':
      return {
        bg: '#EFE9FF',
        text: '#6D4CDB',
        label: 'Refusé',
        icon: 'close-circle-outline',
      };
    default:
      return {
        bg: '#F4F4F4',
        text: '#555555',
        label: normalizeText(status, 'Inconnu'),
        icon: 'help-circle-outline',
      };
  }
};

const getVerificationStyle = (value) => {
  if (value === true) {
    return {
      bg: '#E8F5ED',
      text: '#1F6F43',
      label: 'Oui',
      icon: 'checkmark-circle-outline',
    };
  }

  return {
    bg: '#FFF3D8',
    text: '#8A6500',
    label: 'Non',
    icon: 'warning-outline',
  };
};

const getOperationalRiskStyle = (restaurant) => {
  const hasOwner = Boolean(restaurant?.owner?._id);
  const menuCount = normalizeNumber(restaurant?.menuCount, 0);
  const hasAddress = Boolean(normalizeText(restaurant?.address));
  const ownerStatus = normalizeText(restaurant?.owner?.accountStatus).toLowerCase();

  if (!hasOwner || ownerStatus === 'suspended') {
    return {
      bg: '#FDECEC',
      text: '#B83232',
      label: 'Élevé',
      icon: 'alert-circle-outline',
    };
  }

  if (!hasAddress || menuCount === 0) {
    return {
      bg: '#FFF3D8',
      text: '#8A6500',
      label: 'Moyen',
      icon: 'warning-outline',
    };
  }

  return {
    bg: '#E8F5ED',
    text: '#1F6F43',
    label: 'Faible',
    icon: 'checkmark-circle-outline',
  };
};

const normalizeRestaurantResponse = (payload) => {
  const raw =
    payload?.restaurant ||
    payload?.data?.restaurant ||
    payload?.data ||
    payload ||
    null;

  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const owner =
    raw?.owner && typeof raw.owner === 'object'
      ? {
          ...raw.owner,
          _id: raw.owner?._id || raw.owner?.id || null,
          id: raw.owner?.id || raw.owner?._id || null,
          name: normalizeText(raw.owner?.name, 'Propriétaire non renseigné'),
          email: normalizeText(raw.owner?.email),
          phone: normalizeText(raw.owner?.phone),
          role: normalizeRole(raw.owner?.role || 'restaurant'),
          accountStatus: normalizeText(
            raw.owner?.accountStatus || raw.owner?.status,
            'pending_verification'
          ).toLowerCase(),
          isIdentityVerified: normalizeBoolean(raw.owner?.isIdentityVerified),
          isWorkAuthorized: normalizeBoolean(raw.owner?.isWorkAuthorized),
        }
      : null;

  const rawMenus = normalizeArray(
    raw?.menu || raw?.menus || raw?.menuItems || raw?.items
  );

  const menus = rawMenus
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      return {
        ...item,
        _id: item?._id || item?.id || null,
        id: item?.id || item?._id || null,
        name: normalizeText(item?.name || item?.title, 'Article'),
        category: normalizeText(item?.category, 'Catégorie'),
        price: normalizeNumber(item?.price, 0),
        isAvailable:
          item?.isAvailable !== undefined
            ? normalizeBoolean(item?.isAvailable, true)
            : normalizeBoolean(item?.available, true),
      };
    })
    .filter(Boolean);

  const categoriesFromMenus = menus
    .map((item) => normalizeText(item?.category))
    .filter(Boolean);

  const categories = [
    ...new Set([
      ...normalizeArray(raw?.categories).map((item) => normalizeText(item)).filter(Boolean),
      ...categoriesFromMenus,
    ]),
  ];

  const stats = raw?.stats && typeof raw.stats === 'object' ? raw.stats : {};

  const totalOrders =
    stats?.totalOrders !== undefined
      ? normalizeNumber(stats.totalOrders, 0)
      : raw?.totalOrders !== undefined
      ? normalizeNumber(raw.totalOrders, 0)
      : normalizeNumber(raw?.ordersCount, 0);

  const deliveredOrders =
    stats?.deliveredOrders !== undefined
      ? normalizeNumber(stats.deliveredOrders, 0)
      : normalizeNumber(raw?.deliveredOrders, 0);

  const cancelledOrders =
    stats?.cancelledOrders !== undefined
      ? normalizeNumber(stats.cancelledOrders, 0)
      : normalizeNumber(raw?.cancelledOrders, 0);

  const pendingOrders =
    stats?.pendingOrders !== undefined
      ? normalizeNumber(stats.pendingOrders, 0)
      : normalizeNumber(raw?.pendingOrders, 0);

  const revenue =
    stats?.revenue !== undefined
      ? normalizeNumber(stats.revenue, 0)
      : raw?.revenue !== undefined
      ? normalizeNumber(raw.revenue, 0)
      : normalizeNumber(raw?.totalRevenue, 0);

  return {
    ...raw,
    _id: raw?._id || raw?.id || null,
    id: raw?.id || raw?._id || null,
    name: normalizeText(raw?.name, 'Restaurant'),
    cuisine: normalizeText(raw?.cuisine, 'Cuisine non renseignée'),
    address: normalizeText(raw?.address),
    city: normalizeText(raw?.city),
    country: normalizeText(raw?.country),
    currency: normalizeText(raw?.currency, 'EUR').toUpperCase(),
    deliveryFee: normalizeNumber(raw?.deliveryFee, 0),
    rating: normalizeNumber(raw?.rating, 0),
    isOpen: normalizeBoolean(raw?.isOpen, true),
    isFeatured: normalizeBoolean(raw?.isFeatured, false),
    owner,
    menus,
    categories,
    menuCount: menus.length,
    createdAt: raw?.createdAt || null,
    updatedAt: raw?.updatedAt || null,
    totalOrders,
    deliveredOrders,
    cancelledOrders,
    pendingOrders,
    revenue,
  };
};

const InfoCard = ({ title, children, footer }) => (
  <View style={styles.card}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
    {footer ? <View style={styles.cardFooter}>{footer}</View> : null}
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

const StatBox = ({ label, value, accent = '#1F6F43', icon }) => (
  <View style={styles.statBox}>
    <View style={styles.statBoxTop}>
      {icon ? <Ionicons name={icon} size={15} color={accent} /> : null}
      <Text style={[styles.statBoxValue, { color: accent }]}>{value}</Text>
    </View>
    <Text style={styles.statBoxLabel}>{label}</Text>
  </View>
);

const Badge = ({ label, bg, text, icon }) => (
  <View style={[styles.heroBadge, { backgroundColor: bg }]}>
    {icon ? <Ionicons name={icon} size={15} color={text} /> : null}
    <Text style={[styles.heroBadgeText, { color: text }]}>{label}</Text>
  </View>
);

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function AdminRestaurantDetailsScreen() {
  const params = useLocalSearchParams();
  const auth = useAuth() || {};

  const restaurantId = getSafeParam(params?.id);
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);
  const currentUser = auth.user ?? null;
  const currentRole = useMemo(() => normalizeRole(auth.role || currentUser?.role), [auth.role, currentUser]);
  const currentStatus = useMemo(() => getAuthStatus(auth), [auth]);

  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [updatingOwner, setUpdatingOwner] = useState(false);
  const [lastLiveRefresh, setLastLiveRefresh] = useState(null);

  const canAccess = Boolean(isAuthenticated && token && isAdminRole(currentRole));

  const ownerStatusStyle = useMemo(() => {
    return getOwnerStatusStyle(restaurant?.owner?.accountStatus);
  }, [restaurant]);

  const ownerIdentityStyle = useMemo(() => {
    return getVerificationStyle(Boolean(restaurant?.owner?.isIdentityVerified));
  }, [restaurant]);

  const ownerWorkStyle = useMemo(() => {
    return getVerificationStyle(Boolean(restaurant?.owner?.isWorkAuthorized));
  }, [restaurant]);

  const operationalRiskStyle = useMemo(() => {
    return getOperationalRiskStyle(restaurant);
  }, [restaurant]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/admin/restaurants');
  }, []);

  const fetchRestaurant = useCallback(
    async (manual = false, silent = false) => {
      if (!isAuthenticated || !token || !restaurantId || !isAdminRole(currentRole)) {
        setRestaurant(null);
        setErrorMessage(
          !restaurantId
            ? 'Restaurant invalide.'
            : 'Session admin invalide.'
        );
        setLoading(false);
        setRefreshing(false);
        setInitialLoaded(true);
        return;
      }

      try {
        setErrorMessage('');

        if (manual) {
          setRefreshing(true);
        } else if (!silent) {
          setLoading(true);
        }

        const result = await getAdminRestaurantById(restaurantId, token);
        const safeRestaurant = normalizeRestaurantResponse(result);

        if (!safeRestaurant?._id) {
          throw new Error('Impossible de charger ce restaurant.');
        }

        setRestaurant(safeRestaurant);
        setLastLiveRefresh(new Date().toISOString());
      } catch (error) {
        console.log('Erreur détail restaurant admin :', error);

        const message =
          error?.message || 'Impossible de charger ce restaurant.';

        if (!silent) {
          setRestaurant(null);
        }

        setErrorMessage(message);

        if (manual) {
          Alert.alert('Erreur', message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setInitialLoaded(true);
      }
    },
    [isAuthenticated, token, restaurantId, currentRole]
  );

  useFocusEffect(
    useCallback(() => {
      fetchRestaurant(false, false);
    }, [fetchRestaurant])
  );

  useEffect(() => {
    if (!canAccess || !restaurantId) {
      return undefined;
    }

    const interval = setInterval(() => {
      fetchRestaurant(false, true);
    }, LIVE_REFRESH_MS);

    return () => clearInterval(interval);
  }, [canAccess, restaurantId, fetchRestaurant]);

  const locationLine = useMemo(() => {
    const parts = [
      normalizeText(restaurant?.address),
      normalizeText(restaurant?.city),
      normalizeText(restaurant?.country),
    ].filter(Boolean);

    return parts.join(', ');
  }, [restaurant]);

  const menus = useMemo(() => normalizeArray(restaurant?.menus), [restaurant]);

  const categories = useMemo(() => {
    return normalizeArray(restaurant?.categories);
  }, [restaurant]);

  const averageMenuPrice = useMemo(() => {
    if (menus.length === 0) return 0;

    const values = menus
      .map((item) => normalizeNumber(item?.price, NaN))
      .filter((value) => Number.isFinite(value) && value >= 0);

    if (values.length === 0) return 0;

    const total = values.reduce((sum, value) => sum + value, 0);
    return total / values.length;
  }, [menus]);

  const cheapestMenuPrice = useMemo(() => {
    const values = menus
      .map((item) => normalizeNumber(item?.price, NaN))
      .filter((value) => Number.isFinite(value) && value >= 0);

    if (values.length === 0) return 0;

    return Math.min(...values);
  }, [menus]);

  const highestMenuPrice = useMemo(() => {
    const values = menus
      .map((item) => normalizeNumber(item?.price, NaN))
      .filter((value) => Number.isFinite(value) && value >= 0);

    if (values.length === 0) return 0;

    return Math.max(...values);
  }, [menus]);

  const menuAvailabilityStats = useMemo(() => {
    const availableCount = menus.filter((item) => item?.isAvailable !== false).length;
    const unavailableCount = Math.max(menus.length - availableCount, 0);

    return {
      availableCount,
      unavailableCount,
    };
  }, [menus]);

  const technicalFlags = useMemo(() => {
    return [
      {
        key: 'currency',
        value: normalizeText(restaurant?.currency, 'EUR'),
        label: 'Devise',
        accent: '#245EA8',
        icon: 'cash-outline',
      },
      {
        key: 'deliveryFee',
        value: formatPrice(restaurant?.deliveryFee, restaurant?.currency || 'EUR'),
        label: 'Livraison',
        accent: '#D96C2D',
        icon: 'car-outline',
      },
      {
        key: 'ownerStatus',
        value: ownerStatusStyle.label,
        label: 'Owner status',
        accent: ownerStatusStyle.text,
        icon: ownerStatusStyle.icon,
      },
      {
        key: 'hasOwner',
        value: restaurant?.owner?._id ? 'Oui' : 'Non',
        label: 'Owner lié',
        accent: restaurant?.owner?._id ? '#1F6F43' : '#B83232',
        icon: 'person-outline',
      },
      {
        key: 'menuCount',
        value: String(menus.length),
        label: 'Éléments menu',
        accent: '#7C3AED',
        icon: 'list-outline',
      },
      {
        key: 'categoriesCount',
        value: String(categories.length),
        label: 'Catégories',
        accent: '#8A6500',
        icon: 'grid-outline',
      },
      {
        key: 'risk',
        value: operationalRiskStyle.label,
        label: 'Risque ops',
        accent: operationalRiskStyle.text,
        icon: operationalRiskStyle.icon,
      },
      {
        key: 'isOpen',
        value: restaurant?.isOpen ? 'Ouvert' : 'Fermé',
        label: 'État',
        accent: restaurant?.isOpen ? '#1F6F43' : '#B83232',
        icon: restaurant?.isOpen ? 'checkmark-circle-outline' : 'close-circle-outline',
      },
    ];
  }, [restaurant, ownerStatusStyle, menus, categories, operationalRiskStyle]);

  const liveRefreshLabel = useMemo(() => {
    if (!lastLiveRefresh) {
      return 'En attente du premier refresh live';
    }

    return `Dernier refresh live : ${formatDateTime(lastLiveRefresh)}`;
  }, [lastLiveRefresh]);

  const handleToggleOwnerStatus = useCallback(() => {
    if (!restaurant?.owner?._id || !token) {
      Alert.alert('Erreur', 'Action impossible sur ce propriétaire.');
      return;
    }

    const currentOwnerStatus = normalizeText(
      restaurant?.owner?.accountStatus
    ).toLowerCase();
    const nextStatus = currentOwnerStatus === 'suspended' ? 'active' : 'suspended';
    const actionLabel = nextStatus === 'active' ? 'réactiver' : 'suspendre';
    const ownerName = normalizeText(
      restaurant?.owner?.name,
      normalizeText(restaurant?.owner?.email, 'ce propriétaire')
    );

    Alert.alert(
      'Confirmer',
      `Veux-tu ${actionLabel} ${ownerName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              setUpdatingOwner(true);

              const response = await updateAdminUserStatus(
                restaurant.owner._id,
                nextStatus,
                token
              );

              const updatedOwnerRaw =
                response?.user || response?.data?.user || null;

              setRestaurant((prev) => {
                const nextRestaurant = {
                  ...(prev || {}),
                  owner: {
                    ...(prev?.owner || {}),
                    ...(updatedOwnerRaw || {}),
                    accountStatus:
                      normalizeText(
                        updatedOwnerRaw?.accountStatus || updatedOwnerRaw?.status,
                        nextStatus
                      ).toLowerCase(),
                  },
                };

                return normalizeRestaurantResponse(nextRestaurant);
              });

              Alert.alert(
                'Succès',
                response?.message || 'Statut du propriétaire mis à jour.'
              );
            } catch (error) {
              console.log('Erreur update owner restaurant :', error);
              Alert.alert(
                'Erreur',
                error?.message || 'Impossible de modifier le statut du propriétaire.'
              );
            } finally {
              setUpdatingOwner(false);
            }
          },
        },
      ]
    );
  }, [restaurant, token]);

  /**
   * =========================================================
   * LOADING / GUARDS
   * =========================================================
   */

  if (authLoading || (loading && !initialLoaded)) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#1F6F43" />
        <Text style={styles.loaderText}>Chargement du restaurant...</Text>
      </View>
    );
  }

  if (!isAuthenticated || !token) {
    return <Redirect href="/auth/login?role=admin" />;
  }

  if (!isAdminRole(currentRole)) {
    if (currentRole === 'restaurant') {
      return <Redirect href="/restaurant/RestaurantDashboard" />;
    }

    if (isDriverRole(currentRole)) {
      return <Redirect href="/livraison/index" />;
    }

    return <Redirect href="/(tabs)/index" />;
  }

  if (currentStatus === 'pending') {
    return <Redirect href="/auth/pending-approval?role=admin" />;
  }

  if (
    currentStatus &&
    currentStatus !== 'approved' &&
    currentStatus !== 'active'
  ) {
    return <Redirect href="/auth/role" />;
  }

  if (!restaurantId) {
    return (
      <FadeInView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={54} color="#C8BBAA" />
          <Text style={styles.emptyTitle}>Restaurant introuvable</Text>
          <Text style={styles.emptyText}>Identifiant restaurant manquant.</Text>

          <Pressable style={styles.primaryButton} onPress={handleGoBack}>
            <Text style={styles.primaryButtonText}>Retour</Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  if (!restaurant) {
    return (
      <FadeInView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={54} color="#C8BBAA" />
          <Text style={styles.emptyTitle}>Restaurant introuvable</Text>
          <Text style={styles.emptyText}>
            {errorMessage || 'Impossible de récupérer les informations de ce restaurant.'}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
            onPress={() => fetchRestaurant(true, false)}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#111111" />
            ) : (
              <Text style={styles.primaryButtonText}>Réessayer</Text>
            )}
          </Pressable>

          <Pressable style={styles.backLink} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={16} color="#1F6F43" />
            <Text style={styles.backLinkText}>Retour aux restaurants</Text>
          </Pressable>
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
            onRefresh={() => fetchRestaurant(true, false)}
          />
        }
      >
        <View style={styles.topRow}>
          <Pressable style={styles.topButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
          </Pressable>

          <Pressable
            style={[styles.topButton, refreshing && styles.topButtonDisabled]}
            onPress={() => fetchRestaurant(true, false)}
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
          <Text style={styles.eyebrow}>Admin</Text>
          <Text style={styles.title}>
            {normalizeText(restaurant?.name, 'Restaurant')}
          </Text>
          <Text style={styles.subtitle}>
            Vue détaillée du partenaire restaurant, de son propriétaire, de son offre,
            de sa structure et de son niveau d’exploitation.
          </Text>
        </View>

        <View style={styles.liveMonitorCard}>
          <View style={styles.liveMonitorHeader}>
            <View style={styles.liveMonitorTitleWrap}>
              <Ionicons name="radio-outline" size={18} color="#245EA8" />
              <Text style={styles.liveMonitorTitle}>Restaurant Intelligence Panel</Text>
            </View>

            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>

          <Text style={styles.liveMonitorText}>
            Cette fiche premium sert de base de contrôle AFROEAT pour la qualité business,
            la conformité owner, la structure catalogue et la montée en gamme des partenaires.
          </Text>

          <Text style={styles.liveMonitorSubText}>{liveRefreshLabel}</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>
              {normalizeText(restaurant?.name, 'Restaurant AFROEAT')}
            </Text>
            <Text style={styles.heroText}>
              {normalizeText(restaurant?.cuisine, 'Cuisine non renseignée')}
            </Text>
            <Text style={styles.heroSubText}>
              {normalizeText(locationLine, 'Localisation non renseignée')}
            </Text>
          </View>

          <View style={styles.heroBadges}>
            <Badge
              label="Partenaire"
              bg="#E8F5ED"
              text="#1F6F43"
              icon="storefront-outline"
            />

            <Badge
              label={ownerStatusStyle.label}
              bg={ownerStatusStyle.bg}
              text={ownerStatusStyle.text}
              icon={ownerStatusStyle.icon}
            />

            <Badge
              label={`Risque ${operationalRiskStyle.label}`}
              bg={operationalRiskStyle.bg}
              text={operationalRiskStyle.text}
              icon={operationalRiskStyle.icon}
            />
          </View>
        </View>

        <InfoCard title="Informations générales">
          <MetaRow
            icon="storefront-outline"
            label="Nom"
            value={normalizeText(restaurant?.name, 'Non renseigné')}
          />
          <MetaRow
            icon="restaurant-outline"
            label="Cuisine"
            value={normalizeText(restaurant?.cuisine, 'Non renseigné')}
          />
          <MetaRow
            icon="location-outline"
            label="Adresse"
            value={normalizeText(restaurant?.address, 'Non renseigné')}
            multiline
          />
          <MetaRow
            icon="business-outline"
            label="Ville"
            value={normalizeText(restaurant?.city, 'Non renseigné')}
          />
          <MetaRow
            icon="earth-outline"
            label="Pays"
            value={normalizeText(restaurant?.country, 'Non renseigné')}
          />
          <MetaRow
            icon="cash-outline"
            label="Devise"
            value={normalizeText(restaurant?.currency, 'EUR')}
          />
          <MetaRow
            icon="car-outline"
            label="Livraison"
            value={formatPrice(restaurant?.deliveryFee, restaurant?.currency || 'EUR')}
          />
          <MetaRow
            icon="star-outline"
            label="Note"
            value={
              restaurant?.rating > 0
                ? Number(restaurant.rating).toFixed(1)
                : 'Non renseignée'
            }
          />
          <MetaRow
            icon="time-outline"
            label="Ouvert"
            value={restaurant?.isOpen ? 'Oui' : 'Non'}
            valueStyle={{
              color: restaurant?.isOpen ? '#1F6F43' : '#B83232',
              fontWeight: '900',
            }}
          />
        </InfoCard>

        <InfoCard title="Performance / exploitation">
          <View style={styles.statsGrid}>
            <StatBox
              label="CA estimé"
              value={formatPrice(restaurant?.revenue, restaurant?.currency || 'EUR')}
              accent="#1F6F43"
              icon="cash-outline"
            />
            <StatBox
              label="Commandes"
              value={String(restaurant?.totalOrders || 0)}
              accent="#245EA8"
              icon="receipt-outline"
            />
            <StatBox
              label="Livrées"
              value={String(restaurant?.deliveredOrders || 0)}
              accent="#1F6F43"
              icon="checkmark-circle-outline"
            />
            <StatBox
              label="Annulées"
              value={String(restaurant?.cancelledOrders || 0)}
              accent="#B83232"
              icon="close-circle-outline"
            />
            <StatBox
              label="En cours"
              value={String(restaurant?.pendingOrders || 0)}
              accent="#8A6500"
              icon="time-outline"
            />
            <StatBox
              label="Menu moyen"
              value={formatPrice(averageMenuPrice, restaurant?.currency || 'EUR')}
              accent="#6D4CDB"
              icon="analytics-outline"
            />
          </View>
        </InfoCard>

        <InfoCard title="Menu / offre commerciale">
          <MetaRow
            icon="list-outline"
            label="Éléments"
            value={String(menus.length)}
          />
          <MetaRow
            icon="grid-outline"
            label="Catégories"
            value={categories.length > 0 ? categories.join(', ') : 'Non renseigné'}
            multiline
          />
          <MetaRow
            icon="trending-down-outline"
            label="Prix mini"
            value={formatPrice(cheapestMenuPrice, restaurant?.currency || 'EUR')}
          />
          <MetaRow
            icon="trending-up-outline"
            label="Prix maxi"
            value={formatPrice(highestMenuPrice, restaurant?.currency || 'EUR')}
          />
          <MetaRow
            icon="analytics-outline"
            label="Prix moyen"
            value={formatPrice(averageMenuPrice, restaurant?.currency || 'EUR')}
          />
          <MetaRow
            icon="checkmark-done-outline"
            label="Disponibles"
            value={String(menuAvailabilityStats.availableCount)}
          />
          <MetaRow
            icon="remove-circle-outline"
            label="Indisponibles"
            value={String(menuAvailabilityStats.unavailableCount)}
          />
        </InfoCard>

        <InfoCard title="Propriétaire">
          <MetaRow
            icon="person-circle-outline"
            label="Nom"
            value={normalizeText(restaurant?.owner?.name, 'Non renseigné')}
          />
          <MetaRow
            icon="mail-outline"
            label="Email"
            value={normalizeText(restaurant?.owner?.email, 'Non renseigné')}
          />
          <MetaRow
            icon="call-outline"
            label="Téléphone"
            value={normalizeText(restaurant?.owner?.phone, 'Non renseigné')}
          />
          <MetaRow
            icon="id-card-outline"
            label="Rôle"
            value={normalizeText(restaurant?.owner?.role, 'restaurant')}
          />
          <MetaRow
            icon="shield-checkmark-outline"
            label="Statut"
            value={ownerStatusStyle.label}
            valueStyle={{ color: ownerStatusStyle.text, fontWeight: '900' }}
          />
          <MetaRow
            icon="shield-outline"
            label="Identité"
            value={ownerIdentityStyle.label}
            valueStyle={{ color: ownerIdentityStyle.text, fontWeight: '900' }}
          />
          <MetaRow
            icon="briefcase-outline"
            label="Travail"
            value={ownerWorkStyle.label}
            valueStyle={{ color: ownerWorkStyle.text, fontWeight: '900' }}
          />
        </InfoCard>

        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>Action admin</Text>
          <Text style={styles.actionsSubtitle}>
            Suspension ou réactivation du compte propriétaire du restaurant.
          </Text>

          <Pressable
            style={[
              styles.ownerActionButton,
              restaurant?.owner?.accountStatus === 'suspended' &&
                styles.ownerActionButtonSuccess,
              (updatingOwner || !restaurant?.owner?._id) &&
                styles.ownerActionButtonDisabled,
            ]}
            onPress={handleToggleOwnerStatus}
            disabled={updatingOwner || !restaurant?.owner?._id}
          >
            {updatingOwner ? (
              <ActivityIndicator size="small" color="#111111" />
            ) : (
              <>
                <Ionicons
                  name={
                    restaurant?.owner?.accountStatus === 'suspended'
                      ? 'checkmark-circle-outline'
                      : 'ban-outline'
                  }
                  size={18}
                  color="#111111"
                />
                <Text style={styles.ownerActionButtonText}>
                  {restaurant?.owner?.accountStatus === 'suspended'
                    ? 'Réactiver le propriétaire'
                    : 'Suspendre le propriétaire'}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <InfoCard title="Indicateurs admin">
          <View style={styles.flagGrid}>
            {technicalFlags.map((flag) => (
              <View key={flag.key} style={styles.flagBox}>
                <View style={styles.flagBoxTop}>
                  <Ionicons name={flag.icon} size={15} color={flag.accent} />
                  <Text style={[styles.flagBoxValue, { color: flag.accent }]}>
                    {normalizeText(flag.value, '—')}
                  </Text>
                </View>
                <Text style={styles.flagBoxLabel}>{flag.label}</Text>
              </View>
            ))}
          </View>
        </InfoCard>

        <InfoCard title="Technique">
          <MetaRow
            icon="finger-print-outline"
            label="ID"
            value={normalizeText(restaurant?._id, 'Non renseigné')}
            multiline
          />
          <MetaRow
            icon="calendar-outline"
            label="Créé le"
            value={formatDateTime(restaurant?.createdAt)}
          />
          <MetaRow
            icon="refresh-outline"
            label="Mis à jour"
            value={formatDateTime(restaurant?.updatedAt)}
          />
          <MetaRow
            icon="time-outline"
            label="Date courte"
            value={formatDate(restaurant?.createdAt)}
          />
        </InfoCard>

        {!!errorMessage ? (
          <View style={styles.softErrorCard}>
            <Ionicons name="warning-outline" size={18} color="#B83232" />
            <Text style={styles.softErrorText}>{errorMessage}</Text>
          </View>
        ) : null}
      </ScrollView>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 60,
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
  },

  loaderText: {
    marginTop: 12,
    color: '#777777',
    fontSize: 15,
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
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  topButtonDisabled: {
    opacity: 0.7,
  },

  header: {
    marginBottom: 18,
  },

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
    color: '#111111',
    marginBottom: 8,
  },

  subtitle: {
    color: '#6B655E',
    fontSize: 14,
    lineHeight: 21,
  },

  liveMonitorCard: {
    backgroundColor: '#EEF4FF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },

  liveMonitorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  liveMonitorTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  liveMonitorTitle: {
    marginLeft: 8,
    color: '#245EA8',
    fontSize: 16,
    fontWeight: '900',
  },

  liveBadge: {
    backgroundColor: '#245EA8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  liveMonitorText: {
    color: '#4F5F88',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },

  liveMonitorSubText: {
    color: '#245EA8',
    fontSize: 12,
    fontWeight: '800',
  },

  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    elevation: 2,
  },

  heroLeft: {
    flex: 1,
    paddingRight: 12,
  },

  heroTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 8,
  },

  heroText: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
  },

  heroSubText: {
    color: '#7A7268',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },

  heroBadges: {
    alignItems: 'flex-end',
  },

  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  heroBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
  },

  cardFooter: {
    marginTop: 14,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
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
    color: '#111111',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },

  metaValueMultiline: {
    lineHeight: 20,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },

  statBox: {
    width: '48%',
    marginHorizontal: '1%',
    backgroundColor: '#FAF7F2',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 10,
  },

  statBoxTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },

  statBoxValue: {
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 6,
  },

  statBoxLabel: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '700',
  },

  actionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
  },

  actionsTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 8,
  },

  actionsSubtitle: {
    color: '#6B655E',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
    fontWeight: '700',
  },

  ownerActionButton: {
    minHeight: 50,
    backgroundColor: '#D4A017',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  ownerActionButtonSuccess: {
    backgroundColor: '#CDECD7',
  },

  ownerActionButtonDisabled: {
    opacity: 0.75,
  },

  ownerActionButtonText: {
    color: '#111111',
    fontWeight: '900',
    marginLeft: 8,
    fontSize: 14,
  },

  flagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },

  flagBox: {
    width: '48%',
    marginHorizontal: '1%',
    backgroundColor: '#FAF7F2',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 10,
  },

  flagBoxTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },

  flagBoxValue: {
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 6,
  },

  flagBoxLabel: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '700',
  },

  softErrorCard: {
    marginTop: 2,
    backgroundColor: '#FDECEC',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  softErrorText: {
    marginLeft: 8,
    color: '#B83232',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
    flex: 1,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FFF8F0',
  },

  emptyTitle: {
    textAlign: 'center',
    color: '#111111',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 8,
  },

  emptyText: {
    textAlign: 'center',
    color: '#777777',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },

  primaryButton: {
    backgroundColor: '#D4A017',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonPressed: {
    opacity: 0.9,
  },

  primaryButtonText: {
    color: '#111111',
    fontWeight: '900',
    fontSize: 15,
  },

  backLink: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },

  backLinkText: {
    marginLeft: 8,
    color: '#1F6F43',
    fontSize: 14,
    fontWeight: '800',
  },
});