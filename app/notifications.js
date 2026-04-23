/**
 * =========================================================
 * NOTIFICATIONS SCREEN — AFROEAT
 * app/notifications.js
 * =========================================================
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  StatusBar,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

// ─── Types de notifications ───────────────────────────────
const NOTIF_TYPES = {
  ORDER_CONFIRMED:  'order_confirmed',
  ORDER_PREPARING:  'order_preparing',
  ORDER_DELIVERING: 'order_delivering',
  ORDER_DELIVERED:  'order_delivered',
  ORDER_CANCELLED:  'order_cancelled',
  PROMO:            'promo',
  SYSTEM:           'system',
  WELCOME:          'welcome',
};

const getNotifIcon = (type) => {
  switch (type) {
    case NOTIF_TYPES.ORDER_CONFIRMED:  return { name: 'checkmark-circle',    color: '#1F6F43' };
    case NOTIF_TYPES.ORDER_PREPARING:  return { name: 'flame',                color: '#D96C2D' };
    case NOTIF_TYPES.ORDER_DELIVERING: return { name: 'bicycle',              color: '#245EA8' };
    case NOTIF_TYPES.ORDER_DELIVERED:  return { name: 'gift',                 color: '#1F6F43' };
    case NOTIF_TYPES.ORDER_CANCELLED:  return { name: 'close-circle',         color: '#B63B3B' };
    case NOTIF_TYPES.PROMO:            return { name: 'pricetag',             color: '#D4A017' };
    case NOTIF_TYPES.WELCOME:          return { name: 'sparkles',             color: '#D4A017' };
    default:                           return { name: 'notifications-circle', color: '#245EA8' };
  }
};

const formatRelativeTime = (dateString) => {
  const now   = Date.now();
  const then  = new Date(dateString).getTime();
  const diffS = Math.floor((now - then) / 1000);

  if (diffS < 60)     return 'À l\'instant';
  if (diffS < 3600)   return `Il y a ${Math.floor(diffS / 60)} min`;
  if (diffS < 86400)  return `Il y a ${Math.floor(diffS / 3600)} h`;
  if (diffS < 604800) return `Il y a ${Math.floor(diffS / 86400)} j`;
  return new Date(dateString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

// ─── Données de démonstration (à remplacer par API) ───────
const buildDemoNotifications = (user) => {
  const now = new Date();
  const ago = (minutes) => new Date(now.getTime() - minutes * 60000).toISOString();

  return [
    {
      id: '1',
      type: NOTIF_TYPES.WELCOME,
      title: `Bienvenue sur Afroeat, ${user?.name || 'toi'} ! 🎉`,
      body: 'Découvre les meilleurs restaurants africains près de toi. Commande maintenant et régale-toi !',
      read: false,
      createdAt: ago(5),
      route: '/(tabs)',
    },
    {
      id: '2',
      type: NOTIF_TYPES.ORDER_DELIVERED,
      title: 'Commande livrée ✅',
      body: 'Ta commande a bien été livrée. Bon appétit ! Pense à laisser un avis.',
      read: false,
      createdAt: ago(35),
      route: '/(tabs)/orders',
    },
    {
      id: '3',
      type: NOTIF_TYPES.PROMO,
      title: '🔥 Offre spéciale ce soir',
      body: 'Livraison offerte sur tous les restaurants ouverts jusqu\'à 23h. Profite-en maintenant !',
      read: false,
      createdAt: ago(90),
      route: '/(tabs)/explore',
    },
    {
      id: '4',
      type: NOTIF_TYPES.ORDER_CONFIRMED,
      title: 'Commande confirmée',
      body: 'Le restaurant a bien reçu ta commande et va commencer la préparation.',
      read: true,
      createdAt: ago(300),
      route: '/(tabs)/orders',
    },
    {
      id: '5',
      type: NOTIF_TYPES.ORDER_PREPARING,
      title: 'En cours de préparation 👨‍🍳',
      body: 'Ton plat est en préparation. Temps estimé : 20–25 min.',
      read: true,
      createdAt: ago(480),
      route: '/(tabs)/orders',
    },
    {
      id: '6',
      type: NOTIF_TYPES.SYSTEM,
      title: 'Mise à jour disponible',
      body: 'Une nouvelle version d\'Afroeat est disponible avec de nouvelles fonctionnalités.',
      read: true,
      createdAt: ago(1440),
      route: null,
    },
  ];
};

// ─── Composant item ────────────────────────────────────────
const NotifItem = ({ item, onPress, onMarkRead }) => {
  const icon = getNotifIcon(item.type);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.item,
        !item.read && styles.itemUnread,
        pressed && styles.itemPressed,
      ]}
      onPress={() => onPress(item)}
    >
      <View style={[styles.iconWrap, { backgroundColor: icon.color + '18' }]}>
        <Ionicons name={icon.name} size={22} color={icon.color} />
      </View>

      <View style={styles.itemContent}>
        <View style={styles.itemTop}>
          <Text style={[styles.itemTitle, !item.read && styles.itemTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.itemTime}>{formatRelativeTime(item.createdAt)}</Text>
      </View>
    </Pressable>
  );
};

// ─── Screen ───────────────────────────────────────────────
export default function NotificationsScreen() {
  const auth = useAuth() || {};
  const user = auth.user ?? null;

  const [notifications, setNotifications] = useState(() => buildDemoNotifications(user));
  const [refreshing,    setRefreshing]    = useState(false);
  const [filter,        setFilter]        = useState('all'); // 'all' | 'unread'

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const displayed = useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !n.read);
    return notifications;
  }, [notifications, filter]);

  const handlePress = useCallback((item) => {
    // Marquer comme lu
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    // Naviguer
    if (item.route) {
      router.push(item.route);
    }
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Effacer les notifications',
      'Toutes les notifications seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: () => setNotifications([]),
        },
      ]
    );
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setNotifications(buildDemoNotifications(user));
      setRefreshing(false);
    }, 800);
  }, [user]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#111" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
          onPress={handleMarkAllRead}
          disabled={unreadCount === 0}
        >
          <Ionicons
            name="checkmark-done"
            size={22}
            color={unreadCount > 0 ? '#1F6F43' : '#CCC'}
          />
        </Pressable>
      </View>

      {/* ── Filtres ── */}
      <View style={styles.filters}>
        {['all', 'unread'].map((f) => (
          <Pressable
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Toutes' : `Non lues (${unreadCount})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Liste ── */}
      <FlatList
        data={displayed}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotifItem item={item} onPress={handlePress} />
        )}
        contentContainerStyle={[
          styles.list,
          displayed.length === 0 && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#D4A017']}
            tintColor="#D4A017"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={56} color="#DDD" />
            <Text style={styles.emptyTitle}>Aucune notification</Text>
            <Text style={styles.emptyText}>
              {filter === 'unread'
                ? 'Toutes tes notifications ont été lues.'
                : 'Tu n\'as pas encore de notifications.'}
            </Text>
          </View>
        }
        ListFooterComponent={
          displayed.length > 0 ? (
            <Pressable style={styles.clearBtn} onPress={handleClearAll}>
              <Text style={styles.clearBtnText}>Effacer toutes les notifications</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#FFF8F0' },
  header:            { flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#FFF8F0' },
  backBtn:           { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EDE5D8' },
  headerCenter:      { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12, gap: 8 },
  headerTitle:       { fontSize: 20, fontWeight: '900', color: '#111' },
  headerBadge:       { backgroundColor: '#D4A017', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  headerBadgeText:   { fontSize: 12, fontWeight: '900', color: '#111' },
  headerAction:      { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EDE5D8' },
  pressed:           { opacity: 0.75 },
  filters:           { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  filterBtn:         { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0E9DF', borderWidth: 1, borderColor: '#E8DDD0' },
  filterBtnActive:   { backgroundColor: '#111', borderColor: '#111' },
  filterText:        { fontSize: 13, fontWeight: '700', color: '#777' },
  filterTextActive:  { color: '#FFF' },
  list:              { paddingHorizontal: 16, paddingBottom: 32 },
  listEmpty:         { flex: 1, justifyContent: 'center' },
  item:              { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F2E9DD', gap: 12 },
  itemUnread:        { borderColor: '#D4A017', backgroundColor: '#FFFDF5' },
  itemPressed:       { opacity: 0.82 },
  iconWrap:          { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  itemContent:       { flex: 1 },
  itemTop:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  itemTitle:         { fontSize: 14, fontWeight: '700', color: '#555', flex: 1, paddingRight: 6 },
  itemTitleUnread:   { fontWeight: '900', color: '#111' },
  unreadDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D4A017', flexShrink: 0 },
  itemBody:          { fontSize: 13, color: '#777', lineHeight: 18, marginBottom: 6 },
  itemTime:          { fontSize: 11, color: '#AAA', fontWeight: '700' },
  empty:             { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle:        { fontSize: 18, fontWeight: '900', color: '#333', marginTop: 16, marginBottom: 8 },
  emptyText:         { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },
  clearBtn:          { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  clearBtnText:      { fontSize: 13, fontWeight: '700', color: '#B63B3B' },
});
