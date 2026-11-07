import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import FadeInView from '../components/FadeInView';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  getFavoriteRestaurants,
  removeFavoriteRestaurant,
} from '../services/favoriteService';

const normalizeRole = (role) => {
  const normalized = String(role || 'client').trim().toLowerCase();
  if (['restaurant', 'resto'].includes(normalized)) return 'restaurant';
  if (['livreur', 'driver', 'delivery', 'courier'].includes(normalized)) return 'livreur';
  if (['admin', 'administrator', 'superadmin'].includes(normalized)) return 'admin';
  return 'client';
};

const getRoleRedirect = (role) => {
  const normalized = normalizeRole(role);
  if (normalized === 'restaurant') return '/restaurant/RestaurantDashboard';
  if (normalized === 'livreur') return '/livraison';
  if (normalized === 'admin') return '/admin';
  return null;
};

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState('');
  const requestIdRef = useRef(0);
  const mutationVersionRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const fetchFavorites = useCallback(async (manual = false) => {
    const requestId = ++requestIdRef.current;
    const mutationVersion = mutationVersionRef.current;

    if (authLoading) return;

    if (!token) {
      setFavorites([]);
      setLoading(false);
      setRefreshing(false);
      hasLoadedOnceRef.current = true;
      return;
    }

    if (manual || hasLoadedOnceRef.current) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const restaurants = await getFavoriteRestaurants(token);
      if (
        requestId === requestIdRef.current &&
        mutationVersion === mutationVersionRef.current
      ) {
        setFavorites(restaurants);
      }
    } catch (fetchError) {
      if (requestId === requestIdRef.current) {
        setError(fetchError?.message || t('favorites.loadError'));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
        hasLoadedOnceRef.current = true;
      }
    }
  }, [authLoading, token, t]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading && isAuthenticated) fetchFavorites();
      return undefined;
    }, [authLoading, fetchFavorites, isAuthenticated])
  );

  const handleRemove = useCallback(async (restaurantId) => {
    if (!restaurantId || removingId) return;
    setRemovingId(String(restaurantId));
    setError('');
    try {
      await removeFavoriteRestaurant(restaurantId, token);
      mutationVersionRef.current += 1;
      setFavorites((current) => current.filter(
        (restaurant) => String(restaurant?._id || restaurant?.id) !== String(restaurantId)
      ));
    } catch (removeError) {
      setError(removeError?.message || t('favorites.removeError'));
    } finally {
      setRemovingId('');
    }
  }, [removingId, token, t]);

  if (authLoading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#D4A017" />
        <Text style={styles.loaderText}>{t('favorites.loading')}</Text>
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/auth/role" />;

  const roleRedirect = getRoleRedirect(auth.role || auth.user?.role);
  if (roleRedirect) return <Redirect href={roleRedirect} />;

  const renderItem = ({ item }) => {
    const restaurantId = item?._id || item?.id;
    const imageUri = normalizeText(item?.image || item?.coverImage);

    return (
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('explore.openRestaurant', { name: item?.name || t('favorites.restaurantFallback') })}
          style={({ pressed }) => [styles.cardMain, pressed && styles.buttonPressed]}
          onPress={() => restaurantId && router.push(`/restaurant/${restaurantId}`)}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.cardImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={160}
            />
          ) : (
            <View style={styles.cardImageFallback}>
              <Ionicons name="restaurant-outline" size={24} color="#9A846C" />
            </View>
          )}
          <View style={styles.cardText}>
            <Text style={styles.name} numberOfLines={1}>
              {normalizeText(item?.name, t('favorites.restaurantFallback'))}
            </Text>
            <Text style={styles.desc} numberOfLines={2}>
              {normalizeText(item?.description || item?.cuisine, t('favorites.cuisineFallback'))}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999999" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('favorites.removeAction')}
          disabled={removingId === String(restaurantId)}
          style={({ pressed }) => [styles.removeButton, pressed && styles.buttonPressed]}
          onPress={() => handleRemove(restaurantId)}
        >
          {removingId === String(restaurantId) ? (
            <ActivityIndicator size="small" color="#9B3428" />
          ) : (
            <Ionicons name="heart" size={19} color="#B54A3A" />
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
      <View style={styles.header}>
        <View style={styles.badge}>
          <Ionicons name="heart-outline" size={14} color="#A36A00" />
          <Text style={styles.badgeText}>{t('favorites.badge')}</Text>
        </View>
        <Text style={styles.title}>{t('favorites.title')}</Text>
        <Text style={styles.subtitle}>{t('favorites.subtitle')}</Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={refreshing}
            onPress={() => fetchFavorites(true)}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#1F6F43" />
            ) : (
              <Text style={styles.retryText}>{t('restaurant.retry')}</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {(loading || refreshing) && favorites.length === 0 ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#1F6F43" />
          <Text style={styles.loaderText}>{t('favorites.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item, index) => String(item?._id || item?.id || index)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchFavorites(true)}
              colors={['#D4A017']}
              tintColor="#D4A017"
            />
          }
          ListEmptyComponent={
            !error ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="heart-outline" size={60} color="#C9B8A3" />
                <Text style={styles.emptyTitle}>{t('favorites.emptyTitle')}</Text>
                <Text style={styles.emptyText}>{t('favorites.emptyText')}</Text>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                  onPress={() => router.push('/(tabs)/explore')}
                >
                  <Text style={styles.buttonText}>{t('checkout.exploreRestaurants')}</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0', paddingTop: 40, paddingHorizontal: 16 },
  loader: { flex: 1, backgroundColor: '#FFF8F0', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  loaderText: { marginTop: 12, color: '#555555', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  header: { marginBottom: 20, alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3D8', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
  badgeText: { marginLeft: 6, color: '#A36A00', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  title: { fontSize: 28, fontWeight: '900', color: '#1E1E1E', textAlign: 'center', marginBottom: 8 },
  subtitle: { textAlign: 'center', color: '#777777', fontSize: 14, lineHeight: 20 },
  listContent: { paddingBottom: 120, flexGrow: 1 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 10, marginBottom: 14, flexDirection: 'row', alignItems: 'center', shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardMain: { flex: 1, minWidth: 0, padding: 4, flexDirection: 'row', alignItems: 'center' },
  cardImage: { width: 62, height: 62, borderRadius: 16, backgroundColor: '#F1ECE5', marginRight: 12 },
  cardImageFallback: { width: 62, height: 62, borderRadius: 16, backgroundColor: '#F1ECE5', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '800', color: '#1E1E1E', marginBottom: 4 },
  desc: { fontSize: 13, color: '#777777', lineHeight: 18 },
  removeButton: { width: 42, height: 48, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 24, flex: 1 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1E1E1E', marginTop: 16, marginBottom: 8, textAlign: 'center' },
  emptyText: { color: '#777777', textAlign: 'center', lineHeight: 22, fontSize: 15, marginBottom: 20 },
  button: { backgroundColor: '#D4A017', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  buttonText: { color: '#1E1E1E', fontWeight: '800', fontSize: 15 },
  buttonPressed: { opacity: 0.84 },
  errorBanner: { marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: '#FCE8E4' },
  errorText: { color: '#8F3428', textAlign: 'center', marginBottom: 4 },
  retryText: { color: '#1F6F43', fontWeight: '800', textAlign: 'center' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
