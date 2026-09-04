import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Redirect } from 'expo-router';
import FadeInView from '../components/FadeInView';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeRole = (role) => {
  const normalized = String(role ?? 'client').trim().toLowerCase();

  if (normalized === 'restaurant' || normalized === 'resto') {
    return 'restaurant';
  }

  if (
    normalized === 'livreur' ||
    normalized === 'driver' ||
    normalized === 'delivery' ||
    normalized === 'courier'
  ) {
    return 'livreur';
  }

  if (
    normalized === 'admin' ||
    normalized === 'administrator' ||
    normalized === 'superadmin'
  ) {
    return 'admin';
  }

  return 'client';
};

const getRoleRedirect = (role) => {
  const normalized = normalizeRole(role);

  if (normalized === 'restaurant') {
    return '/restaurant/RestaurantDashboard';
  }

  if (normalized === 'livreur') {
    return '/livraison';
  }

  if (normalized === 'admin') {
    return '/admin';
  }

  return null;
};

const getFallbackImage = () => {
  return 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?q=80&w=1200&auto=format&fit=crop';
};

const getRestaurantRoute = (restaurantId) => {
  const safeId = normalizeText(restaurantId);
  return safeId ? `/restaurant/${safeId}` : null;
};

const normalizeFavorite = (item = {}) => {
  return {
    ...item,
    _id: item?._id || item?.id || item?.restaurantId || '',
    id: item?.id || item?._id || item?.restaurantId || '',
    name: normalizeText(item?.name, 'Restaurant africain'),
    description: normalizeText(item?.description),
    cuisine: normalizeText(item?.cuisine, 'Cuisine africaine'),
    image: normalizeText(item?.image || item?.coverImage || item?.photo),
  };
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const auth = useAuth() || {};

  const isAuthenticated = Boolean(auth.isAuthenticated);
  const loading = Boolean(auth.loading);
  const user = auth.user ?? null;
  const role = normalizeRole(auth.role || user?.role);

  /**
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <ActivityIndicator size="large" color="#D4A017" />
        <Text style={styles.loaderText}>{t('favorites.loading')}</Text>
      </View>
    );
  }

  /**
   * =========================================================
   * AUTH GATE
   * =========================================================
   */

  if (!isAuthenticated) {
    return <Redirect href="/auth/role" />;
  }

  /**
   * =========================================================
   * SÉPARATION STRUCTURELLE DES BLOCS
   * =========================================================
   * Cet écran favoris appartient au bloc client.
   * Les autres rôles sont redirigés vers leur espace dédié.
   */

  const roleRedirect = getRoleRedirect(role);

  if (roleRedirect) {
    return <Redirect href={roleRedirect} />;
  }

  /**
   * =========================================================
   * DATA
   * =========================================================
   * Placeholder verrouillé côté UI.
   * Prêt à brancher sur backend sans refaire l’écran.
   */

  const favorites = useMemo(() => {
    const source =
      user?.favorites ||
      user?.favourites ||
      user?.favoriteRestaurants ||
      [];

    return normalizeArray(source)
      .map(normalizeFavorite)
      .filter((item) => item?._id);
  }, [user]);

  const handleExplore = useCallback(() => {
    router.push('/(tabs)/explore');
  }, []);

  const handleOpenRestaurant = useCallback((restaurantId) => {
    const route = getRestaurantRoute(restaurantId);
    if (!route) return;
    router.push(route);
  }, []);

  const renderItem = ({ item }) => {
    const restaurantId = item?._id || item?.id || null;
    const imageUri = normalizeText(item?.image, getFallbackImage());

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('explore.openRestaurant', {
          name: normalizeText(item?.name, 'restaurant'),
        })}
        style={({ pressed }) => [styles.card, pressed && styles.buttonPressed]}
        onPress={() => handleOpenRestaurant(restaurantId)}
      >
        <Image source={{ uri: imageUri }} style={styles.cardImage} />

        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={1}>
            {normalizeText(item?.name, t('favorites.restaurantFallback'))}
          </Text>

          <Text style={styles.desc} numberOfLines={2}>
            {normalizeText(
              item?.description || item?.cuisine,
              t('favorites.cuisineFallback')
            )}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={20} color="#999999" />
      </Pressable>
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
        <Text style={styles.subtitle}>
          {t('favorites.subtitle')}
        </Text>
      </View>

      <FlatList
        data={favorites}
        keyExtractor={(item, index) =>
          item?._id || item?.id || index.toString()
        }
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={60} color="#C9B8A3" />

            <Text style={styles.emptyTitle}>{t('favorites.emptyTitle')}</Text>

            <Text style={styles.emptyText}>
              {t('favorites.emptyText')}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('checkout.exploreRestaurants')}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleExplore}
            >
              <Text style={styles.buttonText}>{t('checkout.exploreRestaurants')}</Text>
            </Pressable>
          </View>
        }
      />
    </FadeInView>
  );
}

/**
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    paddingTop: 40,
    paddingHorizontal: 16,
  },

  loader: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  loaderText: {
    marginTop: 12,
    color: '#555555',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },

  header: {
    marginBottom: 20,
    alignItems: 'center',
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3D8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },

  badgeText: {
    marginLeft: 6,
    color: '#A36A00',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1E1E1E',
    textAlign: 'center',
    marginBottom: 8,
  },

  subtitle: {
    textAlign: 'center',
    color: '#777777',
    fontSize: 14,
    lineHeight: 20,
  },

  listContent: {
    paddingBottom: 120,
    flexGrow: 1,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  cardImage: {
    width: 62,
    height: 62,
    borderRadius: 16,
    backgroundColor: '#F1ECE5',
    marginRight: 12,
  },

  content: {
    flex: 1,
  },

  name: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1E1E',
    marginBottom: 4,
  },

  desc: {
    fontSize: 13,
    color: '#777777',
    lineHeight: 18,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 24,
    flex: 1,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E1E1E',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },

  emptyText: {
    color: '#777777',
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 15,
    marginBottom: 20,
  },

  button: {
    backgroundColor: '#D4A017',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },

  buttonText: {
    color: '#1E1E1E',
    fontWeight: '800',
    fontSize: 15,
  },

  buttonPressed: {
    opacity: 0.84,
  },
});