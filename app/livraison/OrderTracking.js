import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Pressable,
  Linking,
  Alert,
} from 'react-native';
import MapView, { Marker, Polyline } from '../../components/AppMapView';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  Redirect,
} from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import {
  getDeliveryOrderById,
  calculateDistanceKm,
  calculateETA,
  formatEtaLabel,
} from '../../services/deliveryService';
import i18n from '../../i18n';

/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const LIVE_REFRESH_MS = 5000;
const DEFAULT_LAT_DELTA = 0.015;
const DEFAULT_LNG_DELTA = 0.015;

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

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

const normalizeStatus = (value) => String(value || '').trim();

const isDriverRole = (role) =>
  role === 'livreur' || role === 'driver' || role === 'delivery';

const getSafeParam = (value, fallback = '') => {
  if (Array.isArray(value)) return value[0] ?? fallback;
  if (value === undefined || value === null) return fallback;
  return String(value);
};

const isValidCoordinate = (value) => typeof value === 'number' && Number.isFinite(value);

const normalizeCoords = (location) => {
  if (!location || typeof location !== 'object') return null;

  const lat = normalizeNumber(
    location?.lat ?? location?.latitude,
    NaN
  );
  const lng = normalizeNumber(
    location?.lng ?? location?.longitude,
    NaN
  );

  if (!isValidCoordinate(lat) || !isValidCoordinate(lng)) {
    return null;
  }

  return { lat, lng };
};

const normalizeOrderResponse = (data) => {
  if (!data || typeof data !== 'object') return null;

  const order = data?.order || data?.data?.order || data?.data || data;

  if (!order || typeof order !== 'object') return null;

  return {
    ...order,
    _id: order?._id || order?.id || null,
    id: order?.id || order?._id || null,
    status: normalizeStatus(order?.status || 'En attente'),
    restaurantName: normalizeText(
      order?.restaurantName || order?.restaurant?.name,
      i18n.t('livraison.tracking.restaurantFallback')
    ),
    deliveryAddress: normalizeText(order?.deliveryAddress),
    totalPrice: normalizeNumber(order?.totalPrice, 0),
    currency: normalizeText(order?.currency, 'EUR'),
    createdAt: order?.createdAt || null,
    updatedAt: order?.updatedAt || null,
    driverLocation: normalizeCoords(order?.driverLocation),
    customerLocation: normalizeCoords(order?.customerLocation),
    items: Array.isArray(order?.items) ? order.items : [],
  };
};

const formatPrice = (value, currency = 'EUR') => {
  const amount = normalizeNumber(value, 0);
  const safeCurrency = normalizeText(currency, 'EUR').toUpperCase();

  if (safeCurrency === 'USD') return `$${amount.toFixed(2)}`;
  if (safeCurrency === 'GBP') return `£${amount.toFixed(2)}`;
  if (safeCurrency === 'CAD') return `${amount.toFixed(2)} $CA`;
  if (safeCurrency === 'XOF' || safeCurrency === 'XAF') {
    return `${amount.toFixed(0)} ${safeCurrency}`;
  }

  return `${amount.toFixed(2)} €`;
};

const DATE_LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-ES', it: 'it-IT', zh: 'zh-CN' };

