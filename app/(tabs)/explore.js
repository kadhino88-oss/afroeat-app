import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Redirect, useLocalSearchParams } from 'expo-router';
import FadeInView from '../../components/FadeInView';
import HomeHeader from '../../components/HomeHeader';
import { getAllRestaurants, searchRestaurants } from '../../services/restaurantService';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';

/**
 * =========================================================
 * ASSETS LOCAUX
 * =========================================================
 */

const LOGO_IMAGE = require('../assets/images/icon.png');
const FALLBACK_RESTAURANT_IMAGE = require('../assets/images/react-logo.png');

/**
 * =========================================================
 * CONSTANTES
 * =========================================================
 */

const FILTERS = [
  'Tous',
  'Ivoirienne',
  'Sénégalaise',
  'Congolaise',
  'Africaine',
  'Camerounaise',
  'Marocaine',
  'Malienne',
  'Algérienne',
  'Tunisienne',
  'Nigériane',
  'Ghanéenne',
  'Éthiopienne',
  'Sud-africaine',
  'Afrique de l’Est',
  'Afrique de l’Ouest',
  'Afrique centrale',
  'Afrique du Nord',
  'Afrique australe',
  'Fast-food',
  'Pizza',
  'Burgers',
  'Tacos',
  'Grillades',
  'Cuisine internationale',
  'Épicerie',
  'Boissons',
  'Boutique',
];

// Valeurs FILTERS en francais (cles de filtre) ; slug pour affichage traduit.
const FILTER_SLUG_BY_LABEL = {
  Tous: 'all',
  Ivoirienne: 'ivoirienne',
  Sénégalaise: 'senegalaise',
  Congolaise: 'congolaise',
  Africaine: 'africaine',
  Camerounaise: 'camerounaise',
  Marocaine: 'marocaine',
  Malienne: 'malienne',
  Algérienne: 'algerienne',
  Tunisienne: 'tunisienne',
  'Nigériane': 'nigeriane',
  'Ghanéenne': 'ghaneenne',
  'Éthiopienne': 'ethiopienne',
  'Sud-africaine': 'sudafricaine',
  'Afrique de l’Est': 'estafricaine',
  'Afrique de l’Ouest': 'ouestafricaine',
  'Afrique centrale': 'afriquecentrale',
  'Afrique du Nord': 'afriquedunord',
  'Afrique australe': 'afriqueaustrale',
  'Fast-food': 'fastfood',
  'Pizza': 'pizza',
  'Burgers': 'burgers',
  'Tacos': 'tacos',
  'Grillades': 'grillades',
  'Cuisine internationale': 'internationale',
  Épicerie: 'epicerie',
  Boissons: 'boissons',
  Boutique: 'boutique',
};

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

  if (role === 'restaurant' || role === 'resto') return 'restaurant';

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
    role === 'super-admin'
  ) {
    return 'admin';
  }

  return 'client';
};

const clampRating = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const rating = normalizeNumber(value, null);
  if (rating === null || rating <= 0) return null;

  return Math.min(5, rating);
};

const normalizeDeliveryTimeValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  const text = normalizeText(value);
  if (!text) return null;

  const numeric = Number.parseInt(text, 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const formatDeliveryTime = (value) => {
  const minutes = normalizeDeliveryTimeValue(value);
  return minutes === null ? 'Délai à confirmer' : `${minutes} min`;
};

const normalizeRestaurant = (item = {}) => {
  const rawId =
    item?._id || item?.id || item?.restaurantId || item?.slug || '';

  const cuisine = normalizeText(item?.cuisine);
  const city = normalizeText(item?.city);
  const country = normalizeText(item?.country);
  const address = normalizeText(
    item?.address || item?.location || city || country,
    'Adresse non disponible'
  );

  const image = normalizeText(item?.image || item?.thumbnail || item?.photo);
  const coverImage = normalizeText(item?.coverImage || item?.banner);

  return {
    ...item,
    _id: normalizeText(rawId),
    id: normalizeText(item?.id || rawId),
    name: normalizeText(item?.name, 'Restaurant'),
    cuisine,
    address,
    image,
    coverImage,
    isFeatured: normalizeBoolean(item?.isFeatured, false),
    isOpen: normalizeBoolean(item?.isOpen, null),
    rating: clampRating(item?.ratingAverage ?? item?.rating),
    deliveryTimeMinutes: normalizeDeliveryTimeValue(
      item?.deliveryTimeMinutes ??
        item?.estimatedDeliveryTimeMinutes ??
        item?.deliveryTime
    ),
    city,
    country,
  };
};

const extractRestaurantsFromResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.restaurants)) return payload.restaurants;
  if (Array.isArray(payload?.data?.restaurants)) return payload.data.restaurants;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const getRestaurantRoute = (restaurantId) => {
  const safeId = normalizeText(restaurantId);
  return safeId ? `/restaurant/${safeId}` : null;
};

