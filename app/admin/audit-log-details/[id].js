import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../../../components/FadeInView';
import { useAuth } from '../../../context/AuthContext';
import { getAdminAuditLogById } from '../../../services/adminService';
import { useTranslation } from 'react-i18next';
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
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const getSafeParam = (value) => {
  if (Array.isArray(value)) {
    return normalizeText(value[0]);
  }

  return normalizeText(value);
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

const formatActionLabel = (value, t) => {
  const raw = normalizeText(value);

  if (!raw) return t('admin.auditLogs.actionFallback');

  return raw
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const getTargetTypeLabel = (value, t) => {
  switch (normalizeText(value).toLowerCase()) {
    case 'user':
      return t('admin.auditLogs.targetTypeUserLabel');
    case 'restaurant':
      return t('admin.users.roleRestaurantLabel');
    case 'driver':
      return t('admin.users.roleDriverLabel');
    case 'order':
      return t('admin.auditLogs.targetTypeOrderLabel');
    case 'system':
      return t('admin.auditLogs.targetTypeSystemLabel');
    case 'other':
      return t('admin.auditLogs.targetTypeOtherLabel');
    default:
      return normalizeText(value, t('admin.auditLogs.targetTypeOtherLabel'));
  }
};

const getTargetTypeStyle = (value) => {
  switch (normalizeText(value).toLowerCase()) {
    case 'user':
      return { bg: '#F2ECE0', text: '#084424', icon: 'person-outline' };
    case 'restaurant':
      return { bg: '#F3E7CA', text: '#C8331A', icon: 'storefront-outline' };
    case 'driver':
      return { bg: '#E3F0E8', text: '#084424', icon: 'bicycle-outline' };
    case 'order':
      return { bg: '#F2ECE0', text: '#084424', icon: 'receipt-outline' };
    case 'system':
      return { bg: '#E3F0E8', text: '#084424', icon: 'settings-outline' };
    default:
      return { bg: '#F2ECE0', text: '#555', icon: 'ellipse-outline' };
  }
};

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const formatMetadataValue = (value, t) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? t('admin.userDetails.yesLabel') : t('admin.userDetails.noLabel');
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
};

const formatMetadataLabel = (key) => {
  return normalizeText(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
};

const getRiskLevel = (log, t) => {
  const action = normalizeText(log?.action).toLowerCase();
  const targetType = normalizeText(log?.targetType).toLowerCase();

  if (
    action.includes('delete') ||
    action.includes('remove') ||
    action.includes('suspend') ||
    action.includes('ban') ||
    action.includes('revoke') ||
    action.includes('reject')
  ) {
    return {
      label: t('admin.restaurantDetails.riskHighLabel'),
      bg: '#F8E1DD',
      text: '#C8331A',
      icon: 'alert-circle-outline',
    };
  }

  if (
    action.includes('update') ||
    action.includes('edit') ||
    action.includes('change') ||
    action.includes('assign') ||
    targetType === 'order' ||
    targetType === 'driver'
  ) {
    return {
      label: t('admin.restaurantDetails.riskMediumLabel'),
      bg: '#F3E7CA',
      text: '#301904',
      icon: 'warning-outline',
    };
  }

  return {
    label: t('admin.auditLogDetails.riskStandardLabel'),
    bg: '#E3F0E8',
    text: '#084424',
    icon: 'checkmark-circle-outline',
  };
};

const normalizeAuditLog = (item) => {
  if (!isPlainObject(item)) {
    return null;
  }

  const admin = isPlainObject(item?.admin) ? item.admin : {};
  const metadata = isPlainObject(item?.metadata) ? item.metadata : {};

  return {
    ...item,
    _id: item?._id || item?.id || null,
    id: item?.id || item?._id || null,
    action: normalizeText(item?.action),
    targetType: normalizeText(item?.targetType),
    targetId: normalizeText(item?.targetId),
    targetLabel: normalizeText(item?.targetLabel),
    details: normalizeText(item?.details),
    ipAddress: normalizeText(item?.ipAddress),
    userAgent: normalizeText(item?.userAgent),
    createdAt: item?.createdAt || null,
    updatedAt: item?.updatedAt || null,
    admin: {
      ...admin,
      _id: admin?._id || admin?.id || null,
      name: normalizeText(admin?.name, i18n.t('admin.auditLogs.adminUnknownFallback')),
      email: normalizeText(admin?.email),
      role: normalizeText(admin?.role, 'admin'),
    },
    metadata,
  };
};

const InfoCard = ({ title, children, footer }) => (
  <View style={styles.infoCard}>
    <Text style={styles.infoCardTitle}>{title}</Text>
    {children}
    {footer ? <View style={styles.infoCardFooter}>{footer}</View> : null}
  </View>
);

const MetaRow = ({ icon, label, value, valueStyle, multiline = false }) => (
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

const FlagBox = ({ value, label, accent, icon }) => (
  <View style={styles.flagBox}>
    <View style={styles.flagBoxHeader}>
      {icon ? <Ionicons name={icon} size={16} color={accent || '#111'} /> : null}
      <Text style={[styles.flagBoxValue, accent ? { color: accent } : null]}>
        {value}
      </Text>
    </View>
    <Text style={styles.flagBoxLabel}>{label}</Text>
  </View>
);

export default function AdminAuditLogDetailsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const { token, isAuthenticated, role, user, loading: authLoading } = useAuth();

  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastLiveRefresh, setLastLiveRefresh] = useState(null);

  const currentRole = useMemo(() => {
    return String(role || user?.role || '').toLowerCase();
  }, [role, user]);

  const canAccess = isAuthenticated && currentRole === 'admin';
  const logId = useMemo(() => getSafeParam(params?.id), [params]);

  const targetTypeStyle = useMemo(
    () => getTargetTypeStyle(log?.targetType),
    [log]
  );

  const riskStyle = useMemo(() => getRiskLevel(log, t), [log, t]);

  const fetchLog = useCallback(
    async (manual = false, silent = false) => {
      if (!token || !logId) {
        setLog(null);
        setErrorMessage(!logId ? t('admin.auditLogs.invalidLogAlert') : t('admin.users.invalidSessionAlert'));
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

        const data = await getAdminAuditLogById(logId, token);
        const safeLog = normalizeAuditLog(data);

        if (!safeLog?._id) {
          throw new Error(t('admin.auditLogDetails.fetchErrorFallback'));
        }

        setLog(safeLog);
        setLastLiveRefresh(new Date().toISOString());
      } catch (error) {
        console.log('Erreur admin audit log details :', error);

        const message =
          error?.message || t('admin.auditLogDetails.fetchErrorFallback');

        if (!silent) {
          setLog(null);
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
    [logId, token, t]
  );

  useFocusEffect(
    useCallback(() => {
      fetchLog(false, false);
    }, [fetchLog])
  );

  useEffect(() => {
    if (!canAccess || !token || !logId) {
      return undefined;
    }

    const interval = setInterval(() => {
      fetchLog(false, true);
    }, LIVE_REFRESH_MS);

    return () => clearInterval(interval);
  }, [canAccess, token, logId, fetchLog]);

  const metadataEntries = useMemo(() => {
    if (!isPlainObject(log?.metadata)) {
      return [];
    }

    return Object.entries(log.metadata).map(([key, value]) => ({
      key,
      label: formatMetadataLabel(key),
      value: formatMetadataValue(value, t),
      isComplex: typeof value === 'object' && value !== null,
    }));
  }, [log, t]);

  const summaryFlags = useMemo(() => {
    return [
      {
        key: 'target-type',
        value: getTargetTypeLabel(log?.targetType, t),
        label: t('admin.auditLogDetails.targetTypeFlagLabel'),
        accent: targetTypeStyle.text,
        icon: targetTypeStyle.icon,
      },
      {
        key: 'has-target-id',
        value: normalizeText(log?.targetId) ? t('admin.userDetails.yesLabel') : t('admin.userDetails.noLabel'),
        label: t('admin.auditLogs.targetIdLabel'),
        accent: normalizeText(log?.targetId) ? '#084424' : '#301904',
        icon: 'finger-print-outline',
      },
      {
        key: 'has-ip',
        value: normalizeText(log?.ipAddress) ? t('admin.userDetails.yesLabel') : t('admin.userDetails.noLabel'),
        label: t('admin.auditLogDetails.ipCapturedFlagLabel'),
        accent: normalizeText(log?.ipAddress) ? '#084424' : '#301904',
        icon: 'globe-outline',
      },
      {
        key: 'metadata',
        value: metadataEntries.length > 0 ? String(metadataEntries.length) : '0',
        label: t('admin.auditLogDetails.metadataKeysFlagLabel'),
        accent: metadataEntries.length > 0 ? '#084424' : '#666',
        icon: 'layers-outline',
      },
      {
        key: 'risk',
        value: riskStyle.label,
        label: t('admin.auditLogDetails.riskLevelFlagLabel'),
        accent: riskStyle.text,
        icon: riskStyle.icon,
      },
      {
        key: 'target-label',
        value: normalizeText(log?.targetLabel) ? t('admin.userDetails.yesLabel') : t('admin.userDetails.noLabel'),
        label: t('admin.auditLogDetails.targetLabelFlagLabel'),
        accent: normalizeText(log?.targetLabel) ? '#084424' : '#301904',
        icon: 'pricetag-outline',
      },
    ];
  }, [log, targetTypeStyle, metadataEntries, riskStyle, t]);

  const liveRefreshLabel = useMemo(() => {
    if (!lastLiveRefresh) {
      return t('admin.ops.liveRefreshWaiting');
    }

    return t('admin.ops.liveRefreshLabel', { date: formatDateTime(lastLiveRefresh) });
  }, [lastLiveRefresh, t]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/admin/audit-logs');
  }, []);

  if (authLoading || (loading && !initialLoaded)) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <ActivityIndicator size="large" color="#084424" />
        <Text style={styles.loaderText}>{t('admin.auditLogDetails.loaderText')}</Text>
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
            {t('admin.auditLogDetails.restrictedText')}
          </Text>
        </View>
      </FadeInView>
    );
  }

  if (!log) {
    return (
      <FadeInView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={56} color="#EAB02F" />
          <Text style={styles.emptyTitle}>{t('admin.auditLogDetails.notFoundTitle')}</Text>
          <Text style={styles.emptyText}>
            {errorMessage || t('admin.auditLogDetails.fetchErrorFallback')}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={() => fetchLog(true, false)}
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
            <Text style={styles.backLinkText}>{t('admin.auditLogDetails.backToLogsLink')}</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchLog(true, false)} />
        }
      >
        <View style={styles.topRow}>
          <Pressable style={styles.topButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={20} color="#0D1C11" />
          </Pressable>

          <Pressable
            style={[styles.topButton, refreshing && styles.topButtonDisabled]}
            onPress={() => fetchLog(true, false)}
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
          <Text style={styles.title}>{t('admin.auditLogDetails.title')}</Text>
          <Text style={styles.subtitle}>
            {t('admin.auditLogDetails.subtitle')}
          </Text>
        </View>

        <View style={styles.liveMonitorCard}>
          <View style={styles.liveMonitorHeader}>
            <View style={styles.liveMonitorTitleWrap}>
              <Ionicons name="radio-outline" size={18} color="#084424" />
              <Text style={styles.liveMonitorTitle}>{t('admin.auditLogDetails.liveMonitorTitle')}</Text>
            </View>

            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>

          <Text style={styles.liveMonitorText}>
            {t('admin.auditLogDetails.liveMonitorText')}
          </Text>

          <Text style={styles.liveMonitorSubText}>{liveRefreshLabel}</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>
              {formatActionLabel(log?.action, t)}
            </Text>
            <Text style={styles.heroText}>
              {t('admin.auditLogDetails.performedOnHero', { date: formatDateTime(log?.createdAt) })}
            </Text>
            <Text style={styles.heroSubText}>
              {t('admin.auditLogs.adminLabel', { name: normalizeText(log?.admin?.name, t('admin.auditLogs.adminUnknownFallback')) })}
            </Text>
          </View>

          <View style={styles.heroBadges}>
            <View
              style={[
                styles.badge,
                { backgroundColor: targetTypeStyle.bg },
              ]}
            >
              <Ionicons
                name={targetTypeStyle.icon}
                size={14}
                color={targetTypeStyle.text}
              />
              <Text style={[styles.badgeText, { color: targetTypeStyle.text }]}>
                {getTargetTypeLabel(log?.targetType, t)}
              </Text>
            </View>

            <View
              style={[
                styles.badge,
                styles.badgeSecondary,
                { backgroundColor: riskStyle.bg },
              ]}
            >
              <Ionicons
                name={riskStyle.icon}
                size={14}
                color={riskStyle.text}
              />
              <Text style={[styles.badgeText, { color: riskStyle.text }]}>
                {t('admin.restaurantDetails.riskBadgeLabel', { level: riskStyle.label })}
              </Text>
            </View>
          </View>
        </View>

        <InfoCard title={t('admin.auditLogDetails.actionSectionTitle')}>
          <MetaRow
            icon="flash-outline"
            label={t('admin.auditLogDetails.actionSectionTitle')}
            value={formatActionLabel(log?.action, t)}
          />
          <MetaRow
            icon="calendar-outline"
            label={t('admin.orderDetails.createdOnFieldLabelFem')}
            value={formatDateTime(log?.createdAt)}
          />
          <MetaRow
            icon="refresh-outline"
            label={t('admin.orderDetails.updatedFieldLabelFem')}
            value={formatDateTime(log?.updatedAt)}
          />
        </InfoCard>

        <InfoCard title={t('admin.auditLogDetails.adminOriginTitle')}>
          <MetaRow
            icon="person-circle-outline"
            label={t('restaurant.profile.nameLabel')}
            value={normalizeText(log?.admin?.name, t('admin.auditLogs.adminUnknownFallback'))}
          />
          <MetaRow
            icon="mail-outline"
            label={t('admin.userDetails.emailFieldLabel')}
            value={normalizeText(log?.admin?.email, t('profile.info.notProvided'))}
          />
          <MetaRow
            icon="id-card-outline"
            label={t('admin.userDetails.roleFieldLabel')}
            value={normalizeText(log?.admin?.role).toLowerCase() === 'admin' ? t('admin.users.roleAdminLabel') : normalizeText(log?.admin?.role, t('admin.users.roleAdminLabel'))}
          />
        </InfoCard>

        <InfoCard title={t('admin.auditLogDetails.targetSectionTitle')}>
          <MetaRow
            icon={targetTypeStyle.icon}
            label={t('admin.auditLogDetails.typeFieldLabel')}
            value={getTargetTypeLabel(log?.targetType, t)}
            valueStyle={{ color: targetTypeStyle.text, fontWeight: '900' }}
          />
          <MetaRow
            icon="pricetag-outline"
            label={t('admin.auditLogDetails.targetLabelFieldLabel')}
            value={normalizeText(log?.targetLabel, t('profile.info.notProvided'))}
            multiline
          />
          <MetaRow
            icon="finger-print-outline"
            label={t('admin.auditLogs.targetIdLabel')}
            value={normalizeText(log?.targetId, t('profile.info.notProvided'))}
            multiline
          />
        </InfoCard>

        <InfoCard title={t('admin.auditLogDetails.detailsSectionTitle')}>
          <MetaRow
            icon="document-text-outline"
            label={t('admin.auditLogDetails.contentFieldLabel')}
            value={normalizeText(log?.details, t('admin.auditLogDetails.noDetailsValue'))}
            multiline
          />
        </InfoCard>

        <InfoCard title={t('admin.auditLogDetails.technicalContextTitle')}>
          <MetaRow
            icon="globe-outline"
            label={t('admin.auditLogDetails.ipFieldLabel')}
            value={normalizeText(log?.ipAddress, t('restaurant.profile.cityFallback'))}
          />
          <MetaRow
            icon="phone-portrait-outline"
            label={t('admin.auditLogDetails.agentFieldLabel')}
            value={normalizeText(log?.userAgent, t('profile.info.notProvided'))}
            multiline
          />
        </InfoCard>

        <InfoCard title={t('admin.restaurantDetails.adminIndicatorsTitle')}>
          <View style={styles.flagGrid}>
            {summaryFlags.map((flag) => (
              <FlagBox
                key={flag.key}
                value={normalizeText(flag.value, '—')}
                label={flag.label}
                accent={flag.accent}
                icon={flag.icon}
              />
            ))}
          </View>
        </InfoCard>

        <InfoCard title={t('admin.auditLogDetails.metadataSectionTitle')}>
          {metadataEntries.length > 0 ? (
            metadataEntries.map((entry, index) => (
              <View
                key={entry.key}
                style={[
                  styles.metadataBlock,
                  index === metadataEntries.length - 1 && styles.metadataBlockLast,
                ]}
              >
                <Text style={styles.metadataKey}>{entry.label}</Text>
                <Text
                  style={[
                    styles.metadataValue,
                    entry.isComplex && styles.metadataValueComplex,
                  ]}
                >
                  {entry.value}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyMetadataText}>
              {t('admin.auditLogDetails.noMetadataText')}
            </Text>
          )}
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
    textTransform: 'capitalize',
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
  infoCardFooter: {
    marginTop: 12,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metaLabel: {
    marginLeft: 8,
    width: 92,
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
  flagBoxHeader: {
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
    color: '#666',
    fontWeight: '700',
  },

  metadataBlock: {
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2ECE0',
  },
  metadataBlockLast: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  metadataKey: {
    color: '#606D5D',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'capitalize',
  },
  metadataValue: {
    color: '#111',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  metadataValueComplex: {
    color: '#333',
  },
  emptyMetadataText: {
    color: '#777',
    fontSize: 14,
    lineHeight: 21,
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