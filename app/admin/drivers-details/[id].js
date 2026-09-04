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
import {
  getAdminDrivers,
  updateAdminUserStatus,
} from '../../../services/adminService';

const LIVE_REFRESH_MS = 15000;

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

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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

const getStatusStyle = (status) => {
  switch (String(status || '').toLowerCase()) {
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
        text: '#555',
        label: 'Inconnu',
        icon: 'help-circle-outline',
      };
  }
};

const getDriverRiskStyle = (driver) => {
  if (!driver) {
    return {
      bg: '#F4F4F4',
      text: '#555',
      label: 'Inconnu',
      icon: 'help-circle-outline',
    };
  }

  if (driver?.accountStatus === 'suspended' || driver?.accountStatus === 'rejected') {
    return {
      bg: '#FDECEC',
      text: '#B83232',
      label: 'Élevé',
      icon: 'alert-circle-outline',
    };
  }

  if (!driver?.isIdentityVerified || !driver?.isWorkAuthorized) {
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
    name: normalizeText(driver?.name || fullName, 'Livreur Afroeat'),
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

const MetricCard = ({ label, value, icon, tint = '#1F6F43' }) => (
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
  const { id } = useLocalSearchParams();
  const { token, isAuthenticated, role, user } = useAuth();

  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastLiveRefresh, setLastLiveRefresh] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const driverId = normalizeText(Array.isArray(id) ? id[0] : id);
  const currentRole = useMemo(() => {
    return String(role || user?.role || '').toLowerCase();
  }, [role, user]);

  const canAccess = isAuthenticated && currentRole === 'admin';

  const fetchDriver = useCallback(
    async (manual = false, silent = false) => {
      if (!isAuthenticated || !token || !driverId) {
        setDriver(null);
        setErrorMessage(!driverId ? 'Livreur invalide.' : 'Session admin invalide.');
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
          throw new Error('Livreur introuvable.');
        }

        setDriver(matchedDriver);
        setLastLiveRefresh(new Date().toISOString());
      } catch (error) {
        console.log('Erreur admin driver details :', error);

        const message =
          error?.message || 'Impossible de charger ce livreur.';

        if (!silent) {
          setDriver(null);
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
    [isAuthenticated, token, driverId]
  );

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

  const statusStyle = useMemo(() => getStatusStyle(driver?.accountStatus), [driver]);
  const riskStyle = useMemo(() => getDriverRiskStyle(driver), [driver]);

  const liveRefreshLabel = useMemo(() => {
    if (!lastLiveRefresh) {
      return 'En attente du premier refresh live';
    }

    return `Dernier refresh live : ${formatDateTime(lastLiveRefresh)}`;
  }, [lastLiveRefresh]);

  const quickFlags = useMemo(() => {
    return [
      {
        key: 'status',
        label: 'Statut compte',
        value: statusStyle.label,
        accent: statusStyle.text,
        icon: statusStyle.icon,
      },
      {
        key: 'identity',
        label: 'Identité',
        value: driver?.isIdentityVerified ? 'Vérifiée' : 'À vérifier',
        accent: driver?.isIdentityVerified ? '#1F6F43' : '#8A6500',
        icon: 'shield-checkmark-outline',
      },
      {
        key: 'work',
        label: 'Autorisation',
        value: driver?.isWorkAuthorized ? 'Valide' : 'Manquante',
        accent: driver?.isWorkAuthorized ? '#1F6F43' : '#B83232',
        icon: 'briefcase-outline',
      },
      {
        key: 'availability',
        label: 'Disponibilité',
        value: driver?.isAvailable ? 'Disponible' : 'Hors ligne',
        accent: driver?.isAvailable ? '#245EA8' : '#666',
        icon: 'radio-outline',
      },
      {
        key: 'risk',
        label: 'Risque',
        value: riskStyle.label,
        accent: riskStyle.text,
        icon: riskStyle.icon,
      },
      {
        key: 'mission',
        label: 'Mission active',
        value: driver?.currentOrderId ? 'Oui' : 'Non',
        accent: driver?.currentOrderId ? '#7C3AED' : '#666',
        icon: 'bicycle-outline',
      },
    ];
  }, [driver, riskStyle, statusStyle]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/admin/drivers');
  }, []);

  const handleToggleStatus = useCallback(() => {
    if (!token || !driver?._id) {
      Alert.alert('Erreur', 'Impossible de mettre à jour ce livreur.');
      return;
    }

    const nextStatus =
      driver?.accountStatus === 'suspended' ? 'active' : 'suspended';

    const actionLabel = nextStatus === 'active' ? 'réactiver' : 'suspendre';

    Alert.alert(
      'Confirmer',
      `Veux-tu ${actionLabel} ${normalizeText(driver?.name, 'ce livreur')} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
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
                'Succès',
                response?.message || 'Statut livreur mis à jour.'
              );
            } catch (error) {
              console.log('Erreur update admin driver status :', error);
              Alert.alert(
                'Erreur',
                error?.message || 'Impossible de mettre à jour ce livreur.'
              );
            } finally {
              setUpdatingStatus(false);
            }
          },
        },
      ]
    );
  }, [driver, token]);

  const handleOpenCurrentOrder = useCallback(() => {
    if (!driver?.currentOrderId) {
      Alert.alert('Info', 'Aucune commande active liée à ce livreur.');
      return;
    }

    router.push({
      pathname: '/admin/orders-details/[id]',
      params: { id: driver.currentOrderId },
    });
  }, [driver]);

  if (loading && !initialLoaded) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#1F6F43" />
        <Text style={styles.loaderText}>Chargement du livreur...</Text>
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
            Connecte-toi avec un compte administrateur pour accéder au détail du livreur.
          </Text>
        </View>
      </FadeInView>
    );
  }

  if (!driver) {
    return (
      <FadeInView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={56} color="#D8B28A" />
          <Text style={styles.emptyTitle}>Livreur introuvable</Text>
          <Text style={styles.emptyText}>
            {errorMessage || 'Impossible de charger ce livreur.'}
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
                <Text style={styles.retryButtonText}>Réessayer</Text>
              </>
            )}
          </Pressable>

          <Pressable style={styles.backLink} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={16} color="#1F6F43" />
            <Text style={styles.backLinkText}>Retour aux livreurs</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchDriver(true, false)} />
        }
      >
        <View style={styles.topRow}>
          <Pressable style={styles.topButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
          </Pressable>

          <Pressable
            style={[styles.topButton, refreshing && styles.topButtonDisabled]}
            onPress={() => fetchDriver(true, false)}
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
          <Text style={styles.title}>Détail livreur</Text>
          <Text style={styles.subtitle}>
            Vision complète du compte, de la conformité, de l’activité et du niveau de risque opérationnel.
          </Text>
        </View>

        <View style={styles.liveMonitorCard}>
          <View style={styles.liveMonitorHeader}>
            <View style={styles.liveMonitorTitleWrap}>
              <Ionicons name="radio-outline" size={18} color="#245EA8" />
              <Text style={styles.liveMonitorTitle}>Driver Control Center</Text>
            </View>

            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>

          <Text style={styles.liveMonitorText}>
            Cette fiche admin est la base premium de supervision flotte AFROEAT :
            conformité, disponibilité, mission active, performance et contrôle d’accès.
          </Text>

          <Text style={styles.liveMonitorSubText}>{liveRefreshLabel}</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>
              {normalizeText(driver?.name, 'Livreur Afroeat')}
            </Text>
            <Text style={styles.heroText}>
              {normalizeText(driver?.email, 'Email indisponible')}
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
                Risque {riskStyle.label}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard
            label="Livraisons"
            value={String(normalizeNumber(driver?.completedDeliveries))}
            icon="checkmark-done-outline"
            tint="#1F6F43"
          />
          <MetricCard
            label="Note"
            value={
              driver?.rating > 0 ? Number(driver.rating).toFixed(1) : '—'
            }
            icon="star-outline"
            tint="#D4A017"
          />
          <MetricCard
            label="Taux accept."
            value={
              driver?.acceptanceRate > 0
                ? `${normalizeNumber(driver?.acceptanceRate)}%`
                : '—'
            }
            icon="flash-outline"
            tint="#245EA8"
          />
          <MetricCard
            label="Taux compl."
            value={
              driver?.completionRate > 0
                ? `${normalizeNumber(driver?.completionRate)}%`
                : '—'
            }
            icon="trophy-outline"
            tint="#7C3AED"
          />
          <MetricCard
            label="Gain jour"
            value={
              driver?.earningsToday > 0 ? `${normalizeNumber(driver?.earningsToday)} €` : '—'
            }
            icon="cash-outline"
            tint="#D96C2D"
          />
          <MetricCard
            label="Gain semaine"
            value={
              driver?.earningsWeek > 0 ? `${normalizeNumber(driver?.earningsWeek)} €` : '—'
            }
            icon="wallet-outline"
            tint="#1F6F43"
          />
        </View>

        <InfoCard title="Indicateurs clés">
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

        <InfoCard title="Profil livreur">
          <MetaRow
            icon="person-circle-outline"
            label="Nom"
            value={normalizeText(driver?.name, 'Non renseigné')}
          />
          <MetaRow
            icon="mail-outline"
            label="Email"
            value={normalizeText(driver?.email, 'Non renseigné')}
          />
          <MetaRow
            icon="call-outline"
            label="Téléphone"
            value={normalizeText(driver?.phone, 'Non renseigné')}
          />
          <MetaRow
            icon="location-outline"
            label="Ville"
            value={normalizeText(driver?.city, 'Non renseignée')}
          />
          <MetaRow
            icon="earth-outline"
            label="Pays"
            value={normalizeText(driver?.country, 'Non renseigné')}
          />
          <MetaRow
            icon="car-sport-outline"
            label="Véhicule"
            value={normalizeText(driver?.vehicleType, 'Non renseigné')}
          />
        </InfoCard>

        <InfoCard title="Conformité & compte">
          <MetaRow
            icon="shield-checkmark-outline"
            label="Identité"
            value={driver?.isIdentityVerified ? 'Vérifiée' : 'À vérifier'}
            valueStyle={{
              color: driver?.isIdentityVerified ? '#1F6F43' : '#8A6500',
              fontWeight: '900',
            }}
          />
          <MetaRow
            icon="briefcase-outline"
            label="Travail"
            value={driver?.isWorkAuthorized ? 'Autorisé' : 'Non validé'}
            valueStyle={{
              color: driver?.isWorkAuthorized ? '#1F6F43' : '#B83232',
              fontWeight: '900',
            }}
          />
          <MetaRow
            icon="checkmark-circle-outline"
            label="Statut"
            value={statusStyle.label}
            valueStyle={{ color: statusStyle.text, fontWeight: '900' }}
          />
          <MetaRow
            icon="calendar-outline"
            label="Créé le"
            value={formatDate(driver?.createdAt)}
          />
          <MetaRow
            icon="refresh-outline"
            label="Maj compte"
            value={formatDateTime(driver?.updatedAt)}
          />
        </InfoCard>

        <InfoCard title="Activité terrain">
          <MetaRow
            icon="radio-outline"
            label="Disponibilité"
            value={driver?.isAvailable ? 'Disponible' : 'Hors ligne'}
            valueStyle={{
              color: driver?.isAvailable ? '#245EA8' : '#666',
              fontWeight: '900',
            }}
          />
          <MetaRow
            icon="bicycle-outline"
            label="Mission"
            value={driver?.currentOrderId ? 'Commande active détectée' : 'Aucune mission active'}
            valueStyle={{
              color: driver?.currentOrderId ? '#7C3AED' : '#666',
              fontWeight: '900',
            }}
          />
          <MetaRow
            icon="time-outline"
            label="Dernière activité"
            value={formatDateTime(driver?.lastSeenAt)}
          />
          <MetaRow
            icon="receipt-outline"
            label="Commande ID"
            value={normalizeText(driver?.currentOrderId, 'Non renseigné')}
            multiline
          />
          <MetaRow
            icon="sync-outline"
            label="Statut course"
            value={normalizeText(driver?.currentOrderStatus, 'Non renseigné')}
          />
        </InfoCard>

        <InfoCard title="Actions admin">
          <View style={styles.actionBlock}>
            <Pressable
              style={styles.secondaryButton}
              onPress={handleOpenCurrentOrder}
            >
              <Ionicons name="receipt-outline" size={16} color="#245EA8" />
              <Text style={styles.secondaryButtonText}>Voir la commande active</Text>
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
                      ? 'Réactiver le compte'
                      : 'Suspendre le compte'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
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

  actionBlock: {
    gap: 10,
  },
  secondaryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D9E5FF',
    backgroundColor: '#EEF4FF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  secondaryButtonText: {
    color: '#245EA8',
    fontWeight: '900',
    marginLeft: 6,
  },
  primaryButton: {
    minHeight: 48,
    backgroundColor: '#D4A017',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryButtonSuccess: {
    backgroundColor: '#CDECD7',
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