const getRestaurantImageSource = (item) => {
  const imageUri = normalizeText(item?.coverImage || item?.image);

  if (imageUri) {
    return { uri: imageUri };
  }

  return FALLBACK_RESTAURANT_IMAGE;
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function ExploreScreen() {
  const { t } = useTranslation();
  const routeParams = useLocalSearchParams();
  const auth = useAuth() || {};
  const user = auth.user ?? null;
  const token = auth.token ?? null;
  const currentRole = normalizeRole(auth.role || user?.role);
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);

  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tous');

  useEffect(() => {
    const category = String(routeParams.category ?? '').toLowerCase();
    const categoryFilter = {
      restaurants: 'Tous',
      groceries: 'Épicerie',
      drinks: 'Boissons',
      shops: 'Boutique',
    }[category];
    if (categoryFilter) setActiveFilter(categoryFilter);
  }, [routeParams.category]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  /**
   * =========================================================
   * REDIRECT LOGIC SAFE
   * =========================================================
   */

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

  /**
   * =========================================================
   * DATA LOADING
   * =========================================================
   */

  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const loadRestaurants = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage('');

      const businessTypeByFilter = {
        'Épicerie': 'grocery',
        'Boissons': 'drinks',
        'Boutique': 'shop',
      };
      const businessType = businessTypeByFilter[activeFilter];
      const data = businessType
        ? await searchRestaurants({ businessType, token: tokenRef.current })
        : await getAllRestaurants(tokenRef.current);
      const extracted = extractRestaurantsFromResponse(data);

      const safeRestaurants = extracted
        .map((item) => normalizeRestaurant(item))
        .filter((item) => item?._id);

      setRestaurants(safeRestaurants);
    } catch (error) {
      console.log('Erreur explore restaurants :', error);
      setRestaurants([]);
      setErrorMessage(
        normalizeText(
          error?.message,
          'Impossible de charger les restaurants.'
        )
      );
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [activeFilter]);

  useEffect(() => {
    if (!redirectPath) {
      loadRestaurants(false);
    }
  }, [loadRestaurants, redirectPath]);

  /**
   * =========================================================
   * DERIVED STATE
   * =========================================================
   */

  const filteredRestaurants = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const normalizedFilter = normalizeSearch(activeFilter);

    return restaurants
      .filter((item) => {
        const name = normalizeSearch(item?.name);
        const cuisine = normalizeSearch(item?.cuisine);
        const address = normalizeSearch(item?.address);
        const city = normalizeSearch(item?.city);
        const country = normalizeSearch(item?.country);

        const matchesQuery =
          !normalizedQuery ||
          name.includes(normalizedQuery) ||
          cuisine.includes(normalizedQuery) ||
          address.includes(normalizedQuery) ||
          city.includes(normalizedQuery) ||
          country.includes(normalizedQuery);

        const fastFoodTerms = [
          'fast food', 'fast-food', 'burger', 'hamburger', 'pizza', 'tacos',
          'fried chicken', 'poulet frit', 'sandwich', 'kebab', 'shawarma',
          'snack', 'hot dog', 'wrap',
        ];
        // Match region filters against restaurant cuisine, categories, name and description.
        // Include common country adjectives and English/French spellings so the full
        // continent remains discoverable even when partner data is not normalized yet.
        const africanRegionTerms = {
          'afrique de l est': [
            'est-afric', 'east african', 'ethiop', 'kenyan', 'kenya', 'tanzan', 'tanzania',
            'somali', 'somalia', 'ougand', 'uganda', 'rwand', 'burund', 'eritrea',
            'djibouti', 'sudan', 'sudanais', 'south sudan', 'malgache', 'madagascar',
            'seychell', 'comor', 'maurice', 'mauritian',
          ],
          'afrique de l ouest': [
            'ouest-afric', 'west african', 'nigerian', 'nigeria', 'ghan', 'senegal',
            'ivoir', 'cote d ivoire', 'mali', 'malien', 'benin', 'beninois', 'togo',
            'togolais', 'burkina', 'burkinabe', 'guine', 'guinea', 'sierra leone',
            'liberia', 'liberien', 'gambia', 'gambian', 'mauritania', 'mauritanien',
            'nigerien', 'cape verde', 'cap verdien',
          ],
          'afrique du nord': [
            'north african', 'north africa', 'maghrebi', 'maghreb', 'maroc', 'moroccan', 'marocaine',
            'alger', 'algerian', 'algerienne', 'tunisi', 'tunisian', 'egypt', 'egyptian', 'egyptien',
            'libya', 'libyan', 'libyen', 'western sahara', 'sahara occidental',
          ],
          'afrique australe': [
            'southern african', 'southern africa', 'south african', 'south africa', 'sud-afric', 'sud afric',
            'namib', 'botswana', 'zimbabwe', 'zambia', 'zambian', 'mozambique', 'mozambicain',
            'malawi', 'lesotho', 'eswatini', 'swazi', 'madagascar', 'malgache', 'maurice', 'mauritian',
          ],
          'afrique centrale': [
            'central african', 'cameroun', 'cameroon', 'congo', 'congolais', 'gabon',
            'gabonaise', 'tchad', 'chad', 'centrafric', 'central african republic',
            'guinee equatoriale', 'equatorial guinea', 'sao tome', 'angola', 'angolais',
            'rdc', 'republique democratique du congo',
          ],
        };
        const cuisineText = normalizeSearch([
          item?.cuisine,
          ...(Array.isArray(item?.categories) ? item.categories : []),
          item?.category,
          item?.type,
          item?.businessType,
          item?.storeType,
          item?.name,
          item?.description,
        ].filter(Boolean).join(' '));
        const matchesFastFood =
          normalizedFilter === 'fast-food' &&
          fastFoodTerms.some((term) => cuisineText.includes(normalizeSearch(term)));
        const beverageTerms = [
          'boisson', 'beverage', 'drink', 'juice', 'jus', 'smoothie', 'cocktail',
          'coffee', 'cafe', 'tea', 'the', 'soda', 'water', 'eau', 'milkshake',
        ];
        const matchesBeverages =
          normalizedFilter === 'boissons' &&
          beverageTerms.some((term) => cuisineText.includes(normalizeSearch(term)));
        const matchesGroceries =
          normalizedFilter === 'epicerie' &&
          ['grocery', 'groceries', 'epicerie', 'épicerie', 'market', 'supermarket', 'alimentaire']
            .some((term) => cuisineText.includes(normalizeSearch(term)));
        const matchesShops =
          normalizedFilter === 'boutique' &&
          ['shop', 'store', 'boutique', 'marketplace'].some((term) => cuisineText.includes(normalizeSearch(term)));
        const regionKey = normalizedFilter.replace(/[’']/g, '').replace(/\s+/g, ' ');
        const matchesAfricanRegion = (africanRegionTerms[regionKey] || []).some((term) =>
          cuisineText.includes(normalizeSearch(term))
        );
        const countryCuisineTerms = {
          malienne: ['malian', 'mali', 'malienne', 'malien'],
          algerienne: ['algerian', 'algeria', 'algerienne', 'algerien', 'algérienne'],
          tunisienne: ['tunisian', 'tunisia', 'tunisienne', 'tunisien'],
        };
        const matchesCountryCuisine = (countryCuisineTerms[normalizedFilter] || []).some((term) =>
          cuisineText.includes(normalizeSearch(term))
        );
        const matchesFilter =
          normalizedFilter === 'tous' ||
          cuisine.includes(normalizedFilter) ||
          cuisineText.includes(normalizedFilter) ||
          (normalizedFilter === 'africaine' && cuisineText.includes('afric')) ||
          matchesFastFood ||
          matchesBeverages ||
          matchesGroceries ||
          matchesShops ||
          matchesAfricanRegion ||
          matchesCountryCuisine;

        return matchesQuery && matchesFilter;
      })
      .sort((a, b) => {
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

        const ratingA = clampRating(a?.rating) ?? -1;
        const ratingB = clampRating(b?.rating) ?? -1;
        return ratingB - ratingA;
      });
  }, [restaurants, query, activeFilter]);

  const featuredRestaurants = useMemo(() => {
    return filteredRestaurants.filter((item) => item?.isFeatured).length;
  }, [filteredRestaurants]);

  const resultCount = filteredRestaurants.length;

  const displayName = useMemo(() => {
    return normalizeText(
      user?.name ||
        user?.fullName ||
        `${normalizeText(user?.firstName)} ${normalizeText(user?.lastName)}`.trim(),
      t('home.greetingFallback')
    );
  }, [user, t]);

  const displayAddress = useMemo(() => {
    return normalizeText(
      user?.address ||
        user?.adresse ||
        user?.deliveryAddress ||
        user?.profile?.address,
      t('home.deliveryAddressFallback')
    );
  }, [user, t]);

  const displayAvatar = useMemo(() => {
    return normalizeText(
      user?.avatar || user?.photo || user?.profileImage || user?.image
    );
  }, [user]);

  const showEmptySearchState =
    !loading &&
    filteredRestaurants.length === 0 &&
    (normalizeSearch(query).length > 0 ||
      normalizeSearch(activeFilter) !== 'tous');

  /**
   * =========================================================
   * HANDLERS
   * =========================================================
   */

  const handleOpenRestaurant = useCallback((restaurantId) => {
    const route = getRestaurantRoute(restaurantId);
    if (!route) return;
    router.push(route);
  }, []);

  const handleResetFilters = useCallback(() => {
    setQuery('');
    setActiveFilter('Tous');
  }, []);

  const handleRetry = useCallback(() => {
    loadRestaurants(false);
  }, [loadRestaurants]);

  /**
   * =========================================================
   * RENDER HEADER
   * =========================================================
   */

  const renderHeader = useCallback(() => {
    return (
      <View>
        <HomeHeader
          userName={displayName}
          locationText={displayAddress}
          avatarUri={displayAvatar}
        />

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroTextBlock}>
              <View style={styles.heroBadge}>
                <Ionicons name="sparkles-outline" size={14} color="#D4A017" />
                <Text style={styles.heroBadgeText}>{t('explore.premiumDiscovery')}</Text>
              </View>

              <Text style={styles.title}>{t('explore.title')}</Text>
              <Text style={styles.subtitle}>
                {t('explore.subtitle')}
              </Text>
            </View>

            <View style={styles.heroLogoWrap}>
              <Image source={LOGO_IMAGE} style={styles.heroLogo} />
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{restaurants.length}</Text>
              <Text style={styles.heroStatLabel}>{t('explore.restaurants')}</Text>
            </View>

            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{featuredRestaurants}</Text>
              <Text style={styles.heroStatLabel}>{t('explore.premium')}</Text>
            </View>

            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{resultCount}</Text>
              <Text style={styles.heroStatLabel}>{t('explore.results')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.searchCard}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={22} color="#A0A0A0" />

            <TextInput
              style={styles.searchInput}
              placeholder={t('explore.searchPlaceholder')}
              placeholderTextColor="#A0A0A0"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="never"
            />

            {!!query && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('explore.clearSearch')}
                onPress={() => setQuery('')}
              >
                <Ionicons name="close-circle" size={20} color="#A0A0A0" />
              </Pressable>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('explore.quickFilters')}</Text>

        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filtersRow}
          renderItem={({ item }) => {
            const isActive = item === activeFilter;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('explore.filterBy', { item: t(`cuisines.${FILTER_SLUG_BY_LABEL[item] || ''}`, item) })}
                style={({ pressed }) => [
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                  pressed && styles.filterChipPressed,
                ]}
                onPress={() => setActiveFilter(item)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {t(`cuisines.${FILTER_SLUG_BY_LABEL[item] || ''}`, item)}
                </Text>
              </Pressable>
            );
          }}
        />

        <View style={styles.resultsHeader}>
          <View>
            <Text style={styles.resultsTitle}>{t('explore.results')}</Text>
            <Text style={styles.resultsSubtitle}>
              {t('explore.resultsSubtitle', { count: restaurants.length })}
            </Text>
          </View>

          <Text style={styles.resultsCount}>
            {t('explore.resultsCount', { count: resultCount })}
          </Text>
        </View>

        {!!errorMessage && !loading && (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={18} color="#B63B3B" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
      </View>
    );
  }, [
    activeFilter,
    displayAddress,
    displayAvatar,
    displayName,
    errorMessage,
    featuredRestaurants,
    loading,
    query,
    restaurants.length,
    resultCount,
  ]);

  /**
   * =========================================================
   * RENDER RESTAURANT
   * =========================================================
   */

  const renderRestaurant = useCallback(
    ({ item }) => {
      const isOpen = item?.isOpen === true;
      const hasOpenStatus = typeof item?.isOpen === 'boolean';
      const rating = clampRating(item?.rating);
      const deliveryTime = formatDeliveryTime(item?.deliveryTimeMinutes);
      const imageSource = getRestaurantImageSource(item);

      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('explore.openRestaurant', { name: item?.name })}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => handleOpenRestaurant(item?._id)}
        >
          <View style={styles.cardImageWrap}>
            <Image source={imageSource} style={styles.cardImage} />

            {!!item?.isFeatured && (
              <View style={styles.featuredBadge}>
                <Ionicons name="flash-outline" size={12} color="#1E1E1E" />
                <Text style={styles.featuredBadgeText}>{t('home.featured')}</Text>
              </View>
            )}
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item?.name}
              </Text>

              {rating !== null && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color="#D4A017" />
                  <Text style={styles.cardRating}>{rating.toFixed(1)}</Text>
                </View>
              )}
            </View>

            <Text style={styles.cardCuisine} numberOfLines={1}>
              {item?.cuisine}
            </Text>

            <View style={styles.cardMetaRow}>
              <Ionicons name="location-outline" size={14} color="#777777" />
              <Text style={styles.cardAddress} numberOfLines={1}>
                {item?.address}
              </Text>
            </View>

            <View style={styles.cardFooter}>
              <View
                style={[
                  styles.statusPill,
                  isOpen ? styles.statusOpen : styles.statusClosed,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    isOpen ? styles.statusTextOpen : styles.statusTextClosed,
                  ]}
                >
                  {isOpen
                    ? t('home.open')
                    : hasOpenStatus
                    ? t('home.closed')
                    : 'Horaires à confirmer'}
                </Text>
              </View>

              <Text style={styles.deliveryTime}>{deliveryTime}</Text>
            </View>
          </View>
        </Pressable>
      );
    },
    [handleOpenRestaurant]
  );

  /**
   * =========================================================
   * SAFE REDIRECT AFTER ALL HOOKS
   * =========================================================
   */

  if (redirectPath) {
    return <Redirect href={redirectPath} />;
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <FlatList
        data={filteredRestaurants}
        keyExtractor={(item, index) =>
          `${item?._id || item?.id || 'restaurant'}-${index}`
        }
        renderItem={renderRestaurant}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRestaurants(true)}
            tintColor="#D4A017"
          />
        }
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={10}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color="#D4A017" />
              <Text style={styles.loaderText}>{t('explore.loadingResults')}</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name={
                  showEmptySearchState
                    ? 'search-outline'
                    : 'restaurant-outline'
                }
                size={72}
                color="#C9B8A3"
              />
              <Text style={styles.emptyTitle}>
                {showEmptySearchState
                  ? t('explore.noResultsTitle')
                  : t('explore.noRestaurantsTitle')}
              </Text>
              <Text style={styles.emptyText}>
                {showEmptySearchState
                  ? t('explore.noResultsText')
                  : t('explore.noRestaurantsText')}
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.resetButton,
                  pressed && styles.filterChipPressed,
                ]}
                onPress={showEmptySearchState ? handleResetFilters : handleRetry}
              >
                <Text style={styles.resetButtonText}>
                  {showEmptySearchState ? t('explore.reset') : t('explore.retry')}
                </Text>
              </Pressable>
            </View>
          )
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
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 120,
    flexGrow: 1,
  },

  heroCard: {
    backgroundColor: '#FFF9F2',
    borderRadius: 26,
    padding: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#F0E2CC',
  },

  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  heroTextBlock: {
    flex: 1,
    paddingRight: 12,
  },

  heroLogoWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1E1B4',
    overflow: 'hidden',
  },

  heroLogo: {
    width: 54,
    height: 54,
    resizeMode: 'contain',
  },

  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4DA',
    borderWidth: 1,
    borderColor: '#F1E1B4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 14,
    alignSelf: 'flex-start',
  },

  heroBadgeText: {
    marginLeft: 6,
    color: '#8C6711',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  heroStatsRow: {
    flexDirection: 'row',
    marginTop: 18,
    justifyContent: 'space-between',
  },

  heroStatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#F3E7D5',
  },

  heroStatValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 4,
  },

  heroStatLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#777777',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },

  searchCard: {
    marginBottom: 8,
  },

  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 8,
  },

  subtitle: {
    textAlign: 'left',
    color: '#777777',
    fontSize: 14,
    lineHeight: 22,
  },

  searchBox: {
    minHeight: 64,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ECE1D4',
  },

  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#111111',
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 16,
  },

  filtersRow: {
    paddingBottom: 8,
    marginBottom: 20,
  },

  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E7D8C5',
    backgroundColor: '#F8F8F8',
    marginRight: 12,
  },

  filterChipActive: {
    backgroundColor: '#D4A017',
    borderColor: '#D4A017',
  },

  filterChipPressed: {
    opacity: 0.82,
  },

  filterChipText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6B5D4D',
  },

  filterChipTextActive: {
    color: '#111111',
  },

  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 18,
  },

  resultsTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111111',
  },

  resultsSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#777777',
    fontWeight: '600',
  },

  resultsCount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#E17A2D',
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

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  cardPressed: {
    opacity: 0.92,
  },

  cardImageWrap: {
    position: 'relative',
  },

  cardImage: {
    width: '100%',
    height: 170,
    backgroundColor: '#EEEEEE',
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
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '800',
    color: '#1E1E1E',
  },

  cardBody: {
    padding: 16,
  },

  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
    marginRight: 10,
  },

  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8EA',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  cardRating: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111111',
    marginLeft: 4,
  },

  cardCuisine: {
    marginTop: 8,
    color: '#D96C2D',
    fontSize: 14,
    fontWeight: '700',
  },

  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },

  cardAddress: {
    marginLeft: 6,
    color: '#777777',
    fontSize: 13,
    flex: 1,
  },

  cardFooter: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusOpen: {
    backgroundColor: '#E8F5ED',
  },

  statusClosed: {
    backgroundColor: '#FDEAEA',
  },

  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },

  statusTextOpen: {
    color: '#1F6F43',
  },

  statusTextClosed: {
    color: '#B63B3B',
  },

  deliveryTime: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F6F43',
  },

  loaderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
  },

  loaderText: {
    marginTop: 12,
    color: '#777777',
    fontSize: 15,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
    paddingHorizontal: 20,
  },

  emptyTitle: {
    marginTop: 24,
    fontSize: 22,
    fontWeight: '900',
    color: '#111111',
    textAlign: 'center',
  },

  emptyText: {
    marginTop: 14,
    fontSize: 15,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },

  resetButton: {
    backgroundColor: '#D4A017',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
  },

  resetButtonText: {
    color: '#111111',
    fontWeight: '900',
    fontSize: 14,
  },
});