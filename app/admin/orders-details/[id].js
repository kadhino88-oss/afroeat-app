import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  StatusBar,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../../../components/FadeInView';
import { useAuth } from '../../../context/AuthContext';
import { getAdminOrderById } from '../../../services/adminService';

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

const normalizeArray = (value) => {
  return Array.isArray(value) ? value : [];
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

const formatPrice = (value, currency = 'EUR') => {
  const amount = normalizeNumber(value, 0);
  const safeCurrency = normalizeText(currency, 'EUR').toUpperCase();

  if (safeCurrency === 'USD') return `$${amount.toFixed(2)}`;
  if (safeCurrency === 'GBP') return `£${amount.toFixed(2)}`;
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

const getSafeParam = (value) => {
  if (Array.isArray(value)) return normalizeText(value[0]);
  return normalizeText(value);
};

const getStatusStyle = (status) => {
  switch (normalizeText(status)) {
    case 'Livrée':
      return {
        bg: '#E8F5ED',
        text: '#1F6F43',
        label: 'Livrée',
        icon: 'checkmark-circle-outline',
      };
    case 'En livraison':
      return {
        bg: '#EAF3FF',
        text: '#245EA8',
        label: 'En livraison',
        icon: 'bicycle-outline',
      };
    case 'En préparation':
      return {
        bg: '#FFF3D8',
        text: '#8A6500',
        label: 'En préparation',
        icon: 'restaurant-outline',
      };
    case 'Confirmée':
      return {
        bg: '#EFE9FF',
        text: '#6D4CDB',
        label: 'Confirmée',
        icon: 'checkmark-done-outline',
      };
    case 'Annulée':
      return {
        bg: '#FDECEC',
        text: '#B83232',
        label: 'Annulée',
        icon: 'close-circle-outline',
      };
    default:
      return {
        bg: '#FFF0E8',
        text: '#D96C2D',
        label: normalizeText(status, 'En attente'),
        icon: 'time-outline',
      };
  }
};

const getPaymentStyle = (value) => {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized === 'paid' || normalized === 'payé') {
    return {
      bg: '#E8F5ED',
      text: '#1F6F43',
      label: 'Payé',
      icon: 'card-outline',
    };
  }

  if (normalized === 'unpaid' || normalized === 'non payé') {
    return {
      bg: '#FDECEC',
      text: '#B83232',
      label: 'Non payé',
      icon: 'alert-circle-outline',
    };
  }

  if (normalized === 'refunded' || normalized === 'remboursé') {
    return {
      bg: '#EAF3FF',
      text: '#245EA8',
      label: 'Remboursé',
      icon: 'swap-horizontal-outline',
    };
  }

  return {
    bg: '#F4F4F4',
    text: '#555555',
    label: normalizeText(value, 'Inconnu'),
    icon: 'help-circle-outline',
  };
};

const getRiskStyle = (order) => {
  const status = normalizeText(order?.status);
  const payment = normalizeText(order?.paymentStatus).toLowerCase();
  const hasDriver = Boolean(order?.deliveryPerson?._id);
  const totalPrice = normalizeNumber(order?.totalPrice, 0);

  if (status === 'Annulée' || payment === 'unpaid' || payment === 'non payé') {
    return {
      bg: '#FDECEC',
      text: '#B83232',
      label: 'Élevé',
      icon: 'alert-circle-outline',
    };
  }

  if (!hasDriver || totalPrice >= 100) {
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

const normalizeOrder = (payload) => {
  const raw =
    payload?.order ||
    payload?.data?.order ||
    payload?.data ||
    payload ||
    null;

  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const items = normalizeArray(raw?.items).map((item) => ({
    ...item,
    _id: item?._id || item?.id || null,
    id: item?.id || item?._id || null,
    name: normalizeText(item?.name || item?.title || item?.menuItem?.name, 'Article'),
    price:
      item?.price !== undefined && item?.price !== null
        ? normalizeNumber(item?.price, 0)
        : normalizeNumber(item?.unitPrice, 0),
    quantity: normalizeNumber(item?.quantity, 0),
    notes: normalizeText(item?.notes),
  }));

  const restaurant =
    raw?.restaurant && typeof raw.restaurant === 'object'
      ? {
          ...raw.restaurant,
          _id: raw.restaurant?._id || raw.restaurant?.id || null,
          id: raw.restaurant?.id || raw.restaurant?._id || null,
          name: normalizeText(raw.restaurant?.name, 'Restaurant Afroeat'),
          cuisine: normalizeText(raw.restaurant?.cuisine, 'Non définie'),
          email: normalizeText(raw.restaurant?.email),
          owner:
            raw.restaurant?.owner && typeof raw.restaurant.owner === 'object'
              ? {
                  ...raw.restaurant.owner,
                  _id:
                    raw.restaurant.owner?._id ||
                    raw.restaurant.owner?.id ||
                    null,
                  name: normalizeText(raw.restaurant.owner?.name, 'Non renseigné'),
                }
              : null,
        }
      : null;

  const user =
    raw?.user && typeof raw.user === 'object'
      ? {
          ...raw.user,
          _id: raw.user?._id || raw.user?.id || null,
          id: raw.user?.id || raw.user?._id || null,
          name: normalizeText(raw.user?.name, 'Client inconnu'),
          email: normalizeText(raw.user?.email),
          phone: normalizeText(raw.user?.phone),
        }
      : null;

  const deliveryPerson =
    raw?.deliveryPerson && typeof raw.deliveryPerson === 'object'
      ? {
          ...raw.deliveryPerson,
          _id: raw.deliveryPerson?._id || raw.deliveryPerson?.id || null,
          id: raw.deliveryPerson?.id || raw.deliveryPerson?._id || null,
          name: normalizeText(raw.deliveryPerson?.name, 'Non assigné'),
          email: normalizeText(raw.deliveryPerson?.email),
          phone: normalizeText(raw.deliveryPerson?.phone),
        }
      : null;

  return {
    ...raw,
    _id: raw?._id || raw?.id || null,
    id: raw?.id || raw?._id || null,
    status: normalizeText(raw?.status, 'En attente'),
    paymentStatus: normalizeText(raw?.paymentStatus, 'Non payé'),
    currency: normalizeText(raw?.currency, 'EUR').toUpperCase(),
    totalPrice: normalizeNumber(raw?.totalPrice, 0),
    deliveryAddress: normalizeText(raw?.deliveryAddress),
    notes: normalizeText(raw?.notes),
    createdAt: raw?.createdAt || null,
    updatedAt: raw?.updatedAt || null,
    restaurant,
    user,
    deliveryPerson,
    items,
  };
};

/**
 * =========================================================
 * UI BLOCKS
 * =========================================================
 */

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

const FlagBox = ({ label, value, accent, icon }) => (
  <View style={styles.flagBox}>
    <View style={styles.flagBoxTop}>
      {icon ? <Ionicons name={icon} size={15} color={accent || '#111111'} /> : null}
      <Text style={[styles.flagBoxValue, accent ? { color: accent } : null]}>
        {value}
      </Text>
    </View>
    <Text style={styles.flagBoxLabel}>{label}</Text>
  </View>
);

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function AdminOrderDetailsScreen() {
  const params = useLocalSearchParams();
  const auth = useAuth() || {};

  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);
  const currentUser = auth.user ?? null;
  const currentRole = useMemo(
    () => normalizeRole(auth.role || currentUser?.role),
    [auth.role, currentUser]
  );

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastLiveRefresh, setLastLiveRefresh] = useState(null);

  const canAccess = Boolean(isAuthenticated && token && isAdminRole(currentRole));
  const orderId = getSafeParam(params?.id);

  const fetchOrder = useCallback(
    async (manual = false, silent = false) => {
      if (!token || !orderId || !isAuthenticated || !isAdminRole(currentRole)) {
        setOrder(null);
        setErrorMessage(
          !orderId ? 'Commande invalide.' : 'Session admin invalide.'
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

        const data = await getAdminOrderById(orderId, token);
        const safeOrder = normalizeOrder(data);

        if (!safeOrder?._id) {
          throw new Error('Impossible de charger le détail de la commande.');
        }

        setOrder(safeOrder);
        setLastLiveRefresh(new Date().toISOString());
      } catch (error) {
        console.log('Erreur admin order details :', error);

        const message =
          error?.message || 'Impossible de charger le détail de la commande.';

        if (!silent) {
          setOrder(null);
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
    [orderId, token, isAuthenticated, currentRole]
  );

  useFocusEffect(
    useCallback(() => {
      fetchOrder(false, false);
    }, [fetchOrder])
  );

  useEffect(() => {
    if (!canAccess || !orderId) {
      return undefined;
    }

    const interval = setInterval(() => {
      fetchOrder(false, true);
    }, LIVE_REFRESH_MS);

    return () => clearInterval(interval);
  }, [canAccess, orderId, fetchOrder]);

  const statusStyle = useMemo(() => getStatusStyle(order?.status), [order]);
  const paymentStyle = useMemo(() => getPaymentStyle(order?.paymentStatus), [order]);
  const riskStyle = useMemo(() => getRiskStyle(order), [order]);

  const orderCode = useMemo(() => {
    return String(order?._id || orderId || '').slice(-6).toUpperCase();
  }, [order, orderId]);

  const items = useMemo(() => normalizeArray(order?.items), [order]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity = normalizeNumber(item?.quantity, 0);
      const unitPrice = normalizeNumber(item?.price, 0);
      return sum + quantity * unitPrice;
    }, 0);
  }, [items]);

  const itemCount = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + normalizeNumber(item?.quantity, 0),
      0
    );
  }, [items]);

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
        label: 'Statut',
        value: statusStyle.label,
        accent: statusStyle.text,
        icon: statusStyle.icon,
      },
      {
        key: 'payment',
        label: 'Paiement',
        value: paymentStyle.label,
        accent: paymentStyle.text,
        icon: paymentStyle.icon,
      },
      {
        key: 'delivery',
        label: 'Livraison',
        value: order?.deliveryPerson?._id ? 'Assignée' : 'Non assignée',
        accent: order?.deliveryPerson?._id ? '#1F6F43' : '#B83232',
        icon: 'bicycle-outline',
      },
      {
        key: 'items',
        label: 'Articles',
        value: String(itemCount),
        accent: '#245EA8',
        icon: 'bag-handle-outline',
      },
      {
        key: 'risk',
        label: 'Risque',
        value: riskStyle.label,
        accent: riskStyle.text,
        icon: riskStyle.icon,
      },
      {
        key: 'amount',
        label: 'Montant',
        value: formatPrice(order?.totalPrice, order?.currency || 'EUR'),
        accent: '#D96C2D',
        icon: 'cash-outline',
      },
    ];
  }, [statusStyle, paymentStyle, order, itemCount, riskStyle]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/admin/orders');
  }, []);

  /**
   * =========================================================
   * GUARDS
   * =========================================================
   */

  if (authLoading || (loading && !initialLoaded)) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#1F6F43" />
        <Text style={styles.loaderText}>Chargement du détail commande...</Text>
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

  if (!orderId) {
    return (
      <FadeInView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={56} color="#D8B28A" />
          <Text style={styles.emptyTitle}>Commande invalide</Text>
          <Text style={styles.emptyText}>Identifiant commande manquant.</Text>

          <Pressable style={styles.retryButton} onPress={handleGoBack}>
            <Text style={styles.retryButtonText}>Retour</Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  if (!order) {
    return (
      <FadeInView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={56} color="#D8B28A" />
          <Text style={styles.emptyTitle}>Commande introuvable</Text>
          <Text style={styles.emptyText}>
            {errorMessage || 'Impossible de charger cette commande.'}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={() => fetchOrder(true, false)}
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
            <Text style={styles.backLinkText}>Retour aux commandes</Text>
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchOrder(true, false)}
          />
        }
      >
        <View style={styles.topRow}>
          <Pressable style={styles.topButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
          </Pressable>

          <Pressable
            style={[styles.topButton, refreshing && styles.topButtonDisabled]}
            onPress={() => fetchOrder(true, false)}
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
          <Text style={styles.title}>Commande #{orderCode || '------'}</Text>
          <Text style={styles.subtitle}>
            Vue détaillée de la commande pour supervision, support premium et exploitation.
          </Text>
        </View>

        <View style={styles.liveMonitorCard}>
          <View style={styles.liveMonitorHeader}>
            <View style={styles.liveMonitorTitleWrap}>
              <Ionicons name="radio-outline" size={18} color="#245EA8" />
              <Text style={styles.liveMonitorTitle}>Order Intelligence Panel</Text>
            </View>

            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          </View>

          <Text style={styles.liveMonitorText}>
            Cette fiche est la base premium AFROEAT pour le suivi des commandes,
            la supervision opérationnelle, les paiements et la traçabilité support.
          </Text>

          <Text style={styles.liveMonitorSubText}>{liveRefreshLabel}</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>
              {normalizeText(order?.restaurant?.name, 'Restaurant Afroeat')}
            </Text>
            <Text style={styles.heroText}>
              Créée le {formatDateTime(order?.createdAt)}
            </Text>
            <Text style={styles.heroSubText}>
              Client : {normalizeText(order?.user?.name, 'Client inconnu')}
            </Text>
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
                { backgroundColor: paymentStyle.bg },
              ]}
            >
              <Ionicons name={paymentStyle.icon} size={14} color={paymentStyle.text} />
              <Text style={[styles.badgeText, { color: paymentStyle.text }]}>
                {paymentStyle.label}
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

        <InfoCard title="Indicateurs admin">
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

        <InfoCard title="Résumé commande">
          <MetaRow
            icon="receipt-outline"
            label="Référence"
            value={`#${orderCode || '------'}`}
          />
          <MetaRow
            icon="cash-outline"
            label="Total"
            value={formatPrice(order?.totalPrice, order?.currency || 'EUR')}
          />
          <MetaRow
            icon="card-outline"
            label="Paiement"
            value={paymentStyle.label}
            valueStyle={{ color: paymentStyle.text, fontWeight: '900' }}
          />
          <MetaRow
            icon="time-outline"
            label="Créée le"
            value={formatDateTime(order?.createdAt)}
          />
          <MetaRow
            icon="refresh-outline"
            label="Mise à jour"
            value={formatDateTime(order?.updatedAt)}
          />
          <MetaRow
            icon="location-outline"
            label="Adresse"
            value={normalizeText(order?.deliveryAddress, 'Non renseignée')}
            multiline
          />
          <MetaRow
            icon="document-text-outline"
            label="Notes"
            value={normalizeText(order?.notes, 'Aucune note')}
            multiline
          />
        </InfoCard>

        <InfoCard title="Restaurant">
          <MetaRow
            icon="storefront-outline"
            label="Nom"
            value={normalizeText(order?.restaurant?.name, 'Restaurant inconnu')}
          />
          <MetaRow
            icon="restaurant-outline"
            label="Cuisine"
            value={normalizeText(order?.restaurant?.cuisine, 'Non définie')}
          />
          <MetaRow
            icon="person-outline"
            label="Owner"
            value={normalizeText(order?.restaurant?.owner?.name, 'Non renseigné')}
          />
          <MetaRow
            icon="mail-outline"
            label="Email"
            value={normalizeText(order?.restaurant?.email, 'Non renseigné')}
          />
        </InfoCard>

        <InfoCard title="Client">
          <MetaRow
            icon="person-circle-outline"
            label="Nom"
            value={normalizeText(order?.user?.name, 'Client inconnu')}
          />
          <MetaRow
            icon="mail-outline"
            label="Email"
            value={normalizeText(order?.user?.email, 'Non renseigné')}
          />
          <MetaRow
            icon="call-outline"
            label="Téléphone"
            value={normalizeText(order?.user?.phone, 'Non renseigné')}
          />
        </InfoCard>

        <InfoCard title="Livreur">
          <MetaRow
            icon="bicycle-outline"
            label="Nom"
            value={normalizeText(order?.deliveryPerson?.name, 'Non assigné')}
          />
          <MetaRow
            icon="mail-outline"
            label="Email"
            value={normalizeText(order?.deliveryPerson?.email, 'Non renseigné')}
          />
          <MetaRow
            icon="call-outline"
            label="Téléphone"
            value={normalizeText(order?.deliveryPerson?.phone, 'Non renseigné')}
          />
        </InfoCard>

        <InfoCard
          title="Articles commandés"
          footer={
            items.length > 0 ? (
              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Sous-total estimé</Text>
                  <Text style={styles.summaryValue}>
                    {formatPrice(subtotal, order?.currency || 'EUR')}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Articles</Text>
                  <Text style={styles.summaryValue}>{itemCount}</Text>
                </View>

                <View style={[styles.summaryRow, styles.summaryRowLast]}>
                  <Text style={styles.summaryLabelStrong}>Total commande</Text>
                  <Text style={styles.summaryValueStrong}>
                    {formatPrice(order?.totalPrice, order?.currency || 'EUR')}
                  </Text>
                </View>
              </View>
            ) : null
          }
        >
          {items.length > 0 ? (
            items.map((item, index) => {
              const itemName = normalizeText(
                item?.name || item?.title || item?.menuItem?.name,
                `Article ${index + 1}`
              );
              const quantity = normalizeNumber(item?.quantity, 0);
              const unitPrice = normalizeNumber(item?.price, 0);
              const lineTotal = quantity * unitPrice;

              return (
                <View
                  key={item?._id || `${itemName}-${index}`}
                  style={[
                    styles.itemRow,
                    index === items.length - 1 && styles.itemRowLast,
                  ]}
                >
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemName}>{itemName}</Text>

                    <Text style={styles.itemMeta}>
                      Qté : {quantity}
                      {unitPrice > 0
                        ? ` • PU : ${formatPrice(unitPrice, order?.currency || 'EUR')}`
                        : ''}
                    </Text>

                    {!!normalizeText(item?.notes) && (
                      <Text style={styles.itemNotes}>
                        Note : {normalizeText(item?.notes)}
                      </Text>
                    )}
                  </View>

                  <Text style={styles.itemTotal}>
                    {formatPrice(lineTotal, order?.currency || 'EUR')}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyInfoText}>Aucun article disponible.</Text>
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
    shadowColor: '#000',
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
    marginTop: 14,
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

  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2ECE5',
  },
  itemRowLast: {
    marginBottom: 0,
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  itemLeft: {
    flex: 1,
    paddingRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111',
    marginBottom: 4,
  },
  itemMeta: {
    color: '#666',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  itemNotes: {
    color: '#7A7268',
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  itemTotal: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },

  summaryBox: {
    backgroundColor: '#FAF7F2',
    borderRadius: 16,
    padding: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryRowLast: {
    marginBottom: 0,
  },
  summaryLabel: {
    color: '#6B655E',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryLabelStrong: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },
  summaryValue: {
    color: '#111',
    fontSize: 13,
    fontWeight: '800',
  },
  summaryValueStrong: {
    color: '#111',
    fontSize: 15,
    fontWeight: '900',
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
    color: '#111',
    marginLeft: 6,
  },
  flagBoxLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '700',
  },

  emptyInfoText: {
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