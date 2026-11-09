import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  StatusBar,
  Alert,
  ScrollView,
  RefreshControl,
  Switch,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../../../components/FadeInView';
import { useAuth } from '../../../context/AuthContext';
import {
  getAdminDrivers,
  updateAdminUserStatus,
  updateAdminUserVerification,
} from '../../../services/adminService';
import i18n from '../../../i18n';

const LIVE_REFRESH_MS = 15000;

const DATE_LOCALE_MAP = {
  fr: 'fr-FR',
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
  zh: 'zh-CN',
};

const normalizeText = (value, fallback = '') => {
  const normalized = String(value || '').trim();
  return normalized || fallback;
};

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(DATE_LOCALE_MAP[i18n.language] || 'fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) return i18n.t('admin.ops.dateUnavailable');

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return i18n.t('admin.ops.dateUnavailable');
  }

  return date.toLocaleString(DATE_LOCALE_MAP[i18n.language] || 'fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getStatusStyle = (status, t) => {
  switch (String(status || '').toLowerCase()) {
    case 'active':
      return {
        bg: '#E3F0E8',
        text: '#084424',
        label: t('admin.users.statusActiveLabel'),
        icon: 'checkmark-circle-outline',
      };
    case 'suspended':
      return {
        bg: '#F8E1DD',
        text: '#C8331A',
        label: t('admin.users.statusSuspendedLabel'),
        icon: 'ban-outline',
      };
    case 'pending_verification':
      return {
        bg: '#F3E7CA',
        text: '#301904',
        label: t('admin.users.statusPendingLabel'),
        icon: 'time-outline',
      };
    case 'rejected':
      return {
        bg: '#F2ECE0',
        text: '#084424',
        label: t('admin.users.statusRejectedLabel'),
        icon: 'close-circle-outline',
      };
    default:
      return {
        bg: '#F2ECE0',
        text: '#555',
        label: t('admin.users.statusUnknownLabel'),
        icon: 'help-circle-outline',
      };
  }
};

const getDriverRiskStyle = (driver, t) => {
  if (!driver) {
    return {
      bg: '#F2ECE0',
      text: '#555',
      label: t('admin.users.statusUnknownLabel'),
      icon: 'help-circle-outline',
    };
  }

  if (driver?.accountStatus === 'suspended' || driver?.accountStatus === 'rejected') {
    return {
      bg: '#F8E1DD',
      text: '#C8331A',
      label: t('admin.restaurantDetails.riskHighLabel'),
      icon: 'alert-circle-outline',
    };
  }

  if (!driver?.isIdentityVerified || !driver?.isWorkAuthorized) {
    return {
      bg: '#F3E7CA',
      text: '#301904',
      label: t('admin.restaurantDetails.riskMediumLabel'),
      icon: 'warning-outline',
    };
  }

  return {
    bg: '#E3F0E8',
    text: '#084424',
    label: t('admin.restaurantDetails.riskLowLabel'),
    icon: 'checkmark-circle-outline',
  };
};

const normalizeDriver = (driver) => {
  if (!driver || typeof driver !== 'object') {
    return null;
  }

  const fullName = `${normalizeText(driver?.firstName)} ${normalizeText(
    driver?.lastName
  )}`.trim();

  return {
    ...driver,
    _id: driver?._id || driver?.id || null,
    name: normalizeText(driver?.name || fullName, i18n.t('admin.drivers.driverNameFallback')),
    email: normalizeText(driver?.email),
    phone: normalizeText(driver?.phone),
    accountStatus: normalizeText(driver?.accountStatus, 'unknown'),
    createdAt: driver?.createdAt || null,
    updatedAt: driver?.updatedAt || null,
    isIdentityVerified: Boolean(driver?.isIdentityVerified),
    isWorkAuthorized: Boolean(driver?.isWorkAuthorized),
    isAvailable: Boolean(driver?.isAvailable),
    city: normalizeText(driver?.city || driver?.addressCity),
    country: normalizeText(driver?.country),
    vehicleType: normalizeText(driver?.vehicleType || driver?.vehicle),
    rating: normalizeNumber(driver?.rating, 0),
    completedDeliveries: normalizeNumber(
      driver?.completedDeliveries || driver?.deliveriesCompleted,
      0
    ),
    currentOrderId:
      driver?.currentOrder?._id ||
      driver?.currentOrderId ||
      driver?.activeOrder?._id ||
      null,
    currentOrderStatus:
      driver?.currentOrder?.status || driver?.currentOrderStatus || '',
    earningsToday: normalizeNumber(driver?.earningsToday, 0),
    earningsWeek: normalizeNumber(driver?.earningsWeek, 0),
    acceptanceRate: normalizeNumber(driver?.acceptanceRate, 0),
    completionRate: normalizeNumber(driver?.completionRate, 0),
    lastSeenAt: driver?.lastSeenAt || driver?.updatedAt || null,
  };
};

