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

const LIVE_REFRESH_MS = 15000;

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

const formatActionLabel = (value) => {
  const raw = normalizeText(value);

  if (!raw) return 'Action admin';

  return raw
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const getTargetTypeLabel = (value) => {
  switch (normalizeText(value).toLowerCase()) {
    case 'user':
      return 'Utilisateur';
    case 'restaurant':
      return 'Restaurant';
    case 'driver':
      return 'Livreur';
    case 'order':
      return 'Commande';
    case 'system':
      return 'Système';
    case 'other':
      return 'Autre';
    default:
      return normalizeText(value, 'Autre');
  }
};

const getTargetTypeStyle = (value) => {
  switch (normalizeText(value).toLowerCase()) {
    case 'user':
      return { bg: '#EEF2FF', text: '#245EA8', icon: 'person-outline' };
    case 'restaurant':
      return { bg: '#FFF2E8', text: '#C05621', icon: 'storefront-outline' };
    case 'driver':
      return { bg: '#F3E8FF', text: '#7C3AED', icon: 'bicycle-outline' };
    case 'order':
      return { bg: '#EAF3FF', text: '#245EA8', icon: 'receipt-outline' };
    case 'system':
      return { bg: '#E8F5ED', text: '#1F6F43', icon: 'settings-outline' };
    default:
      return { bg: '#F4F4F4', text: '#555', icon: 'ellipse-outline' };
  }
};

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const formatMetadataValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
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

const getRiskLevel = (log) => {
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
      label: 'Élevé',
      bg: '#FDECEC',
      text: '#B83232',
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
      label: 'Moyen',
      bg: '#FFF3D8',
      text: '#8A6500',
      icon: 'warning-outline',
    };
  }

  return {
    label: 'Standard',
    bg: '#E8F5ED',
    text: '#1F6F43',
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
      name: normalizeText(admin?.name, 'Admin inconnu'),
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

  const riskStyle = useMemo(() => getRiskLevel(log), [log]);

  const fetchLog = useCallback(
    async (manual = false, silent = false) => {
      if (!token || !logId) {
        setLog(null);
        setErrorMessage(!logId ? 'Journal invalide.' : 'Session admin invalide.');
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
          throw new Error('Impossible de charger ce journal admin.');
        }

        setLog(safeLog);
        setLastLiveRefresh(new Date().toISOString());
      } catch (error) {
        console.log('Erreur admin audit log details :', error);

        const message =
          error?.message || 'Impossible de charger ce journal admin.';

        if (!silent) {
          setLog(null);
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
    [logId, token]
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
      value: formatMetadataValue(value),
      isComplex: typeof value === 'object' && value !== null,
    }));
  }, [log]);

  const summaryFlags = useMemo(() => {
    return [
      {
        key: 'target-type',
        value: getTargetTypeLabel(log?.targetType),
        label: 'Type cible',
        accent: targetTypeStyle.text,
        icon: targetTypeStyle.icon,
      },
      {
        key: 'has-target-id',
        value: normalizeText(log?.targetId) ? 'Oui' : 'Non',
        label: 'Target ID',
        accent: normalizeText(log?.targetId) ? '#1F6F43' : '#8A6500',
        icon: 'finger-print-outline',
      },
      {
        key: 'has-ip',
        value: normalizeText(log?.ipAddress) ? 'Oui' : 'Non',
        label: 'IP capturée',
        accent: normalizeText(log?.ipAddress) ? '#1F6F43' : '#8A6500',
        icon: 'globe-outline',
      },
      {
        key: 'metadata',
        value: metadataEntries.length > 0 ? String(metadataEntries.length) : '0',
        label: 'Clés metadata',
        accent: metadataEntries.length > 0 ? '#245EA8' : '#666',
        icon: 'layers-outline',
      },
      {
        key: 'risk',
        value: riskStyle.label,
        label: 'Niveau de risque',
        accent: riskStyle.text,
        icon: riskStyle.icon,
      },
      {
        key: 'target-label',
        value: normalizeText(log?.targetLabel) ? 'Oui' : 'Non',
        label: 'Label cible',
        accent: normalizeText(log?.targetLabel) ? '#1F6F43' : '#8A6500',
        icon: 'pricetag-outline',
      },
    ];
  }, [log, targetTypeStyle, metadataEntries, riskStyle]);

  const liveRefreshLabel = useMemo(() => {
    if (!lastLiveRefresh) {
      return 'En attente du premier refresh live';
    }

    return `Dernier refresh live : ${formatDateTime(lastLiveRefresh)}`;
  }, [lastLiveRefresh]);

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
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#1F6F43" />
        <Text style={styles.loaderText}>Chargement du journal admin...</Text>
      </View>
    );
  }

  if (!canAccess) {
    return (
      <FadeInView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.emptyContainer}>
          <Ionicons name="shield-outline" size={56} color="#C8BBAA" />
          <Text style={styles.emptyTitle}>Accès réservé à l’admin</Text>
          <Text style={styles.emptyText}>
            Connecte-toi avec un compte administrateur pour accéder au détail du journal.
          </Text>
        </View>
      </FadeInView>
    );
  }

  if (!log) {
    return (
      <FadeInView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={56} color="#D8B28A" />
          <Text style={styles.emptyTitle}>Journal introuvable</Text>
          <Text style={styles.emptyText}>
            {errorMessage || 'Impossible de charger ce journal admin.'}
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
                <Text style={styles.retryButtonText}>Réessayer</Text>
              </>
            )}
          </Pressable>

          <Pressable style={styles.backLink} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={16} color="#1F6F43" />
            <Text style={styles.backLinkText}>Retour aux journaux</Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  return (
    <FadeInView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

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
            <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
          </Pressable>

          <Pressable
            style={[styles.topButton, refreshing && styles.topButtonDisabled]}
            onPress={() => fetchLog(true, false)}
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
          <Text style={styles.title}>Détail journal admin</Text>
          <Text style={styles.subtitle}>
            Analyse complète d’une action sensible tracée dans le système d’administration.
          </Text>
        </View>

        <View style={styles.liveMonitorCard}>
          <View style={styles.liveMonitorHeader}>
            <View style={styles.liveMonitorTitleWrap}>
              <Ionicons name="radio-outline" size={18} color="#245EA8" />
              <Text style={styles.liveMonitorTitle}>Audit Trace Monitor</Text>
            </View>

            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>

          <Text style={styles.liveMonitorText}>
            Ce détail constitue la base premium de traçabilité AFROEAT :
            audit admin, supervision des actions sensibles et vérification
            complète du contexte d’exécution.
          </Text>

          <Text style={styles.liveMonitorSubText}>{liveRefreshLabel}</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>
              {formatActionLabel(log?.action)}
            </Text>
            <Text style={styles.heroText}>
              Réalisée le {formatDateTime(log?.createdAt)}
            </Text>
            <Text style={styles.heroSubText}>
              Admin : {normalizeText(log?.admin?.name, 'Admin inconnu')}
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
                {getTargetTypeLabel(log?.targetType)}
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
                Risque {riskStyle.label}
              </Text>
            </View>
          </View>
        </View>

        <InfoCard title="Action">
          <MetaRow
            icon="flash-outline"
            label="Action"
            value={formatActionLabel(log?.action)}
          />
          <MetaRow
            icon="calendar-outline"
            label="Créée le"
            value={formatDateTime(log?.createdAt)}
          />
          <MetaRow
            icon="refresh-outline"
            label="Mise à jour"
            value={formatDateTime(log?.updatedAt)}
          />
        </InfoCard>

        <InfoCard title="Admin à l’origine">
          <MetaRow
            icon="person-circle-outline"
            label="Nom"
            value={normalizeText(log?.admin?.name, 'Admin inconnu')}
          />
          <MetaRow
            icon="mail-outline"
            label="Email"
            value={normalizeText(log?.admin?.email, 'Non renseigné')}
          />
          <MetaRow
            icon="id-card-outline"
            label="Rôle"
            value={normalizeText(log?.admin?.role, 'admin')}
          />
        </InfoCard>

        <InfoCard title="Cible">
          <MetaRow
            icon={targetTypeStyle.icon}
            label="Type"
            value={getTargetTypeLabel(log?.targetType)}
            valueStyle={{ color: targetTypeStyle.text, fontWeight: '900' }}
          />
          <MetaRow
            icon="pricetag-outline"
            label="Label"
            value={normalizeText(log?.targetLabel, 'Non renseigné')}
            multiline
          />
          <MetaRow
            icon="finger-print-outline"
            label="Target ID"
            value={normalizeText(log?.targetId, 'Non renseigné')}
            multiline
          />
        </InfoCard>

        <InfoCard title="Détails">
          <MetaRow
            icon="document-text-outline"
            label="Contenu"
            value={normalizeText(log?.details, 'Aucun détail renseigné')}
            multiline
          />
        </InfoCard>

        <InfoCard title="Contexte technique">
          <MetaRow
            icon="globe-outline"
            label="IP"
            value={normalizeText(log?.ipAddress, 'Non renseignée')}
          />
          <MetaRow
            icon="phone-portrait-outline"
            label="Agent"
            value={normalizeText(log?.userAgent, 'Non renseigné')}
            multiline
          />
        </InfoCard>

        <InfoCard title="Indicateurs admin">
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

        <InfoCard title="Metadata">
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
              Aucune metadata enregistrée pour ce journal.
            </Text>
          )}
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
  container: {
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
    color: '#1F6F43',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#1E1E1E',
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
    color: '#7A7268',
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
    borderBottomColor: '#F2ECE5',
  },
  metadataBlockLast: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  metadataKey: {
    color: '#6B655E',
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
  },
  emptyTitle: {
    textAlign: 'center',
    color: '#1E1E1E',
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
    backgroundColor: '#1F6F43',
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
    color: '#1F6F43',
    fontSize: 14,
    fontWeight: '800',
  },
});