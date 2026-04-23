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
import FadeInView from '../../components/FadeInView';
import { useAuth } from '../../context/AuthContext';
import { getAssignedOrders } from '../../services/deliveryService';

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
  const amount = normalizeNumber(value, 0);

  if (currency === 'USD') return `$${amount.toFixed(2)}`;
  if (currency === 'GBP') return `£${amount.toFixed(2)}`;
  if (currency === 'XOF' || currency === 'XAF') return `${amount.toFixed(0)} ${currency}`;
  if (currency === 'CAD') return `${amount.toFixed(2)} $CA`;

  return `${amount.toFixed(2)} €`;
};

const formatDate = (value) => {
  if (!value) return 'Date indisponible';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date indisponible';
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
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
  });
};

const getDeliveredStatusStyle = () => {
  return {
    bg: '#E8F5ED',
    text: '#1F6F43',
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
          'Erreur',
          error?.message || 'Impossible de charger l’historique des livraisons.'
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
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#D96C2D" />
        <Text style={styles.loaderText}>Chargement de l’historique...</Text>
      </View>
    );
  }

  if (!isAuthenticated || currentRole !== 'livreur') {
    return (
      <FadeInView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={54} color="#C8BBAA" />
          <Text style={styles.emptyTitle}>Accès réservé au livreur</Text>
          <Text style={styles.emptyText}>
            Connecte-toi avec un compte livreur pour consulter l’historique.
          </Text>

          <Pressable
            style={styles.emptyButton}
            onPress={() => router.replace('/auth/role')}
          >
            <Text style={styles.emptyButtonText}>Retour à la connexion</Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

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
                <Ionicons name="arrow-back" size={20} color="#1E1E1E" />
              </Pressable>

              <Pressable
                style={styles.topButton}
                onPress={() => fetchHistory(true)}
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
              <Text style={styles.eyebrow}>Espace livraison</Text>
              <Text style={styles.title}>Historique des livraisons</Text>
              <Text style={styles.subtitle}>
                Retrouve toutes les commandes que tu as déjà livrées, avec leur
                montant, leur date et le détail complet.
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{totalDelivered}</Text>
                <Text style={styles.statLabel}>Livrées</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statValue}>{totalItems}</Text>
                <Text style={styles.statLabel}>Articles</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {formatPrice(totalRevenue, historyCurrency)}
                </Text>
                <Text style={styles.statLabel}>Montant total</Text>
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
                    {normalizeText(item?.restaurant?.name, 'Restaurant Afroeat')}
                  </Text>
                  <Text style={styles.orderSubTitle}>
                    Commande #{orderReference || '------'}
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
                    Livrée
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaBadge}>
                  <Ionicons name="bag-handle-outline" size={14} color="#1F6F43" />
                  <Text style={styles.metaBadgeText}>{itemCount} article(s)</Text>
                </View>

                <View style={styles.metaBadge}>
                  <Ionicons name="cash-outline" size={14} color="#D96C2D" />
                  <Text style={styles.metaBadgeText}>
                    {formatPrice(item?.totalPrice, item?.currency || 'EUR')}
                  </Text>
                </View>

                <View style={styles.metaBadge}>
                  <Ionicons name="calendar-outline" size={14} color="#245EA8" />
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
                  Livrée le {formatDateTime(item?.updatedAt || item?.createdAt)}
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
                <Text style={styles.detailsText}>Voir le détail</Text>
                <Ionicons name="chevron-forward" size={18} color="#777" />
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={54} color="#C8BBAA" />
            <Text style={styles.emptyTitle}>Aucune livraison terminée</Text>
            <Text style={styles.emptyText}>
              Ton historique apparaîtra ici dès que tu auras livré des commandes.
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
    backgroundColor: '#FFF8F0',
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
    backgroundColor: '#FFF8F0',
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
    color: '#D96C2D',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1E1E1E',
    marginBottom: 8,
  },
  subtitle: {
    color: '#6B655E',
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
    color: '#1E1E1E',
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
    color: '#1E1E1E',
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
    backgroundColor: '#F8F8F8',
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
    borderTopColor: '#F2ECE5',
    paddingTop: 12,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsText: {
    color: '#1E1E1E',
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
    marginBottom: 18,
  },
  emptyButton: {
    backgroundColor: '#D4A017',
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