const MetricCard = ({ label, value, icon, tint = '#084424' }) => (
  <View style={styles.metricCard}>
    <View style={[styles.metricIconWrap, { backgroundColor: `${tint}14` }]}>
      <Ionicons name={icon} size={18} color={tint} />
    </View>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const InfoCard = ({ title, children }) => (
  <View style={styles.infoCard}>
    <Text style={styles.infoCardTitle}>{title}</Text>
    {children}
  </View>
);

const MetaRow = ({ icon, label, value, multiline = false, valueStyle }) => (
  <View style={styles.metaRow}>
    <Ionicons name={icon} size={16} color="#606D5D" />
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

const FlagBox = ({ label, value, accent, icon }) => (
  <View style={styles.flagBox}>
    <View style={styles.flagHeader}>
      {icon ? <Ionicons name={icon} size={15} color={accent || '#111'} /> : null}
      <Text style={[styles.flagValue, accent ? { color: accent } : null]}>
        {value}
      </Text>
    </View>
    <Text style={styles.flagLabel}>{label}</Text>
  </View>
);

export default function AdminDriverDetailsScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();
  const { token, isAuthenticated, role, user } = useAuth();

  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastLiveRefresh, setLastLiveRefresh] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [draftIdentityVerified, setDraftIdentityVerified] = useState(null);
  const [draftWorkAuthorized, setDraftWorkAuthorized] = useState(null);
  const [verificationNote, setVerificationNote] = useState('');
  const [updatingVerification, setUpdatingVerification] = useState(false);

  const driverId = normalizeText(Array.isArray(id) ? id[0] : id);
  const currentRole = useMemo(() => {
    return String(role || user?.role || '').toLowerCase();
  }, [role, user]);

  const canAccess = isAuthenticated && currentRole === 'admin';

  const fetchDriver = useCallback(
    async (manual = false, silent = false) => {
      if (!isAuthenticated || !token || !driverId) {
        setDriver(null);
        setErrorMessage(!driverId ? t('admin.driverDetails.invalidDriverAlert') : t('admin.users.invalidSessionAlert'));
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

        const response = await getAdminDrivers(token, {
          page: 1,
          limit: 100,
          sort: 'recent',
        });

        const rawItems = Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response?.drivers)
          ? response.drivers
          : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response)
          ? response
          : [];

        const safeDrivers = rawItems.map(normalizeDriver).filter(Boolean);

        const matchedDriver =
          safeDrivers.find((item) => item?._id === driverId) || null;

        if (!matchedDriver) {
          throw new Error(t('admin.driverDetails.driverNotFoundFallback'));
        }

        setDriver(matchedDriver);
        setLastLiveRefresh(new Date().toISOString());
      } catch (error) {
        console.log('Erreur admin driver details :', error);

        const message =
          error?.message || t('admin.driverDetails.fetchErrorFallback');

        if (!silent) {
          setDriver(null);
        }

        setErrorMessage(message);

        if (manual) {
          Alert.alert(t('common.error'), message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setInitialLoaded(true);
      }
    },
    [isAuthenticated, token, driverId, t]
  );

  // Réinitialise les brouillons quand on change de livreur (ajustement d'état
  // pendant le rendu, plutôt que dans un effet).
  const [draftDriverId, setDraftDriverId] = useState(driverId);
  if (draftDriverId !== driverId) {
    setDraftDriverId(driverId);
    setDraftIdentityVerified(null);
    setDraftWorkAuthorized(null);
    setVerificationNote('');
  }

  useFocusEffect(
    useCallback(() => {
      fetchDriver(false, false);
    }, [fetchDriver])
  );

  useEffect(() => {
    if (!canAccess || !token || !driverId) {
      return undefined;
    }

    const interval = setInterval(() => {
      fetchDriver(false, true);
    }, LIVE_REFRESH_MS);

    return () => clearInterval(interval);
  }, [canAccess, token, driverId, fetchDriver]);

  const identityVerificationDraft =
    draftIdentityVerified ?? Boolean(driver?.isIdentityVerified);
  const workAuthorizationDraft =
    draftWorkAuthorized ?? Boolean(driver?.isWorkAuthorized);
  const verificationChanged = Boolean(driver) && (
    identityVerificationDraft !== Boolean(driver?.isIdentityVerified) ||
    workAuthorizationDraft !== Boolean(driver?.isWorkAuthorized)
  );

  const statusStyle = useMemo(() => getStatusStyle(driver?.accountStatus, t), [driver, t]);
  const riskStyle = useMemo(() => getDriverRiskStyle(driver, t), [driver, t]);

  const liveRefreshLabel = useMemo(() => {
    if (!lastLiveRefresh) {
      return t('admin.ops.liveRefreshWaiting');
    }

    return t('admin.ops.liveRefreshLabel', { date: formatDateTime(lastLiveRefresh) });
  }, [lastLiveRefresh, t]);

  const quickFlags = useMemo(() => {
    return [
      {
        key: 'status',
        label: t('admin.driverDetails.statusAccountLabel'),
        value: statusStyle.label,
        accent: statusStyle.text,
        icon: statusStyle.icon,
      },
      {
        key: 'identity',
        label: t('admin.restaurantDetails.identityFieldLabel'),
        value: driver?.isIdentityVerified ? t('admin.driverDetails.identityVerifiedValue') : t('admin.driverDetails.identityToVerifyValue'),
        accent: driver?.isIdentityVerified ? '#084424' : '#301904',
        icon: 'shield-checkmark-outline',
      },
      {
        key: 'work',
        label: t('admin.driverDetails.authorizationLabel'),
        value: driver?.isWorkAuthorized ? t('admin.driverDetails.workValidValue') : t('admin.driverDetails.workMissingValue'),
        accent: driver?.isWorkAuthorized ? '#084424' : '#C8331A',
        icon: 'briefcase-outline',
      },
      {
        key: 'availability',
        label: t('admin.driverDetails.availabilityLabel'),
        value: driver?.isAvailable ? t('admin.driverDetails.availableValue') : t('admin.driverDetails.offlineValue'),
        accent: driver?.isAvailable ? '#084424' : '#666',
        icon: 'radio-outline',
      },
      {
        key: 'risk',
        label: t('admin.driverDetails.riskLabel'),
        value: riskStyle.label,
        accent: riskStyle.text,
        icon: riskStyle.icon,
      },
      {
        key: 'mission',
        label: t('admin.driverDetails.activeMissionLabel'),
        value: driver?.currentOrderId ? t('admin.userDetails.yesLabel') : t('admin.userDetails.noLabel'),
        accent: driver?.currentOrderId ? '#084424' : '#666',
        icon: 'bicycle-outline',
      },
    ];
  }, [driver, riskStyle, statusStyle, t]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/admin/drivers');
  }, []);

  const handleToggleStatus = useCallback(() => {
    if (!token || !driver?._id) {
      Alert.alert(t('common.error'), t('admin.driverDetails.updateErrorFallback'));
      return;
    }

    const nextStatus =
      driver?.accountStatus === 'suspended' ? 'active' : 'suspended';

    const actionLabel = nextStatus === 'active' ? t('admin.users.reactivateAction') : t('admin.users.suspendAction');

    Alert.alert(
      t('admin.users.confirmDialogTitle'),
      t('admin.users.confirmDialogMessage', { action: actionLabel, identity: normalizeText(driver?.name, t('admin.driverDetails.defaultDriverIdentity')) }),
      [
        { text: t('admin.users.cancelAction'), style: 'cancel' },
        {
          text: t('admin.users.confirmDialogTitle'),
          onPress: async () => {
            try {
              setUpdatingStatus(true);

              const response = await updateAdminUserStatus(
                driver._id,
                nextStatus,
                token
              );

              const updatedDriver = normalizeDriver(
                response?.user || response?.driver || null
              );

              setDriver((prev) => ({
                ...(prev || {}),
                ...(updatedDriver || {}),
                accountStatus: updatedDriver?.accountStatus || nextStatus,
              }));

              Alert.alert(
                t('common.success'),
                response?.message || t('admin.driverDetails.successFallback')
              );
            } catch (error) {
              console.log('Erreur update admin driver status :', error);
              Alert.alert(
                t('common.error'),
                error?.message || t('admin.driverDetails.updateErrorFallback')
              );
            } finally {
              setUpdatingStatus(false);
            }
          },
        },
      ]
    );
  }, [driver, token, t]);

  const handleSaveVerification = useCallback(async () => {
    if (!token || !driver?._id) {
      Alert.alert(t('common.error'), t('admin.driverDetails.verificationErrorFallback'));
      return;
    }

    const note = verificationNote.trim();
    if (note.length < 8 || note.length > 500) {
      Alert.alert(t('common.error'), t('admin.driverDetails.verificationNoteRequired'));
      return;
    }

    if (workAuthorizationDraft && !identityVerificationDraft) {
      Alert.alert(t('common.error'), t('admin.driverDetails.verificationWorkNeedsIdentity'));
      return;
    }

    try {
      setUpdatingVerification(true);
      const response = await updateAdminUserVerification(
        driver._id,
        {
          isIdentityVerified: identityVerificationDraft,
          isWorkAuthorized: workAuthorizationDraft,
          note,
        },
        token
      );
      const updatedDriver = normalizeDriver(response?.user || null);

      setDriver((previous) => ({
        ...(previous || {}),
        ...(updatedDriver || {}),
        isIdentityVerified: identityVerificationDraft,
        isWorkAuthorized: workAuthorizationDraft,
      }));
      setDraftIdentityVerified(identityVerificationDraft);
      setDraftWorkAuthorized(workAuthorizationDraft);
      setVerificationNote('');
      setErrorMessage('');

      Alert.alert(
        t('common.success'),
        response?.message || t('admin.driverDetails.verificationSavedMessage')
      );
    } catch (error) {
      console.log('Erreur vérification admin livreur :', error);
      Alert.alert(
        t('common.error'),
        error?.message || t('admin.driverDetails.verificationErrorFallback')
      );
    } finally {
      setUpdatingVerification(false);
    }
  }, [
    driver,
    token,
    t,
    identityVerificationDraft,
    workAuthorizationDraft,
    verificationNote,
  ]);

  const handleOpenCurrentOrder = useCallback(() => {
    if (!driver?.currentOrderId) {
      Alert.alert(t('admin.driverDetails.infoAlertTitle'), t('admin.driverDetails.noActiveOrderAlert'));
      return;
    }

    router.push({
      pathname: '/admin/orders-details/[id]',
      params: { id: driver.currentOrderId },
    });
  }, [driver, t]);

  if (loading && !initialLoaded) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <ActivityIndicator size="large" color="#084424" />
        <Text style={styles.loaderText}>{t('admin.driverDetails.loaderText')}</Text>
      </View>
    );
  }

  if (!canAccess) {
    return (
      <FadeInView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <View style={styles.emptyContainer}>
          <Ionicons name="shield-outline" size={56} color="#606D5D" />
          <Text style={styles.emptyTitle}>{t('admin.orders.restrictedTitle')}</Text>
          <Text style={styles.emptyText}>
            {t('admin.driverDetails.restrictedText')}
          </Text>
        </View>
      </FadeInView>
    );
  }

  if (!driver) {
    return (
      <FadeInView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={56} color="#EAB02F" />
          <Text style={styles.emptyTitle}>{t('admin.driverDetails.notFoundTitle')}</Text>
          <Text style={styles.emptyText}>
            {errorMessage || t('admin.driverDetails.fetchErrorFallback')}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={() => fetchDriver(true, false)}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                <Text style={styles.retryButtonText}>{t('restaurant.retry')}</Text>
              </>
            )}
          </Pressable>

          <Pressable style={styles.backLink} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={16} color="#084424" />
            <Text style={styles.backLinkText}>{t('admin.driverDetails.backToDriversLink')}</Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  return (
    <FadeInView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchDriver(true, false)} />
        }
      >
        <View style={styles.topRow}>
          <Pressable style={styles.topButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={20} color="#0D1C11" />
          </Pressable>

          <Pressable
            style={[styles.topButton, refreshing && styles.topButtonDisabled]}
            onPress={() => fetchDriver(true, false)}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#0D1C11" />
            ) : (
              <Ionicons name="refresh-outline" size={20} color="#0D1C11" />
            )}
          </Pressable>
        </View>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>{t('admin.restaurantDetails.eyebrow')}</Text>
          <Text style={styles.title}>{t('admin.driverDetails.titleDriverDetail')}</Text>
          <Text style={styles.subtitle}>
            {t('admin.driverDetails.subtitleDriver')}
          </Text>
        </View>

        <View style={styles.liveMonitorCard}>
          <View style={styles.liveMonitorHeader}>
            <View style={styles.liveMonitorTitleWrap}>
              <Ionicons name="radio-outline" size={18} color="#084424" />
              <Text style={styles.liveMonitorTitle}>{t('admin.driverDetails.liveMonitorTitleDriver')}</Text>
            </View>

            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>

          <Text style={styles.liveMonitorText}>
            {t('admin.driverDetails.liveMonitorTextDriver')}
          </Text>

          <Text style={styles.liveMonitorSubText}>{liveRefreshLabel}</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>
              {normalizeText(driver?.name, t('admin.drivers.driverNameFallback'))}
            </Text>
            <Text style={styles.heroText}>
              {normalizeText(driver?.email, t('admin.driverDetails.emailUnavailable'))}
            </Text>
            {!!normalizeText(driver?.phone) && (
              <Text style={styles.heroSubText}>{normalizeText(driver?.phone)}</Text>
            )}
          </View>

          <View style={styles.heroBadges}>
            <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
              <Ionicons name={statusStyle.icon} size={14} color={statusStyle.text} />
              <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                {statusStyle.label}
              </Text>
            </View>

            <View
              style={[
                styles.badge,
                styles.badgeSecondary,
                { backgroundColor: riskStyle.bg },
              ]}
            >
              <Ionicons name={riskStyle.icon} size={14} color={riskStyle.text} />
              <Text style={[styles.badgeText, { color: riskStyle.text }]}>
                {t('admin.restaurantDetails.riskBadgeLabel', { level: riskStyle.label })}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard
            label={t('admin.driverDetails.deliveriesLabel')}
            value={String(normalizeNumber(driver?.completedDeliveries))}
            icon="checkmark-done-outline"
            tint="#084424"
          />
          <MetricCard
            label={t('restaurant.analytics.ratingLabel')}
            value={
              driver?.rating > 0 ? Number(driver.rating).toFixed(1) : '—'
            }
            icon="star-outline"
            tint="#EAB02F"
          />
          <MetricCard
            label={t('admin.driverDetails.acceptanceRateLabel')}
            value={
              driver?.acceptanceRate > 0
                ? `${normalizeNumber(driver?.acceptanceRate)}%`
                : '—'
            }
            icon="flash-outline"
            tint="#084424"
          />
          <MetricCard
            label={t('admin.driverDetails.completionRateLabel')}
            value={
              driver?.completionRate > 0
                ? `${normalizeNumber(driver?.completionRate)}%`
                : '—'
            }
            icon="trophy-outline"
            tint="#084424"
          />
          <MetricCard
            label={t('admin.driverDetails.earningsTodayLabel')}
            value={
              driver?.earningsToday > 0 ? `${normalizeNumber(driver?.earningsToday)} €` : '—'
            }
            icon="cash-outline"
            tint="#C8331A"
          />
          <MetricCard
            label={t('admin.driverDetails.earningsWeekLabel')}
            value={
              driver?.earningsWeek > 0 ? `${normalizeNumber(driver?.earningsWeek)} €` : '—'
            }
            icon="wallet-outline"
            tint="#084424"
          />
        </View>

        <InfoCard title={t('admin.driverDetails.keyIndicatorsTitle')}>
          <View style={styles.flagGrid}>
            {quickFlags.map((flag) => (
              <FlagBox
                key={flag.key}
                label={flag.label}
                value={flag.value}
                accent={flag.accent}
                icon={flag.icon}
              />
            ))}
          </View>
        </InfoCard>

        <InfoCard title={t('admin.driverDetails.driverProfileTitle')}>
          <MetaRow
            icon="person-circle-outline"
            label={t('restaurant.profile.nameLabel')}
            value={normalizeText(driver?.name, t('profile.info.notProvided'))}
          />
          <MetaRow
            icon="mail-outline"
            label={t('admin.userDetails.emailFieldLabel')}
            value={normalizeText(driver?.email, t('profile.info.notProvided'))}
          />
          <MetaRow
            icon="call-outline"
            label={t('admin.userDetails.phoneFieldLabel')}
            value={normalizeText(driver?.phone, t('profile.info.notProvided'))}
          />
          <MetaRow
            icon="location-outline"
            label={t('restaurant.profile.cityLabel')}
            value={normalizeText(driver?.city, t('restaurant.profile.cityFallback'))}
          />
          <MetaRow
            icon="earth-outline"
            label={t('restaurant.profile.countryLabel')}
            value={normalizeText(driver?.country, t('profile.info.notProvided'))}
          />
          <MetaRow
            icon="car-sport-outline"
            label={t('admin.driverDetails.vehicleLabel')}
            value={normalizeText(driver?.vehicleType, t('profile.info.notProvided'))}
          />
        </InfoCard>

        <InfoCard title={t('admin.driverDetails.complianceAccountTitle')}>
          <MetaRow
            icon="shield-checkmark-outline"
            label={t('admin.restaurantDetails.identityFieldLabel')}
            value={driver?.isIdentityVerified ? t('admin.driverDetails.identityVerifiedValue') : t('admin.driverDetails.identityToVerifyValue')}
            valueStyle={{
              color: driver?.isIdentityVerified ? '#084424' : '#301904',
              fontWeight: '900',
            }}
          />
          <MetaRow
            icon="briefcase-outline"
            label={t('admin.restaurantDetails.workFieldLabel')}
            value={driver?.isWorkAuthorized ? t('admin.driverDetails.workAuthorizedValue') : t('admin.driverDetails.workNotValidatedValue')}
            valueStyle={{
              color: driver?.isWorkAuthorized ? '#084424' : '#C8331A',
              fontWeight: '900',
            }}
          />
          <MetaRow
            icon="checkmark-circle-outline"
            label={t('restaurant.profile.statusLabel')}
            value={statusStyle.label}
            valueStyle={{ color: statusStyle.text, fontWeight: '900' }}
          />
          <MetaRow
            icon="calendar-outline"
            label={t('admin.userDetails.createdOnFieldLabel')}
            value={formatDate(driver?.createdAt)}
          />
          <MetaRow
            icon="refresh-outline"
            label={t('admin.driverDetails.accountUpdatedLabel')}
            value={formatDateTime(driver?.updatedAt)}
          />
        </InfoCard>

        <InfoCard title={t('admin.driverDetails.verificationActionsTitle')}>
          <Text style={styles.verificationHint}>
            {t('admin.driverDetails.verificationHint')}
          </Text>

          <View style={styles.verificationRow}>
            <View style={styles.verificationLabelWrap}>
              <Text style={styles.verificationLabel}>
                {t('admin.driverDetails.identityVerifiedToggle')}
              </Text>
              <Text style={styles.verificationState}>
                {identityVerificationDraft
                  ? t('admin.driverDetails.identityVerifiedValue')
                  : t('admin.driverDetails.identityToVerifyValue')}
              </Text>
            </View>
            <Switch
              value={identityVerificationDraft}
              onValueChange={(value) => {
                setDraftIdentityVerified(value);
                if (!value) setDraftWorkAuthorized(false);
              }}
              disabled={updatingVerification}
              trackColor={{ false: '#E3DECF', true: '#E3F0E8' }}
              thumbColor={identityVerificationDraft ? '#084424' : '#F2ECE0'}
            />
          </View>

          <View style={styles.verificationRow}>
            <View style={styles.verificationLabelWrap}>
              <Text style={styles.verificationLabel}>
                {t('admin.driverDetails.workAuthorizedToggle')}
              </Text>
              <Text style={styles.verificationState}>
                {workAuthorizationDraft
                  ? t('admin.driverDetails.workAuthorizedValue')
                  : t('admin.driverDetails.workNotValidatedValue')}
              </Text>
            </View>
            <Switch
              value={workAuthorizationDraft}
              onValueChange={(value) => {
                if (value && !identityVerificationDraft) {
                  Alert.alert(
                    t('common.error'),
                    t('admin.driverDetails.verificationWorkNeedsIdentity')
                  );
                  return;
                }
                setDraftWorkAuthorized(value);
              }}
              disabled={
                updatingVerification ||
                (!identityVerificationDraft && !workAuthorizationDraft)
              }
              trackColor={{ false: '#E3DECF', true: '#E3F0E8' }}
              thumbColor={workAuthorizationDraft ? '#084424' : '#F2ECE0'}
            />
          </View>

          <Text style={styles.verificationNoteLabel}>
            {t('admin.driverDetails.verificationNoteLabel')}
          </Text>
          <TextInput
            value={verificationNote}
            onChangeText={setVerificationNote}
            style={styles.verificationInput}
            placeholder={t('admin.driverDetails.verificationNotePlaceholder')}
            placeholderTextColor="#606D5D"
            multiline
            maxLength={500}
            textAlignVertical="top"
            editable={!updatingVerification}
            accessibilityLabel={t('admin.driverDetails.verificationNoteLabel')}
          />

          <Pressable
            style={[
              styles.primaryButton,
              (updatingVerification || !verificationChanged) &&
                styles.primaryButtonDisabled,
            ]}
            onPress={handleSaveVerification}
            disabled={updatingVerification || !verificationChanged}
          >
            {updatingVerification ? (
              <ActivityIndicator size="small" color="#111" />
            ) : (
              <>
                <Ionicons name="shield-checkmark-outline" size={17} color="#111" />
                <Text style={styles.primaryButtonText}>
                  {t('admin.driverDetails.saveVerificationButton')}
                </Text>
              </>
            )}
          </Pressable>
        </InfoCard>

        <InfoCard title={t('admin.driverDetails.fieldActivityTitle')}>
          <MetaRow
            icon="radio-outline"
            label={t('admin.driverDetails.availabilityLabel')}
            value={driver?.isAvailable ? t('admin.driverDetails.availableValue') : t('admin.driverDetails.offlineValue')}
            valueStyle={{
              color: driver?.isAvailable ? '#084424' : '#666',
              fontWeight: '900',
            }}
          />
          <MetaRow
            icon="bicycle-outline"
            label={t('admin.driverDetails.missionFieldLabel')}
            value={driver?.currentOrderId ? t('admin.driverDetails.activeOrderDetectedValue') : t('admin.driverDetails.noActiveMissionValue')}
            valueStyle={{
              color: driver?.currentOrderId ? '#084424' : '#666',
              fontWeight: '900',
            }}
          />
          <MetaRow
            icon="time-outline"
            label={t('admin.driverDetails.lastActivityLabel')}
            value={formatDateTime(driver?.lastSeenAt)}
          />
          <MetaRow
            icon="receipt-outline"
            label={t('admin.driverDetails.orderIdLabel')}
            value={normalizeText(driver?.currentOrderId, t('profile.info.notProvided'))}
            multiline
          />
          <MetaRow
            icon="sync-outline"
            label={t('admin.driverDetails.rideStatusLabel')}
            value={normalizeText(driver?.currentOrderStatus, t('profile.info.notProvided'))}
          />
        </InfoCard>

        <InfoCard title={t('admin.driverDetails.adminActionsTitle')}>
          <View style={styles.actionBlock}>
            <Pressable
              style={styles.secondaryButton}
              onPress={handleOpenCurrentOrder}
            >
              <Ionicons name="receipt-outline" size={16} color="#084424" />
              <Text style={styles.secondaryButtonText}>{t('admin.driverDetails.viewActiveOrderButton')}</Text>
            </Pressable>

            <Pressable
              style={[
                styles.primaryButton,
                driver?.accountStatus === 'suspended' && styles.primaryButtonSuccess,
                updatingStatus && styles.primaryButtonDisabled,
              ]}
              onPress={handleToggleStatus}
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <ActivityIndicator size="small" color="#111" />
              ) : (
                <>
                  <Ionicons
                    name={
                      driver?.accountStatus === 'suspended'
                        ? 'checkmark-circle-outline'
                        : 'ban-outline'
                    }
                    size={16}
                    color="#111"
                  />
                  <Text style={styles.primaryButtonText}>
                    {driver?.accountStatus === 'suspended'
                      ? t('admin.userDetails.reactivateAccountButton')
                      : t('admin.userDetails.suspendAccountButton')}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </InfoCard>

        {!!errorMessage ? (
          <View style={styles.softErrorCard}>
            <Ionicons name="warning-outline" size={18} color="#C8331A" />
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
    backgroundColor: '#FBF6EC',
  },
  container: {
    flex: 1,
    backgroundColor: '#FBF6EC',
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
    backgroundColor: '#FBF6EC',
  },
  loaderText: {
    marginTop: 12,
    color: '#777',
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
    color: '#084424',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 8,
  },
  subtitle: {
    color: '#606D5D',
    fontSize: 14,
    lineHeight: 21,
  },

  liveMonitorCard: {
    backgroundColor: '#F2ECE0',
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
    color: '#084424',
    fontSize: 16,
    fontWeight: '900',
  },
  liveBadge: {
    backgroundColor: '#084424',
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
    color: '#084424',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  liveMonitorSubText: {
    color: '#084424',
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
    color: '#111',
    marginBottom: 8,
  },
  heroText: {
    color: '#666',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
  },
  heroSubText: {
    color: '#606D5D',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  heroBadges: {
    alignItems: 'flex-end',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeSecondary: {
    marginTop: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 16,
  },
  metricCard: {
    width: '31.33%',
    marginHorizontal: '1%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginBottom: 8,
    alignItems: 'center',
    elevation: 2,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111',
    marginBottom: 4,
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '700',
    textAlign: 'center',
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
  },
  infoCardTitle: {
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
    width: 96,
    color: '#606D5D',
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

  flagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  flagBox: {
    width: '48%',
    marginHorizontal: '1%',
    backgroundColor: '#F2ECE0',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  flagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  flagValue: {
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 6,
  },
  flagLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '700',
  },

  verificationHint: {
    color: '#606D5D',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3E7CA',
  },
  verificationLabelWrap: {
    flex: 1,
    paddingRight: 12,
  },
  verificationLabel: {
    color: '#0D1C11',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  verificationState: {
    color: '#606D5D',
    fontSize: 12,
    lineHeight: 17,
  },
  verificationNoteLabel: {
    color: '#0D1C11',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
  },
  verificationInput: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: '#E3DECF',
    backgroundColor: '#F2ECE0',
    borderRadius: 14,
    padding: 12,
    color: '#0D1C11',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  actionBlock: {
    gap: 10,
  },
  secondaryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#E3F0E8',
    backgroundColor: '#F2ECE0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  secondaryButtonText: {
    color: '#084424',
    fontWeight: '900',
    marginLeft: 6,
  },
  primaryButton: {
    minHeight: 48,
    backgroundColor: '#EAB02F',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryButtonSuccess: {
    backgroundColor: '#E3F0E8',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#111',
    fontWeight: '900',
    marginLeft: 8,
  },

  softErrorCard: {
    marginTop: 2,
    backgroundColor: '#F8E1DD',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  softErrorText: {
    marginLeft: 8,
    color: '#C8331A',
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
  },
  emptyTitle: {
    textAlign: 'center',
    color: '#0D1C11',
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

  retryButton: {
    marginTop: 18,
    backgroundColor: '#084424',
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonPressed: {
    opacity: 0.9,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },

  backLink: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backLinkText: {
    marginLeft: 8,
    color: '#084424',
    fontSize: 14,
    fontWeight: '800',
  },
});