const formatDateTime = (value) => {
  if (!value) return i18n.t('livraison.history.dateUnavailable');

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return i18n.t('livraison.history.dateUnavailable');
  }

  return date.toLocaleString(DATE_LOCALE_MAP[i18n.language] || 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const DELIVERY_STATUS_SLUG = {
  'En attente': 'order.status.pending',
  'Confirmée': 'livraison.status.confirmed',
  'En préparation': 'livraison.status.preparing',
  'En livraison': 'livraison.status.delivering',
  'Livrée': 'livraison.status.delivered',
  'Annulée': 'order.status.cancelled',
};

const getStatusTone = (status) => {
  switch (status) {
    case 'Livrée':
      return {
        bg: '#E8F5ED',
        text: '#1F6F43',
        icon: 'checkmark-circle',
      };
    case 'En livraison':
      return {
        bg: '#EAF3FF',
        text: '#245EA8',
        icon: 'bicycle',
      };
    case 'En préparation':
      return {
        bg: '#FFF3D8',
        text: '#8A6500',
        icon: 'restaurant',
      };
    case 'Confirmée':
      return {
        bg: '#EFE9FF',
        text: '#6D4CDB',
        icon: 'checkmark-done',
      };
    case 'Annulée':
      return {
        bg: '#FDECEC',
        text: '#B83232',
        icon: 'close-circle',
      };
    case 'En attente':
    default:
      return {
        bg: '#FFF4E8',
        text: '#D96C2D',
        icon: 'time-outline',
      };
  }
};

const getStatusProgress = (status) => {
  switch (status) {
    case 'En attente':
      return 10;
    case 'Confirmée':
      return 25;
    case 'En préparation':
      return 45;
    case 'En livraison':
      return 72;
    case 'Livrée':
      return 100;
    case 'Annulée':
      return 0;
    default:
      return 0;
  }
};

const getDriverInsight = ({ status, distance, etaMinutes, t }) => {
  if (status === 'Livrée') {
    return t('livraison.tracking.insightDelivered');
  }

  if (status === 'Annulée') {
    return t('livraison.tracking.insightCancelled');
  }

  if (distance === null) {
    return t('livraison.tracking.insightNoGps');
  }

  if (distance < 0.4) {
    return t('livraison.tracking.insightAlmostArrived');
  }

  if (distance < 1.2) {
    return t('livraison.tracking.insightImminent');
  }

  if (distance < 3) {
    return t('livraison.tracking.insightSmooth', { minutes: etaMinutes });
  }

  if (distance < 6) {
    return t('livraison.tracking.insightOnTrack');
  }

  return t('livraison.tracking.insightLongTrip');
};

const getSmartEta = (distance, t) => {
  if (distance === null) {
    return {
      label: t('livraison.tracking.etaUnavailable'),
      minutes: null,
    };
  }

  const baseMinutes = normalizeNumber(calculateETA(distance), 0);
  const trafficFactor = distance > 5 ? 1.18 : distance > 2 ? 1.1 : 1;
  const adjustedMinutes = Math.max(1, Math.round(baseMinutes * trafficFactor));

  return {
    label: formatEtaLabel(adjustedMinutes),
    minutes: adjustedMinutes,
  };
};

const getInitialRegion = (driver, customer) => {
  if (driver) {
    return {
      latitude: driver.lat,
      longitude: driver.lng,
      latitudeDelta: DEFAULT_LAT_DELTA,
      longitudeDelta: DEFAULT_LNG_DELTA,
    };
  }

  if (customer) {
    return {
      latitude: customer.lat,
      longitude: customer.lng,
      latitudeDelta: DEFAULT_LAT_DELTA,
      longitudeDelta: DEFAULT_LNG_DELTA,
    };
  }

  return {
    latitude: 48.8566,
    longitude: 2.3522,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };
};

const getCoordsPair = (driver, customer) => {
  const coords = [];

  if (driver) {
    coords.push({
      latitude: driver.lat,
      longitude: driver.lng,
    });
  }

  if (customer) {
    coords.push({
      latitude: customer.lat,
      longitude: customer.lng,
    });
  }

  return coords;
};

const getItemsCount = (items) => {
  if (!Array.isArray(items)) return 0;

  return items.reduce((sum, current) => {
    return sum + normalizeNumber(current?.quantity, 0);
  }, 0);
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function OrderTrackingScreen() {
  const { t, i18n: i18nInstance } = useTranslation();
  const params = useLocalSearchParams();
  const auth = useAuth() || {};

  const mapRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  const token = auth.token;
  const user = auth.user ?? null;
  const role = auth.role;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role || '');
  }, [role, user]);

  const safeOrderId = useMemo(() => {
    return getSafeParam(params?.orderId) || getSafeParam(params?.id) || null;
  }, [params]);

  const safeOrder = useMemo(() => {
    return normalizeOrderResponse(order);
  }, [order]);

  const driver = useMemo(() => {
    return safeOrder?.driverLocation || null;
  }, [safeOrder]);

  const customer = useMemo(() => {
    return safeOrder?.customerLocation || null;
  }, [safeOrder]);

  const itemCount = useMemo(() => {
    return getItemsCount(safeOrder?.items);
  }, [safeOrder]);

  const distance = useMemo(() => {
    if (!driver || !customer) return null;
    return calculateDistanceKm(driver, customer);
  }, [driver, customer]);

  const smartEta = useMemo(() => {
    return getSmartEta(distance, t);
  }, [distance, t, i18nInstance.language]);

  const progress = useMemo(() => {
    if (safeOrder?.status === 'En livraison' && distance !== null) {
      const liveProgress = Math.max(
        72,
        Math.min(97, Math.round(100 - distance * 8))
      );

      return liveProgress;
    }

    return getStatusProgress(safeOrder?.status);
  }, [safeOrder, distance]);

  const routeCoords = useMemo(() => {
    return getCoordsPair(driver, customer);
  }, [driver, customer]);

  const initialRegion = useMemo(() => {
    return getInitialRegion(driver, customer);
  }, [driver, customer]);

  const driverInsight = useMemo(() => {
    return getDriverInsight({
      status: safeOrder?.status,
      distance,
      etaMinutes: smartEta?.minutes,
      t,
    });
  }, [safeOrder, distance, smartEta, t, i18nInstance.language]);

  const statusTone = useMemo(() => {
    return getStatusTone(safeOrder?.status);
  }, [safeOrder]);

  const driverLocationLabel = useMemo(() => {
    if (!driver) return t('livraison.tracking.gpsUnavailable');
    return `${driver.lat.toFixed(5)}, ${driver.lng.toFixed(5)}`;
  }, [driver, t]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/livraison/orders');
  }, []);

  const fitMapToMarkers = useCallback(() => {
    if (!mapRef.current || routeCoords.length === 0) return;

    mapRef.current.fitToCoordinates(routeCoords, {
      edgePadding: {
        top: 120,
        right: 60,
        bottom: 300,
        left: 60,
      },
      animated: true,
    });
  }, [routeCoords]);

  const fetchOrder = useCallback(
    async (manual = false) => {
      if (!safeOrderId || !token || !isDriverRole(currentRole)) {
        setOrder(null);
        setErrorMessage('');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        if (manual) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage('');

        const data = await getDeliveryOrderById(safeOrderId, token);
        const normalized = normalizeOrderResponse(data);

        if (!normalized?._id) {
          throw new Error(t('livraison.tracking.notFoundError'));
        }

        setOrder(normalized);
      } catch (error) {
        console.log('Erreur tracking livraison :', error);

        const message =
          error?.message || t('livraison.tracking.errorFetchDefault');

        setErrorMessage(message);
        setOrder(null);

        if (manual) {
          Alert.alert(t('common.error'), message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [safeOrderId, token, currentRole]
  );

  useFocusEffect(
    useCallback(() => {
      fetchOrder(false);

      if (!safeOrderId || !token || !isDriverRole(currentRole)) {
        return undefined;
      }

      refreshIntervalRef.current = setInterval(() => {
        fetchOrder(true);
      }, LIVE_REFRESH_MS);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    }, [fetchOrder, safeOrderId, token, currentRole])
  );

  useEffect(() => {
    if (driver && customer) {
      const timeout = setTimeout(() => {
        fitMapToMarkers();
      }, 250);

      return () => clearTimeout(timeout);
    }

    return undefined;
  }, [driver, customer, fitMapToMarkers]);

  const handleOpenExternalNavigation = useCallback(async () => {
    if (!customer) {
      Alert.alert(
        t('livraison.tracking.navUnavailableTitle'),
        t('livraison.tracking.navUnavailableBody')
      );
      return;
    }

    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${customer.lat},${customer.lng}&travelmode=driving`;

    try {
      const supported = await Linking.canOpenURL(googleMapsUrl);

      if (!supported) {
        throw new Error(t('livraison.tracking.navAppUnavailable'));
      }

      await Linking.openURL(googleMapsUrl);
    } catch (error) {
      Alert.alert(
        t('livraison.tracking.navUnavailableTitle'),
        error?.message || t('livraison.tracking.navOpenErrorFallback')
      );
    }
  }, [customer, t]);

  /**
   * =========================================================
   * GUARDS
   * =========================================================
   */

  if (authLoading || loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7F8FA" />
        <ActivityIndicator size="large" color="#D96C2D" />
        <Text style={styles.loaderText}>{t('livraison.tracking.loadingTitle')}</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login?role=livreur" />;
  }

  if (!isDriverRole(currentRole)) {
    if (currentRole === 'restaurant') {
      return <Redirect href="/restaurant/RestaurantDashboard" />;
    }

    if (currentRole === 'admin') {
      return <Redirect href="/admin" />;
    }

    return <Redirect href="/(tabs)/index" />;
  }

  if (!safeOrder) {
    return (
      <FadeInView style={styles.fallbackContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7F8FA" />

        <View style={styles.fallbackBox}>
          <MaterialCommunityIcons
            name="map-marker-off-outline"
            size={56}
            color="#C7CED6"
          />
          <Text style={styles.fallbackTitle}>{t('livraison.tracking.fallbackTitle')}</Text>
          <Text style={styles.fallbackText}>
            {errorMessage || t('livraison.tracking.fallbackTextDefault')}
          </Text>

          <View style={styles.fallbackActions}>
            <Pressable style={styles.secondaryButton} onPress={handleGoBack}>
              <Text style={styles.secondaryButtonText}>{t('livraison.tracking.backButton')}</Text>
            </Pressable>

            <Pressable
              style={styles.primaryButton}
              onPress={() => fetchOrder(true)}
            >
              <Text style={styles.primaryButtonText}>{t('livraison.tracking.retryButton')}</Text>
            </Pressable>
          </View>
        </View>
      </FadeInView>
    );
  }

  /**
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FA" />

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled
        pitchEnabled
      >
        {routeCoords.length >= 2 && (
          <Polyline
            coordinates={routeCoords}
            strokeWidth={5}
            strokeColor="#D96C2D"
            lineCap="round"
            lineJoin="round"
          />
        )}

        {driver && (
          <Marker
            coordinate={{
              latitude: driver.lat,
              longitude: driver.lng,
            }}
            title={t('livraison.tracking.markerDriverTitle')}
            description={t('livraison.tracking.markerDriverDescription')}
            pinColor="#D96C2D"
          />
        )}

        {customer && (
          <Marker
            coordinate={{
              latitude: customer.lat,
              longitude: customer.lng,
            }}
            title={t('livraison.tracking.markerCustomerTitle')}
            description={safeOrder?.deliveryAddress || t('livraison.tracking.markerCustomerDescriptionFallback')}
            pinColor="#1F8F4C"
          />
        )}
      </MapView>

      <View style={styles.topBar}>
        <Pressable style={styles.topButton} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={20} color="#111111" />
        </Pressable>

        <Pressable
          style={styles.topButton}
          onPress={() => fetchOrder(true)}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#111111" />
          ) : (
            <Ionicons name="refresh-outline" size={20} color="#111111" />
          )}
        </Pressable>
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.panelTitle}>{t('livraison.tracking.panelTitle')}</Text>
            <Text style={styles.panelSubtitle}>
              {t('livraison.history.orderReference', { ref: String(safeOrder?._id || '').slice(-6).toUpperCase() })}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusTone.bg }]}>
            <Ionicons
              name={statusTone.icon}
              size={14}
              color={statusTone.text}
            />
            <Text style={[styles.statusBadgeText, { color: statusTone.text }]}>
              {t(DELIVERY_STATUS_SLUG[safeOrder?.status] || 'order.status.pending', safeOrder?.status || '')}
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{t('livraison.tracking.distanceLabel')}</Text>
            <Text style={styles.metricValue}>
              {distance !== null ? `${distance} km` : '--'}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{t('livraison.tracking.etaSmartLabel')}</Text>
            <Text style={styles.metricValue}>{smartEta.label}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{t('livraison.tracking.progressLabel')}</Text>
            <Text style={styles.metricValue}>{Math.round(progress)}%</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <View style={styles.insightCard}>
          <Ionicons name="sparkles-outline" size={16} color="#D96C2D" />
          <Text style={styles.insightText}>{driverInsight}</Text>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>{t('livraison.tracking.restaurantLabel')}</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {safeOrder.restaurantName}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>{t('livraison.tracking.amountLabel')}</Text>
            <Text style={styles.metaValue}>
              {formatPrice(safeOrder.totalPrice, safeOrder.currency)}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>{t('livraison.history.articlesLabel')}</Text>
            <Text style={styles.metaValue}>{itemCount}</Text>
          </View>

          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>{t('livraison.tracking.lastUpdateLabel')}</Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {formatDateTime(safeOrder.updatedAt || safeOrder.createdAt)}
            </Text>
          </View>
        </View>

        <View style={styles.locationBox}>
          <View style={styles.locationRow}>
            <Ionicons name="navigate-outline" size={15} color="#245EA8" />
            <Text style={styles.locationLabel}>{t('livraison.tracking.driverPositionLabel')}</Text>
            <Text style={styles.locationValue}>{driverLocationLabel}</Text>
          </View>

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={15} color="#1F8F4C" />
            <Text style={styles.locationLabel}>{t('livraison.tracking.destinationLabel')}</Text>
            <Text style={styles.locationValue} numberOfLines={1}>
              {normalizeText(safeOrder.deliveryAddress, t('livraison.tracking.addressUnavailable'))}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.secondaryButton} onPress={fitMapToMarkers}>
            <Ionicons name="expand-outline" size={18} color="#245EA8" />
            <Text style={styles.secondaryButtonText}>{t('livraison.tracking.recenterButton')}</Text>
          </Pressable>

          <Pressable
            style={styles.primaryButton}
            onPress={handleOpenExternalNavigation}
          >
            <Ionicons name="navigate" size={18} color="#111111" />
            <Text style={styles.primaryButtonText}>{t('livraison.tracking.openGpsButton')}</Text>
          </Pressable>
        </View>
      </View>
    </FadeInView>
  );
}

/**
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  fallbackContainer: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  fallbackBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  fallbackTitle: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: '900',
    color: '#111111',
    textAlign: 'center',
  },

  fallbackText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
    textAlign: 'center',
  },

  fallbackActions: {
    flexDirection: 'row',
    marginTop: 18,
  },

  loader: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loaderText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 15,
  },

  map: {
    flex: 1,
  },

  topBar: {
    position: 'absolute',
    top: 52,
    left: 18,
    right: 18,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  topButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },

  bottomPanel: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },

  headerTextBlock: {
    flex: 1,
    paddingRight: 10,
  },

  panelTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 4,
  },

  panelSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  statusBadgeText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '900',
  },

  metricsRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },

  metricCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginHorizontal: 4,
  },

  metricLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  metricValue: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '900',
  },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#EEF2F7',
    overflow: 'hidden',
    marginBottom: 14,
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#D96C2D',
  },

  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 14,
  },

  insightText: {
    flex: 1,
    marginLeft: 8,
    color: '#9A3412',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },

  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },

  metaItem: {
    width: '50%',
    paddingVertical: 8,
    paddingRight: 10,
  },

  metaLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  metaValue: {
    fontSize: 13,
    color: '#111111',
    fontWeight: '800',
  },

  locationBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
  },

  locationLabel: {
    marginLeft: 8,
    color: '#475569',
    fontSize: 12,
    fontWeight: '800',
    width: 110,
  },

  locationValue: {
    flex: 1,
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },

  actionsRow: {
    flexDirection: 'row',
  },

  primaryButton: {
    flex: 1,
    marginLeft: 6,
    backgroundColor: '#D4A017',
    borderRadius: 16,
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  primaryButtonText: {
    marginLeft: 8,
    color: '#111111',
    fontSize: 15,
    fontWeight: '900',
  },

  secondaryButton: {
    flex: 1,
    marginRight: 6,
    backgroundColor: '#EEF4FF',
    borderRadius: 16,
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  secondaryButtonText: {
    marginLeft: 8,
    color: '#245EA8',
    fontSize: 15,
    fontWeight: '900',
  },
});