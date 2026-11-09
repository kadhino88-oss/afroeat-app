// app/admin/users-details/[id].jsx

import React, { useCallback, useMemo, useState } from 'react';
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
import { useLocalSearchParams, router, useFocusEffect, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import FadeInView from '../../../components/FadeInView';
import { useAuth } from '../../../context/AuthContext';
import {
  getAdminUserById,
  updateAdminUserStatus,
} from '../../../services/adminService';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeBoolean = (value) => {
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
  return Boolean(value);
};

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

const getAccountStatus = (user, auth = {}) => {
  return normalizeText(
    user?.accountStatus ||
      user?.status ||
      user?.approvalStatus ||
      auth?.status ||
      '',
    ''
  ).toLowerCase();
};

const getSafeParam = (value) => {
  if (Array.isArray(value)) return normalizeText(value[0]);
  return normalizeText(value);
};

const normalizeUserResponse = (payload) => {
  const raw =
    payload?.user ||
    payload?.data?.user ||
    payload?.data ||
    payload ||
    null;

  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const normalizedRoleValue = normalizeRole(raw?.role || 'client');

  return {
    ...raw,
    _id: raw?._id || raw?.id || null,
    id: raw?.id || raw?._id || null,
    name: normalizeText(raw?.name, i18n.t('admin.users.userNameFallback')),
    email: normalizeText(raw?.email, i18n.t('admin.users.emailUnavailableFallback')),
    phone: normalizeText(raw?.phone),
    role:
      normalizedRoleValue === 'driver' || normalizedRoleValue === 'delivery'
        ? 'livreur'
        : normalizedRoleValue,
    accountStatus: normalizeText(
      raw?.accountStatus || raw?.status,
      'pending_verification'
    ).toLowerCase(),
    isIdentityVerified: normalizeBoolean(raw?.isIdentityVerified),
    isWorkAuthorized: normalizeBoolean(raw?.isWorkAuthorized),
    createdAt: raw?.createdAt || null,
    updatedAt: raw?.updatedAt || null,
    city: normalizeText(raw?.city || raw?.addressCity),
    country: normalizeText(raw?.country || raw?.addressCountry),
    address: normalizeText(raw?.address),
  };
};

const DATE_LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-ES', it: 'it-IT', zh: 'zh-CN' };

const formatDateTime = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString(DATE_LOCALE_MAP[i18n.language] || 'fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getRoleLabel = (role, t) => {
  switch (normalizeRole(role)) {
    case 'client':
      return t('admin.users.roleClientLabel');
    case 'restaurant':
      return t('admin.users.roleRestaurantLabel');
    case 'livreur':
      return t('admin.users.roleDriverLabel');
    case 'admin':
    case 'administrator':
    case 'superadmin':
    case 'super-admin':
      return t('admin.users.roleAdminLabel');
    default:
      return t('admin.users.roleDefaultLabel');
  }
};

const getRoleStyle = (role, t) => {
  switch (normalizeRole(role)) {
    case 'client':
      return {
        bg: '#EEF2FF',
        text: '#245EA8',
        icon: 'person-outline',
        label: t('admin.users.roleClientLabel'),
      };
    case 'restaurant':
      return {
        bg: '#FFF2E8',
        text: '#C05621',
        icon: 'storefront-outline',
        label: t('admin.users.roleRestaurantLabel'),
      };
    case 'livreur':
      return {
        bg: '#F3E8FF',
        text: '#7C3AED',
        icon: 'bicycle-outline',
        label: t('admin.users.roleDriverLabel'),
      };
    case 'admin':
    case 'administrator':
    case 'superadmin':
    case 'super-admin':
      return {
        bg: '#E8F5ED',
        text: '#084424',
        icon: 'shield-checkmark-outline',
        label: t('admin.users.roleAdminLabel'),
      };
    default:
      return {
        bg: '#F4F4F4',
        text: '#555555',
        icon: 'person-circle-outline',
        label: t('admin.users.roleDefaultLabel'),
      };
  }
};

const getStatusStyle = (status, t) => {
  switch (normalizeText(status).toLowerCase()) {
    case 'active':
      return {
        bg: '#E8F5ED',
        text: '#084424',
        label: t('admin.users.statusActiveLabel'),
        icon: 'checkmark-circle-outline',
      };
    case 'suspended':
      return {
        bg: '#FDECEC',
        text: '#B83232',
        label: t('admin.users.statusSuspendedLabel'),
        icon: 'ban-outline',
      };
    case 'pending_verification':
      return {
        bg: '#FFF3D8',
        text: '#8A6500',
        label: t('admin.users.statusPendingLabel'),
        icon: 'time-outline',
      };
    case 'rejected':
      return {
        bg: '#EFE9FF',
        text: '#6D4CDB',
        label: t('admin.users.statusRejectedLabel'),
        icon: 'close-circle-outline',
      };
    default:
      return {
        bg: '#F4F4F4',
        text: '#555555',
        label: t('admin.users.statusUnknownLabel'),
        icon: 'help-circle-outline',
      };
  }
};

const InfoRow = ({ icon, label, value, iconColor = '#6B655E' }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={16} color={iconColor} />
    <View style={styles.infoTextWrap}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function AdminUserDetailsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const userId = getSafeParam(params?.id);

  const auth = useAuth();
  const token = auth.token;
  const role = auth.role;
  const currentUser = auth.user ?? null;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const currentRole = useMemo(() => {
    return normalizeRole(role || currentUser?.role);
  }, [role, currentUser]);

  const currentStatus = useMemo(() => {
    return getAccountStatus(currentUser, auth);
  }, [currentUser, auth]);

  const canAccess = Boolean(isAuthenticated && token && isAdminRole(currentRole));

  const roleStyle = useMemo(() => getRoleStyle(user?.role, t), [user, t]);
  const statusStyle = useMemo(() => getStatusStyle(user?.accountStatus, t), [user, t]);

  const fetchUser = useCallback(
    async (manual = false) => {
      if (!canAccess || !userId) {
        setUser(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        setErrorMessage('');

        if (manual) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const data = await getAdminUserById(userId, token);
        const normalized = normalizeUserResponse(data);

        if (!normalized?._id) {
          throw new Error(t('admin.userDetails.notFoundTitle'));
        }

        setUser(normalized);
      } catch (error) {
        console.log('Erreur chargement détail utilisateur :', error);
        setUser(null);
        setErrorMessage(
          error?.message || t('admin.userDetails.fetchErrorFallback')
        );

        if (manual) {
          Alert.alert(
            t('common.error'),
            error?.message || t('admin.userDetails.fetchErrorFallback')
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canAccess, userId, token, t]
  );

  useFocusEffect(
    useCallback(() => {
      fetchUser(false);
    }, [fetchUser])
  );

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/admin/users');
  }, []);

  const toggleStatus = useCallback(async () => {
    if (!token || !user?._id) {
      Alert.alert(t('common.error'), t('admin.userDetails.actionImpossibleAlert'));
      return;
    }

    const currentStatus = normalizeText(user?.accountStatus).toLowerCase();
    const shouldActivate = ['pending_verification', 'rejected', 'suspended'].includes(currentStatus);
    const nextStatus = shouldActivate ? 'active' : 'suspended';
    const isPendingPartner =
      ['pending_verification', 'rejected'].includes(currentStatus) &&
      ['restaurant', 'livreur'].includes(user?.role);
    const actionLabel = shouldActivate
      ? isPendingPartner
        ? t('admin.userDetails.activatePartnerButton')
        : t('admin.users.reactivateAction')
      : t('admin.users.suspendAction');
    const identity = normalizeText(user?.name, user?.email || t('admin.users.defaultAccountIdentity'));

    Alert.alert(
      t('admin.users.confirmDialogTitle'),
      t('admin.users.confirmDialogMessage', { action: actionLabel, identity }),
      [
        { text: t('admin.users.cancelAction'), style: 'cancel' },
        {
          text: t('admin.users.confirmDialogTitle'),
          onPress: async () => {
            try {
              setUpdating(true);

              const res = await updateAdminUserStatus(user._id, nextStatus, token);
              const updated = normalizeUserResponse(res);

              setUser((prev) => ({
                ...(prev || {}),
                ...(updated || {}),
                accountStatus: updated?.accountStatus || nextStatus,
              }));

              Alert.alert(
                t('common.success'),
                res?.message || t('admin.users.statusUpdatedFallback')
              );
            } catch (error) {
              console.log('Erreur mise à jour utilisateur :', error);
              Alert.alert(
                t('common.error'),
                error?.message || t('admin.userDetails.actionImpossibleAlert')
              );
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  }, [token, user, t]);

  /**
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (authLoading || loading) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <ActivityIndicator size="large" color="#084424" />
        <Text style={styles.loaderText}>{t('admin.userDetails.loaderText')}</Text>
      </View>
    );
  }

  /**
   * =========================================================
   * GUARDS
   * =========================================================
   */

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

  if (!userId) {
    return (
      <FadeInView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={54} color="#C8BBAA" />
          <Text style={styles.emptyTitle}>{t('admin.userDetails.notFoundTitle')}</Text>
          <Text style={styles.emptyText}>{t('admin.userDetails.missingIdText')}</Text>
          <Pressable style={styles.primaryButton} onPress={handleGoBack}>
            <Text style={styles.primaryButtonText}>{t('admin.userDetails.backButton')}</Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  if (!user) {
    return (
      <FadeInView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <View style={styles.emptyContainer}>
          <Ionicons name="person-circle-outline" size={54} color="#C8BBAA" />
          <Text style={styles.emptyTitle}>{t('admin.userDetails.notFoundTitle')}</Text>
          <Text style={styles.emptyText}>
            {errorMessage || t('admin.userDetails.fetchErrorFallback')}
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => fetchUser(true)}>
            <Text style={styles.primaryButtonText}>{t('restaurant.retry')}</Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchUser(true)}
            tintColor="#084424"
          />
        }
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={22} color="#0D1C11" />
          </Pressable>

          <Text style={styles.title}>{t('admin.userDetails.title')}</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            <Ionicons name="person-outline" size={34} color="#084424" />
          </View>

          <Text style={styles.name}>
            {normalizeText(user?.name, t('admin.users.userNameFallback'))}
          </Text>
          <Text style={styles.email}>
            {normalizeText(user?.email, t('admin.users.emailUnavailableFallback'))}
          </Text>

          <View style={styles.badgesRow}>
            <View style={[styles.badge, { backgroundColor: roleStyle.bg }]}>
              <Ionicons name={roleStyle.icon} size={13} color={roleStyle.text} />
              <Text style={[styles.badgeText, { color: roleStyle.text }]}>
                {getRoleLabel(user?.role, t)}
              </Text>
            </View>

            <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
              <Ionicons
                name={statusStyle.icon}
                size={13}
                color={statusStyle.text}
              />
              <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                {statusStyle.label}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('admin.userDetails.generalInfoTitle')}</Text>

          <InfoRow
            icon="mail-outline"
            label={t('admin.userDetails.emailFieldLabel')}
            value={normalizeText(user?.email, t('admin.users.emailUnavailableFallback'))}
          />
          <InfoRow
            icon="call-outline"
            label={t('admin.userDetails.phoneFieldLabel')}
            value={normalizeText(user?.phone, t('profile.info.notProvided'))}
          />
          <InfoRow
            icon="person-outline"
            label={t('admin.userDetails.roleFieldLabel')}
            value={getRoleLabel(user?.role, t)}
          />
          {user?.role === 'restaurant' &&
          normalizeText(user?.restaurantProfile?.businessName) ? (
            <InfoRow
              icon="storefront-outline"
              label={t('auth.registerRestaurant.restaurantNameLabel')}
              value={normalizeText(user.restaurantProfile.businessName)}
            />
          ) : null}
          <InfoRow
            icon="shield-checkmark-outline"
            label={t('admin.userDetails.accountStatusFieldLabel')}
            value={statusStyle.label}
            iconColor={statusStyle.text}
          />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('admin.userDetails.complianceProfileTitle')}</Text>

          <InfoRow
            icon="id-card-outline"
            label={t('admin.users.identityVerifiedLabel')}
            value={user?.isIdentityVerified ? t('admin.userDetails.yesLabel') : t('admin.userDetails.noLabel')}
            iconColor={user?.isIdentityVerified ? '#084424' : '#8A6500'}
          />
          <InfoRow
            icon="briefcase-outline"
            label={t('admin.users.workAuthorizedLabel')}
            value={user?.isWorkAuthorized ? t('admin.userDetails.yesLabel') : t('admin.userDetails.noLabel')}
            iconColor={user?.isWorkAuthorized ? '#084424' : '#8A6500'}
          />
          {(normalizeText(user?.city) || normalizeText(user?.country)) ? (
            <InfoRow
              icon="earth-outline"
              label={t('admin.userDetails.zoneFieldLabel')}
              value={[normalizeText(user?.city), normalizeText(user?.country)]
                .filter(Boolean)
                .join(', ')}
            />
          ) : null}
          {!!normalizeText(user?.address) && (
            <InfoRow
              icon="location-outline"
              label={t('admin.userDetails.addressFieldLabel')}
              value={normalizeText(user?.address)}
            />
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('admin.userDetails.traceabilityTitle')}</Text>

          <InfoRow
            icon="calendar-outline"
            label={t('admin.userDetails.createdOnFieldLabel')}
            value={formatDateTime(user?.createdAt)}
          />
          <InfoRow
            icon="refresh-outline"
            label={t('admin.userDetails.lastUpdatedFieldLabel')}
            value={formatDateTime(user?.updatedAt || user?.createdAt)}
          />
          <InfoRow
            icon="finger-print-outline"
            label={t('admin.userDetails.idFieldLabel')}
            value={normalizeText(user?._id, '—')}
          />
        </View>

        {!isAdminRole(user?.role) ? (
          <Pressable
            style={[
              styles.primaryButton,
              ['suspended', 'pending_verification', 'rejected'].includes(
                normalizeText(user?.accountStatus).toLowerCase()
              ) && styles.successButton,
            ]}
            onPress={toggleStatus}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator size="small" color="#0D1C11" />
            ) : (
              <>
                <Ionicons
                  name={
                    ['suspended', 'pending_verification', 'rejected'].includes(
                      normalizeText(user?.accountStatus).toLowerCase()
                    )
                      ? 'checkmark-circle-outline'
                      : 'ban-outline'
                  }
                  size={18}
                  color="#0D1C11"
                />
                <Text style={styles.primaryButtonText}>
                  {['pending_verification', 'rejected'].includes(
                    normalizeText(user?.accountStatus).toLowerCase()
                  ) && ['restaurant', 'livreur'].includes(user?.role)
                    ? t('admin.userDetails.activatePartnerButton')
                    : user?.accountStatus === 'suspended'
                      ? t('admin.userDetails.reactivateAccountButton')
                      : t('admin.userDetails.suspendAccountButton')}
                </Text>
              </>
            )}
          </Pressable>
        ) : (
          <View style={styles.protectedBox}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color="#084424"
            />
            <Text style={styles.protectedText}>{t('admin.users.adminProtectedText')}</Text>
          </View>
        )}
      </ScrollView>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF6EC',
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 60,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FBF6EC',
    paddingHorizontal: 24,
  },

  loaderText: {
    marginTop: 12,
    color: '#777777',
    fontSize: 15,
    textAlign: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    elevation: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0D1C11',
    flex: 1,
  },

  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },

  avatarWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#E8F5ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  name: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0D1C11',
    textAlign: 'center',
    marginBottom: 6,
  },

  email: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 14,
  },

  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    marginHorizontal: 4,
    marginBottom: 8,
  },

  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },

  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 14,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },

  infoTextWrap: {
    flex: 1,
    marginLeft: 10,
  },

  infoLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#777777',
    marginBottom: 4,
    textTransform: 'uppercase',
  },

  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222222',
    lineHeight: 20,
  },

  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#EAB02F',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 4,
    paddingHorizontal: 16,
  },

  successButton: {
    backgroundColor: '#CDECD7',
  },

  primaryButtonText: {
    color: '#0D1C11',
    fontWeight: '900',
    fontSize: 15,
    marginLeft: 8,
  },

  protectedBox: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#F5FBF7',
    borderWidth: 1,
    borderColor: '#CFE5D7',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 4,
    paddingHorizontal: 16,
  },

  protectedText: {
    color: '#084424',
    fontWeight: '900',
    fontSize: 14,
    marginLeft: 8,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FBF6EC',
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
    color: '#777777',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
});
