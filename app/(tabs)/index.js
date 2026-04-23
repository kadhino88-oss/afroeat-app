import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { router, Redirect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import FadeInView from '../../components/FadeInView';
import HomeHeader from '../../components/HomeHeader';
import { getAllRestaurants } from '../../services/restaurantService';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

/**
 * =========================================================
 * ASSETS
 * =========================================================
 */

const LOGO_IMAGE = require('../assets/images/icon.png');

/**
 * =========================================================
 * DATA
 * =========================================================
 */

const CATEGORIES = [
  {
    id: '1',
    title: 'Restaurants',
    icon: 'silverware-fork-knife',
    route: '/(tabs)/explore',
  },
  {
    id: '2',
    title: 'Épiceries',
    icon: 'cart-outline',
    route: '/(tabs)/explore',
  },
  {
    id: '3',
    title: 'Boutiques',
    icon: 'shopping-outline',
    route: '/(tabs)/explore',
  },
];

const CUISINES = [
  'Africaine',
  'Sénégalaise',
  'Ivoirienne',
  'Camerounaise',
  'Congolaise',
  'Malienne',
  'Marocaine',
  'Algérienne',
  'Tunisienne',
  'Épicerie',
  'Boutique',
];

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeSearch = (value) => {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeBoolean = (value, fallback = true) => {
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

  return fallback;
};

const normalizeRole = (value) => {
  const role = normalizeText(value, 'client').toLowerCase();

  if (
    role === 'restaurant' ||
    role === 'resto' ||
    role === 'partner_restaurant'
  ) {
    return 'restaurant';
  }

  if (
    role === 'livreur' ||
    role === 'driver' ||
    role === 'delivery' ||
    role === 'courier'
  ) {
    return 'livreur';
  }

  if (
    role === 'admin' ||
    role === 'administrator' ||
    role === 'superadmin' ||
    role === 'super-admin' ||
    role === 'ops'
  ) {
    return 'admin';
  }

  return 'client';
};

const getAfricanFoodImage = (cuisine) => {
  const value = normalizeSearch(cuisine);

  if (value.includes('maroc')) {
    return 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?q=80&w=1200&auto=format&fit=crop';
  }

  if (value.includes('alger')) {
    return 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?q=80&w=1200&auto=format&fit=crop';
  }

  if (value.includes('tun')) {
    return 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?q=80&w=1200&auto=format&fit=crop';
  }

  if (value.includes('sen')) {
    return 'https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=1200&auto=format&fit=crop';
  }

  if (value.includes('ivoir')) {
    return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200&auto=format&fit=crop';
  }

  if (value.includes('camer')) {
    return 'https://images.unsplash.com/photo-1559847844-5315695dadae?q=80&w=1200&auto=format&fit=crop';
  }

  if (value.includes('congo')) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop';
  }

  if (value.includes('mali')) {
    return 'https://images.unsplash.com/photo-1604908176997-4317d4f66c8f?q=80&w=1200&auto=format&fit=crop';
  }

  if (value.includes('afric')) {
    return 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?q=80&w=1200&auto=format&fit=crop';
  }

  return 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?q=80&w=1200&auto=format&fit=crop';
};

const normalizeRestaurant = (item = {}, index = 0) => {
  return {
    ...item,
    _id: item?._id || item?.id || '',
    id: item?.id || item?._id || '',
    name: normalizeText(item?.name, 'Restaurant africain'),
    cuisine: normalizeText(item?.cuisine, 'Cuisine africaine'),
    address: normalizeText(
      item?.address || item?.location || item?.city,
      'Adresse non disponible'
    ),
    image: normalizeText(item?.image),
    coverImage: normalizeText(item?.coverImage),
    isOpen: normalizeBoolean(item?.isOpen, true),
    isFeatured: normalizeBoolean(item?.isFeatured, false),
    rating: normalizeNumber(
      item?.ratingAverage ?? item?.rating,
      4.7
    ),
    deliveryTime: normalizeText(
      item?.deliveryTime ||
        item?.estimatedDeliveryTime ||
        item?.averagePreparationTimeMinutes
          ? `${normalizeNumber(
              item?.deliveryTime ||
                item?.estimatedDeliveryTime ||
                item?.averagePreparationTimeMinutes,
              20 + index * 3
            )} min`
          : `${20 + index * 3} min`
    ),
    deliveryFee: normalizeText(item?.deliveryFee, '2.99 €'),
    currency: normalizeText(item?.currency, 'EUR'),
  };
};

const extractRestaurantsPayload = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.restaurants)) return data.restaurants;
  if (Array.isArray(data?.data?.restaurants)) return data.data.restaurants;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function HomeScreen() {
  const cart = useCart() || {};
  const auth = useAuth() || {};

  const getTotalItems =
    typeof cart.getTotalItems === 'function' ? cart.getTotalItems : null;

  const { user, isAuthenticated, loading: authLoading, role, token } = auth;

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role);
  }, [role, user]);

  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const cartCount = useMemo(() => {
    return getTotalItems ? getTotalItems() : 0;
  }, [getTotalItems]);

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const userName = useMemo(() => {
    const fullName = `${normalizeText(user?.firstName)} ${normalizeText(
      user?.lastName
    )}`.trim();

    return (
      normalizeText(user?.firstName) ||
      normalizeText(user?.prenom) ||
      normalizeText(user?.name) ||
      normalizeText(user?.fullName) ||
      normalizeText(fullName) ||
      'Bonjour'
    );
  }, [user]);

  const userAddress = useMemo(() => {
    return normalizeText(
      user?.address ||
        user?.adresse ||
        user?.deliveryAddress ||
        user?.profile?.address,
      'Livraison à domicile'
    );
  }, [user]);

  const userAvatar = useMemo(() => {
    return normalizeText(
      user?.avatar || user?.photo || user?.profileImage || user?.image
    );
  }, [user]);

  const redirectPath = useMemo(() => {
    if (authLoading || !isAuthenticated) return null;

    if (currentRole === 'restaurant') {
      return '/restaurant/RestaurantDashboard';
    }

    if (currentRole === 'livreur') {
      return '/livraison';
    }

    if (currentRole === 'admin') {
      return '/admin';
    }

    return null;
  }, [authLoading, isAuthenticated, currentRole]);

  const loadRestaurants = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage('');

      const data = await getAllRestaurants(tokenRef.current);
      const extracted = extractRestaurantsPayload(data);
      const safeRestaurants = extracted
        .map(normalizeRestaurant)
        .filter((item) => item?._id);

      setRestaurants(safeRestaurants);
    } catch (error) {
      console.log('Erreur restaurants :', error);
      setRestaurants([]);
      setErrorMessage(
        error?.message || 'Impossible de charger les restaurants.'
      );
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!redirectPath) {
      loadRestaurants();
    }
  }, [loadRestaurants, redirectPath]);

  const filteredRestaurants = useMemo(() => {
    const query = normalizeSearch(search);

    const filtered = restaurants.filter((item) => {
      const name = normalizeSearch(item?.name);
      const cuisine = normalizeSearch(item?.cuisine);
      const address = normalizeSearch(item?.address);

      if (!query) return true;

      return (
        name.includes(query) ||
        cuisine.includes(query) ||
        address.includes(query)
      );
    });

    return filtered.sort((a, b) => {
      const aFeatured = a?.isFeatured ? 1 : 0;
      const bFeatured = b?.isFeatured ? 1 : 0;

      if (aFeatured !== bFeatured) {
        return bFeatured - aFeatured;
      }

      const aOpen = a?.isOpen ? 1 : 0;
      const bOpen = b?.isOpen ? 1 : 0;

      if (aOpen !== bOpen) {
        return bOpen - aOpen;
      }

      return normalizeNumber(b?.rating, 0) - normalizeNumber(a?.rating, 0);
    });
  }, [restaurants, search]);

  const featuredCount = useMemo(() => {
    return filteredRestaurants.filter((item) => item?.isFeatured).length;
  }, [filteredRestaurants]);

  const handleCuisinePress = useCallback((value) => {
    setSearch(value);
  }, []);

  const handleCategoryPress = useCallback((routeValue) => {
    router.push(routeValue);
  }, []);

  const handleOpenRestaurant = useCallback((restaurantId) => {
    if (!restaurantId) return;
    router.push(`/restaurant/${restaurantId}`);
  }, []);

  const renderRestaurant = useCallback(
    ({ item }) => {
      const isOpen = item?.isOpen !== false;
      const rating = normalizeNumber(item?.rating, 4.7).toFixed(1);
      const deliveryTime = item?.deliveryTime || '25 min';
      const deliveryFee = item?.deliveryFee || '2.99 €';

      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ouvrir ${item?.name}`}
          style={({ pressed }) => [
            styles.restaurantCard,
            pressed && styles.restaurantCardPressed,
          ]}
          onPress={() => handleOpenRestaurant(item?._id)}
        >
          <View style={styles.restaurantImageWrapper}>
            <Image
              source={{
                uri:
                  item?.image ||
                  item?.coverImage ||
                  getAfricanFoodImage(item?.cuisine),
              }}
              style={styles.restaurantImage}
            />

            <View style={styles.badge}>
              <Ionicons name="star" size={13} color="#D4A017" />
              <Text style={styles.badgeText}>{rating}</Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                isOpen ? styles.statusBadgeOpen : styles.statusBadgeClosed,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  isOpen
                    ? styles.statusBadgeTextOpen
                    : styles.statusBadgeTextClosed,
                ]}
              >
                {isOpen ? 'Ouvert' : 'Fermé'}
              </Text>
            </View>

            {!!item?.isFeatured && (
              <View style={styles.featuredBadge}>
                <Ionicons name="flash-outline" size={12} color="#1E1E1E" />
                <Text style={styles.featuredBadgeText}>Mis en avant</Text>
              </View>
            )}
          </View>

          <View style={styles.restaurantContent}>
            <View style={styles.restaurantHeaderRow}>
              <Text style={styles.restaurantName} numberOfLines={1}>
                {item?.name}
              </Text>
              <Text style={styles.deliveryTime}>{deliveryTime}</Text>
            </View>

            <Text style={styles.restaurantCuisine} numberOfLines={1}>
              {item?.cuisine}
            </Text>

            <View style={styles.restaurantMetaRow}>
              <Ionicons name="location-outline" size={14} color="#777777" />
              <Text style={styles.restaurantAddress} numberOfLines={1}>
                {item?.address}
              </Text>
            </View>

            <View style={styles.restaurantFooterRow}>
              <View style={styles.deliveryFeeBadge}>
                <Ionicons name="bicycle-outline" size={14} color="#1F6F43" />
                <Text style={styles.deliveryFeeText}>{deliveryFee}</Text>
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [handleOpenRestaurant]
  );

  if (redirectPath) {
    return <Redirect href={redirectPath} />;
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <FlatList
        data={filteredRestaurants}
        keyExtractor={(item, index) =>
          item?._id?.toString() || index.toString()
        }
        renderItem={renderRestaurant}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRestaurants(true)}
            tintColor="#D4A017"
          />
        }
        ListHeaderComponent={
          <View>
            <HomeHeader
              userName={userName}
              locationText={userAddress}
              avatarUri={userAvatar}
              notificationCount={1}
            />

            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroTextWrapper}>
                  <View style={styles.heroMiniBadge}>
                    <Ionicons
                      name="sparkles-outline"
                      size={14}
                      color="#D4A017"
                    />
                    <Text style={styles.heroMiniBadgeText}>AFROEAT premium</Text>
                  </View>

                  <Text style={styles.heroTitle}>
                    Découvrez les saveurs africaines près de chez vous
                  </Text>
                  <Text style={styles.heroSubtitle}>
                    Restaurants, épiceries et boutiques africaines en quelques
                    clics.
                  </Text>

                  <Pressable
                    style={({ pressed }) => [
                      styles.heroButton,
                      pressed && styles.heroButtonPressed,
                    ]}
                    onPress={() => router.push('/(tabs)/explore')}
                  >
                    <Text style={styles.heroButtonText}>
                      Commander maintenant
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.heroLogoWrap}>
                  <Image source={LOGO_IMAGE} style={styles.heroLogo} />
                </View>
              </View>

              <Image
                source={{
                  uri: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop',
                }}
                style={styles.heroImage}
              />

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatCard}>
                  <Text style={styles.heroStatValue}>{restaurants.length}</Text>
                  <Text style={styles.heroStatLabel}>Partenaires</Text>
                </View>

                <View style={styles.heroStatCard}>
                  <Text style={styles.heroStatValue}>{featuredCount}</Text>
                  <Text style={styles.heroStatLabel}>Premium</Text>
                </View>

                <View style={styles.heroStatCard}>
                  <Text style={styles.heroStatValue}>
                    {filteredRestaurants.length}
                  </Text>
                  <Text style={styles.heroStatLabel}>Résultats</Text>
                </View>
              </View>
            </View>

            <View style={styles.searchWrapper}>
              <Ionicons
                name="search"
                size={20}
                color="#999999"
                style={styles.searchIcon}
              />
              <TextInput
                placeholder="Rechercher un plat, une boutique, une épicerie..."
                placeholderTextColor="#999999"
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {!!search && (
                <Pressable onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={20} color="#999999" />
                </Pressable>
              )}
            </View>

            <Text style={styles.sectionTitle}>Explorer AFROEAT</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesContainer}
            >
              {CATEGORIES.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.categoryCard,
                    pressed && styles.categoryCardPressed,
                  ]}
                  onPress={() => handleCategoryPress(item.route)}
                >
                  <View style={styles.categoryIconWrapper}>
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={24}
                      color="#D4A017"
                    />
                  </View>
                  <Text style={styles.categoryText}>{item.title}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Catégories populaires</Text>
              {!!search && (
                <Pressable onPress={() => setSearch('')}>
                  <Text style={styles.clearText}>Effacer</Text>
                </Pressable>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContainer}
            >
              {CUISINES.map((item, index) => {
                const isActive =
                  normalizeSearch(search) === normalizeSearch(item);

                return (
                  <Pressable
                    key={`${item}-${index}`}
                    style={({ pressed }) => [
                      styles.chip,
                      isActive && styles.chipActive,
                      pressed && styles.chipPressed,
                    ]}
                    onPress={() => handleCuisinePress(item)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isActive && styles.chipTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.offerCard}>
              <View style={styles.offerTextWrapper}>
                <Text style={styles.offerTitle}>🔥 Offres spéciales AFROEAT</Text>
                <Text style={styles.offerSubtitle}>
                  Livraison offerte sur une sélection de partenaires.
                </Text>
              </View>
              <Ionicons name="gift-outline" size={32} color="#FFFFFF" />
            </View>

            <View style={styles.listHeaderRow}>
              <Text style={styles.sectionTitle}>Restaurants populaires</Text>
              <Pressable onPress={() => router.push('/(tabs)/explore')}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </Pressable>
            </View>

            {!!errorMessage && !loading && (
              <View style={styles.errorCard}>
                <Ionicons name="warning-outline" size={18} color="#B63B3B" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loaderWrapper}>
              <ActivityIndicator size="large" color="#D4A017" />
              <Text style={styles.loaderText}>
                Chargement des restaurants...
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="restaurant-outline" size={48} color="#C4B7A6" />
              <Text style={styles.emptyTitle}>Aucun restaurant trouvé</Text>
              <Text style={styles.emptyText}>
                Essaie une autre recherche ou ajoute des partenaires à ton
                backend.
              </Text>

              <Pressable
                style={styles.retryButton}
                onPress={() => loadRestaurants()}
              >
                <Text style={styles.retryButtonText}>Réessayer</Text>
              </Pressable>
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
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
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 120,
  },

  heroCard: {
    backgroundColor: '#1F6F43',
    borderRadius: 28,
    padding: 20,
    marginBottom: 24,
    overflow: 'hidden',
    minHeight: 260,
  },

  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 2,
  },

  heroTextWrapper: {
    flex: 1,
    paddingRight: 12,
    maxWidth: '72%',
  },

  heroLogoWrap: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  heroLogo: {
    width: 42,
    height: 42,
    resizeMode: 'contain',
  },

  heroMiniBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },

  heroMiniBadgeText: {
    marginLeft: 6,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 10,
    lineHeight: 30,
  },

  heroSubtitle: {
    fontSize: 14,
    color: '#EDE7DD',
    lineHeight: 21,
    marginBottom: 18,
  },

  heroButton: {
    backgroundColor: '#D4A017',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },

  heroButtonPressed: {
    opacity: 0.85,
  },

  heroButtonText: {
    color: '#1E1E1E',
    fontWeight: '800',
    fontSize: 14,
  },

  heroImage: {
    position: 'absolute',
    right: -6,
    bottom: 0,
    width: 158,
    height: 158,
    borderTopLeftRadius: 30,
  },

  heroStatsRow: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },

  heroStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },

  heroStatValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 3,
  },

  heroStatLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6F675F',
    textTransform: 'uppercase',
  },

  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  searchIcon: {
    marginRight: 10,
  },

  searchInput: {
    flex: 1,
    height: 52,
    color: '#1E1E1E',
    fontSize: 15,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E1E1E',
    marginBottom: 14,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  clearText: {
    color: '#D4A017',
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 14,
  },

  categoriesContainer: {
    paddingBottom: 8,
    marginBottom: 18,
  },

  categoryCard: {
    width: 118,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 14,
    marginRight: 14,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  categoryCardPressed: {
    opacity: 0.8,
  },

  categoryIconWrapper: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF3D8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  categoryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E1E1E',
    textAlign: 'center',
  },

  chipsContainer: {
    paddingBottom: 8,
    marginBottom: 20,
  },

  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#F0E6D9',
  },

  chipActive: {
    backgroundColor: '#1F6F43',
    borderColor: '#1F6F43',
  },

  chipPressed: {
    opacity: 0.8,
  },

  chipText: {
    color: '#5B5248',
    fontWeight: '700',
    fontSize: 13,
  },

  chipTextActive: {
    color: '#FFFFFF',
  },

  offerCard: {
    backgroundColor: '#D96C2D',
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  offerTextWrapper: {
    flex: 1,
    paddingRight: 16,
  },

  offerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },

  offerSubtitle: {
    color: '#FFF3E8',
    fontSize: 14,
    lineHeight: 20,
  },

  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  seeAll: {
    color: '#D4A017',
    fontWeight: '800',
    fontSize: 14,
  },

  restaurantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },

  restaurantCardPressed: {
    opacity: 0.92,
  },

  restaurantImageWrapper: {
    position: 'relative',
  },

  restaurantImage: {
    width: '100%',
    height: 190,
    backgroundColor: '#F3EDE4',
  },

  badge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  badgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E1E1E',
    marginLeft: 4,
  },

  statusBadge: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusBadgeOpen: {
    backgroundColor: '#E8F5ED',
  },

  statusBadgeClosed: {
    backgroundColor: '#FDEAEA',
  },

  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },

  statusBadgeTextOpen: {
    color: '#1F6F43',
  },

  statusBadgeTextClosed: {
    color: '#B63B3B',
  },

  featuredBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4C95D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  featuredBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E1E1E',
    marginLeft: 4,
  },

  restaurantContent: {
    padding: 16,
  },

  restaurantHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  restaurantName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1E1E',
    flex: 1,
    marginRight: 10,
  },

  deliveryTime: {
    fontSize: 13,
    color: '#1F6F43',
    fontWeight: '800',
  },

  restaurantCuisine: {
    color: '#D96C2D',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 10,
  },

  restaurantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  restaurantAddress: {
    color: '#777777',
    fontSize: 13,
    marginLeft: 6,
    flex: 1,
  },

  restaurantFooterRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  deliveryFeeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5FBF7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  deliveryFeeText: {
    marginLeft: 6,
    color: '#1F6F43',
    fontWeight: '700',
    fontSize: 12,
  },

  loaderWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },

  loaderText: {
    marginTop: 12,
    color: '#777777',
    fontSize: 15,
  },

  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDEAEA',
    borderWidth: 1,
    borderColor: '#F4C7C7',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },

  errorText: {
    flex: 1,
    color: '#B63B3B',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E1E1E',
    marginTop: 14,
    marginBottom: 8,
  },

  emptyText: {
    textAlign: 'center',
    color: '#777777',
    fontSize: 15,
    lineHeight: 22,
  },

  retryButton: {
    marginTop: 18,
    backgroundColor: '#D4A017',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },

  retryButtonText: {
    color: '#1E1E1E',
    fontWeight: '800',
    fontSize: 14,
  },
});