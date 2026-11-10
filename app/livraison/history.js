import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { getAssignedOrders } from '../../services/deliveryService';
import i18n from '../../i18n';

const normalizeText = (value, fallback = '') => {
  const normalized = String(value || '').trim();
  return normalized || fallback;
};

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const formatPrice = (value, currency = 'EUR') => {
  const a = Number(value) || 0;
  const code = String(currency || 'EUR').toUpperCase();
  try {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: code === 'XOF' || code === 'XAF' ? 0 : 2,
      maximumFractionDigits: code === 'XOF' || code === 'XAF' ? 0 : 2,
    }).format(a);
  } catch {
    return `${a.toFixed(2)} ${code}`;
  }
};

const DATE_LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-ES', it: 'it-IT', zh: 'zh-CN' };

const formatDate = (value) => {
  if (!value) return i18n.t('livraison.history.dateUnavailable');

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return i18n.t('livraison.history.dateUnavailable');
  }

  return date.toLocaleDateString(DATE_LOCALE_MAP[i18n.language] || 'en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

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

const getDeliveredStatusStyle = () => {
  return {
    bg: '#E3F0E8',
    text: '#084424',
  };
};

const getItemsCount = (items) => {
  return normalizeArray(items).reduce((sum, current) => {
    return sum + normalizeNumber(current?.quantity, 0);
  }, 0);
};

const getSafeCurrency = (orders = []) => {
  const firstCurrency = normalizeArray(orders).find((order) =>
    normalizeText(order?.currency)
  )?.currency;

  return normalizeText(firstCurrency, 'EUR');
};

export default function LivraisonHistoryScreen() {
  const { token, isAuthenticated, role, user } = useAuth();
  const { t } = useTranslation();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentRole = useMemo(() => {
    return String(role || user?.role || 'client').toLowerCase();
  }, [role, user]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/livraison-orders');
  }, []);

  const fetchHistory = useCallback(
    async (manual = false) => {
      if (!isAuthenticated || !token) {
        setOrders([]);
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

        const allOrders = await getAssignedOrders(token);

        const deliveredOrders = normalizeArray(allOrders).filter(
          (order) => order?.status === 'Livrée'
        );

        setOrders(deliveredOrders);
      } catch (error) {
        console.log('Erreur récupération historique livraisons :', error);
        Alert.alert(
          t('common.error'),
          error?.message || t('livraison.history.loadErrorFallback')
        );
        setOrders([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthenticated, token]
  );

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  const totalDelivered = useMemo(() => {
    return orders.length;
  }, [orders]);

  const totalRevenue = useMemo(() => {
    return normalizeArray(orders).reduce((sum, order) => {
      return sum + normalizeNumber(order?.totalPrice, 0);
    }, 0);
  }, [orders]);

  const totalItems = useMemo(() => {
    return normalizeArray(orders).reduce((sum, order) => {
      return sum + getItemsCount(order?.items);
    }, 0);
  }, [orders]);

  const historyCurrency = useMemo(() => {
    return getSafeCurrency(orders);
  }, [orders]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <ActivityIndicator size="large" color="#C8331A" />
        <Text style={styles.loaderText}>{t('livraison.history.loaderText')}</Text>
      </View>
    );
  }

  if (!isAuthenticated || currentRole !== 'livreur') {
    return (
      <FadeInView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={54} color="#606D5D" />
          <Text style={styles.emptyTitle}>{t('livraison.history.restrictedAccessTitle')}</Text>
          <Text style={styles.emptyText}>
            {t('livraison.history.restrictedAccessText')}
          </Text>

          <Pressable
            style={styles.emptyButton}
            onPress={() => router.replace('/auth/role')}
          >
            <Text style={styles.emptyButtonText}>{t('livraison.history.backToLogin')}</Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

      <FlatList
        data={orders}
        keyExtractor={(item, index) =>
          item?._id?.toString() || `history-${index}`
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          orders.length === 0 && styles.emptyListContent,
        ]}
        ListHeaderComponent={
          <View>
            <View style={styles.topActions}>
              <Pressable style={styles.topButton} onPress={handleGoBack}>
                <Ionicons name="arrow-back" size={20} color="#0D1C11" />
              </Pressable>

              <Pressable
                style={styles.topButton}
                onPress={() => fetchHistory(true)}
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
              <Text style={styles.eyebrow}>{t('livraison.history.eyebrow')}</Text>
              <Text style={styles.title}>{t('livraison.history.title')}</Text>
              <Text style={styles.subtitle}>
                {t('livraison.history.subtitle')}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{totalDelivered}</Text>
                <Text style={styles.statLabel}>{t('livraison.history.deliveredLabel')}</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statValue}>{totalItems}</Text>
                <Text style={styles.statLabel}>{t('livraison.history.articlesLabel')}</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {formatPrice(totalRevenue, historyCurrency)}
                </Text>
                <Text style={styles.statLabel}>{t('livraison.history.totalAmountLabel')}</Text>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const itemCount = getItemsCount(item?.items);
          const deliveredStyle = getDeliveredStatusStyle();
          const orderReference = String(item?._id || '')
            .slice(-6)
            .toUpperCase();

          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/livraison/[id]',
                  params: { id: item?._id },
                })
              }
            >
              <View style={styles.cardTopRow}>
                <View style={styles.orderMainInfo}>
                  <Text style={styles.orderTitle}>
                    {normalizeText(item?.restaurant?.name, t('livraison.history.restaurantFallback'))}
                  </Text>
                  <Text style={styles.orderSubTitle}>
                    {t('livraison.history.orderReference', { ref: orderReference || '------' })}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: deliveredStyle.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: deliveredStyle.text },
                    ]}
                  >
                    {t('livraison.status.delivered')}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaBadge}>
                  <Ionicons name="bag-handle-outline" size={14} color="#084424" />
                  <Text style={styles.metaBadgeText}>{t('livraison.itemsCount', { count: itemCount })}</Text>
                </View>

                <View style={styles.metaBadge}>
                  <Ionicons name="cash-outline" size={14} color="#C8331A" />
                  <Text style={styles.metaBadgeText}>
                    {formatPrice(item?.totalPrice, item?.currency || 'EUR')}
                  </Text>
                </View>

                <View style={styles.metaBadge}>
                  <Ionicons name="calendar-outline" size={14} color="#084424" />
                  <Text style={styles.metaBadgeText}>
                    {formatDate(item?.updatedAt || item?.createdAt)}
                  </Text>
                </View>
              </View>

              {!!normalizeText(item?.deliveryAddress) && (
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={15} color="#777" />
                  <Text style={styles.addressText}>
                    {normalizeText(item?.deliveryAddress)}
                  </Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={15} color="#777" />
                <Text style={styles.infoText}>
                  {t('livraison.history.deliveredOnLabel', { date: formatDateTime(item?.updatedAt || item?.createdAt) })}
                </Text>
              </View>

              {!!normalizeText(item?.user?.name) && (
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={15} color="#777" />
                  <Text style={styles.infoText}>
                    {normalizeText(item?.user?.name)}
                  </Text>
                </View>
              )}

              <View style={styles.footerRow}>
                <Text style={styles.detailsText}>{t('livraison.history.viewDetails')}</Text>
                <Ionicons name="chevron-forward" size={18} color="#777" />
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={54} color="#606D5D" />
            <Text style={styles.emptyTitle}>{t('livraison.history.emptyTitle')}</Text>
            <Text style={styles.emptyText}>
              {t('livraison.history.emptyText')}
            </Text>
          </View>
        }
      />
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF6EC',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
  },
  emptyListContent: {
    flexGrow: 1,
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
  topActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  header: {
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C8331A',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 8,
  },
  subtitle: {
    color: '#606D5D',
    fontSize: 14,
    lineHeight: 21,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D1C11',
    marginBottom: 6,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#777',
    fontWeight: '700',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 22,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderMainInfo: {
    flex: 1,
    marginRight: 10,
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0D1C11',
    marginBottom: 4,
  },
  orderSubTitle: {
    fontSize: 13,
    color: '#777',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2ECE0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  metaBadgeText: {
    marginLeft: 6,
    color: '#555',
    fontWeight: '700',
    fontSize: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  addressText: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 6,
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  infoText: {
    color: '#666',
    fontSize: 13,
    lineHeight: 19,
    marginLeft: 6,
    flex: 1,
  },
  footerRow: {
    borderTopWidth: 1,
    borderTopColor: '#F2ECE0',
    paddingTop: 12,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsText: {
    color: '#0D1C11',
    fontWeight: '800',
    fontSize: 14,
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
    marginBottom: 18,
  },
  emptyButton: {
    backgroundColor: '#EAB02F',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  emptyButtonText: {
    color: '#111',
    fontWeight: '800',
    fontSize: 15,
  },
});