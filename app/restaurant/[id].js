import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiGet } from '../../services/apiClient';
import { API_ENDPOINTS } from '../../constants/api';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  addFavoriteRestaurant,
  getFavoriteRestaurants,
  removeFavoriteRestaurant,
} from '../../services/favoriteService';
import i18n from '../../i18n';

/**
 * =========================================================
 * ASSETS LOCAUX
 * =========================================================
 */

const LOGO_IMAGE = require('../../assets/images/icon.png');
const FALLBACK_RESTAURANT_IMAGE = require('../../assets/images/icon.png');

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeSearchText = (value, locale = 'fr') =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase(locale);

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
};

const extractRestaurantPayload = (response) => {
  if (!response || typeof response !== 'object') {
    return null;
  }

  return (
    response?.restaurant ||
    response?.data?.restaurant ||
    response?.data?.item ||
    response?.item ||
    response?.data ||
    response
  );
};

const extractMenuArray = (response) => {
  if (!response) return [];

  const directCandidates = [
    response?.menuItems,
    response?.items,
    response?.products,
    response?.dishes,
    response?.meals,
    response?.foods,
    response?.menu,
    response?.data?.menuItems,
    response?.data?.items,
    response?.data?.products,
    response?.data?.dishes,
    response?.data?.meals,
    response?.data?.foods,
    response?.data?.menu,
    response?.data,
    response,
  ];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  const groupedCandidates = [
    response?.menus,
    response?.categories,
    response?.sections,
    response?.data?.menus,
    response?.data?.categories,
    response?.data?.sections,
    response?.menu?.categories,
    response?.menu?.sections,
    response?.data?.menu?.categories,
    response?.data?.menu?.sections,
  ];

  for (const groups of groupedCandidates) {
    if (Array.isArray(groups)) {
      const flattened = groups.flatMap((group) => {
        if (!group || typeof group !== 'object') return [];

        return (
          group?.items ||
          group?.menuItems ||
          group?.products ||
          group?.dishes ||
          group?.foods ||
          group?.meals ||
          []
        );
      });

      if (flattened.length) {
        return flattened;
      }
    }
  }

  return [];
};

const extractEmbeddedRestaurantMenu = (restaurantPayload) => {
  if (!restaurantPayload || typeof restaurantPayload !== 'object') return [];

  const candidates = [
    restaurantPayload?.menu,
    restaurantPayload?.menus,
    restaurantPayload?.data?.menu,
    restaurantPayload?.data?.menus,
    restaurantPayload?.restaurant?.menu,
    restaurantPayload?.restaurant?.menus,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate;
    }
  }

  return [];
};

const normalizeRestaurant = (data) => {
  if (!data || typeof data !== 'object') return null;

  return {
    ...data,
    _id: data?._id || data?.id || data?.restaurantId || null,
    id: data?.id || data?._id || data?.restaurantId || null,
    name: normalizeText(data?.name || data?.title, i18n.t('restaurant.menuScreen.restaurantNameFallback')),
    coverImage: normalizeText(
      data?.coverImage ||
        data?.cover ||
        data?.banner ||
        data?.heroImage ||
        data?.image
    ),
    image: normalizeText(
      data?.image ||
        data?.logo ||
        data?.coverImage ||
        data?.cover ||
        data?.banner
    ),
    rating: normalizeNumber(data?.ratingAverage ?? data?.rating, 0),
    ratingCount: normalizeNumber(data?.ratingCount, 0),
    preparationTime: normalizeNumber(
      data?.averagePreparationTimeMinutes ?? data?.preparationTime,
      0
    ),
    cuisine: normalizeText(
      data?.cuisine || data?.cuisineType || data?.category,
      i18n.t('cuisines.africaine', 'Africaine')
    ),
    address: normalizeText(
      data?.address || data?.location?.address || data?.fullAddress
    ),
    isOpen: normalizeBoolean(data?.isOpen, false),
    city: normalizeText(data?.city || data?.location?.city),
    country: normalizeText(data?.country || data?.location?.country),
    deliveryFee: normalizeNumber(
      data?.deliveryFee ?? data?.fees?.delivery ?? data?.shippingFee,
      0
    ),
    currency: normalizeText(data?.currency, 'EUR'),
    description: normalizeText(data?.description),
  };
};

const normalizeMenuItem = (item, restaurant, index = 0) => {
  if (!item || typeof item !== 'object') return null;

  const restaurantId =
    item?.restaurantId ||
    item?.restaurant?._id ||
    item?.restaurant?.id ||
    item?.restaurant ||
    restaurant?._id ||
    restaurant?.id ||
    null;

  const id =
    item?._id ||
    item?.id ||
    item?.menuItemId ||
    item?.productId ||
    item?.dishId ||
    `generated-${index}`;

  const price = normalizeNumber(
    item?.price ??
      item?.basePrice ??
      item?.salePrice ??
      item?.amount ??
      item?.unitPrice,
    0
  );

  return {
    ...item,
    _id: id,
    id,
    name: normalizeText(item?.name || item?.title || item?.label, i18n.t('restaurant.menuScreen.dishFallback')),
    description: normalizeText(
      item?.description || item?.details || item?.summary,
      i18n.t('restaurant.descriptionUnavailable')
    ),
    story: normalizeText(item?.story, ''),
    category: normalizeText(
      item?.category ||
        item?.section ||
        item?.group ||
        item?.menuCategory ||
        item?.type,
      i18n.t('restaurant.addMenuItem.categories.other', 'Autres')
    ),
    price,
    image: normalizeText(
      item?.image || item?.imageUrl || item?.photo || item?.thumbnail
    ),
    restaurantId,
    restaurant: restaurantId,
    restaurantName: normalizeText(restaurant?.name, i18n.t('restaurant.menuScreen.restaurantNameFallback')),
    quantity: 1,
    available: normalizeBoolean(item?.available, item?.isAvailable !== false),
    isPopular: Boolean(item?.isPopular || item?.popular || item?.featured),
    isRecommended: Boolean(item?.isRecommended || item?.recommended),
  };
};

const dedupeMenuItems = (items) => {
  const map = new Map();

  items.forEach((item, index) => {
    if (!item?._id) return;
    const key = String(item._id || `item-${index}`);
    if (!map.has(key)) {
      map.set(key, item);
    }
  });

  return Array.from(map.values());
};

const formatPreparationTime = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return i18n.t('restaurant.preparationTimeUnavailable');
  }
  return i18n.t('restaurant.preparationTimeMinutes', { count: parsed });
};

const formatRating = (value) => {
  const parsed = normalizeNumber(value, 0);
  return parsed.toFixed(1);
};

const DATE_LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-ES', it: 'it-IT', zh: 'zh-CN' };

const CATEGORY_SLUG_BY_LABEL = {
  'Entrées': 'starters',
  'Plats principaux': 'mainCourses',
  'Desserts': 'desserts',
  'Boissons': 'drinks',
  'Snacks': 'snacks',
  'Autres': 'other',
};

const getMenuCategoryLabel = (category, translate) => {
  const categorySlug = CATEGORY_SLUG_BY_LABEL[category];
  return categorySlug
    ? translate(`restaurant.addMenuItem.categories.${categorySlug}`, category)
    : category;
};

const formatPrice = (value, currency = 'EUR') => {
  const amount = normalizeNumber(value, 0);
  const safeCurrency = normalizeText(currency, 'EUR').toUpperCase();

  try {
    return new Intl.NumberFormat(DATE_LOCALE_MAP[i18n.language] || 'en-US', {
      style: 'currency',
      currency: safeCurrency,
      minimumFractionDigits:
        safeCurrency === 'XOF' || safeCurrency === 'XAF' ? 0 : 2,
      maximumFractionDigits:
        safeCurrency === 'XOF' || safeCurrency === 'XAF' ? 0 : 2,
    }).format(amount);
  } catch {
    if (safeCurrency === 'USD') return `$${amount.toFixed(2)}`;
    if (safeCurrency === 'GBP') return `£${amount.toFixed(2)}`;
  if (safeCurrency === 'CHF') return `CHF ${amount.toFixed(2)}`;
    if (safeCurrency === 'XOF' || safeCurrency === 'XAF') {
      return `${amount.toFixed(0)} ${safeCurrency}`;
    }
    if (safeCurrency === 'CAD') return `${amount.toFixed(2)} $CA`;
    return `${amount.toFixed(2)} €`;
  }
};

const getItemKey = (item, index) => {
  return String(item?.id || item?._id || `row-${index}`);
};

const getRestaurantImageSource = (restaurant) => {
  const imageUri = normalizeText(restaurant?.coverImage || restaurant?.image);

  if (imageUri) {
    return { uri: imageUri };
  }

  return FALLBACK_RESTAURANT_IMAGE;
};

const getMenuItemImageSource = (item, restaurant) => {
  const imageUri = normalizeText(item?.image);

  if (imageUri) {
    return { uri: imageUri };
  }

  const restaurantUri = normalizeText(
    restaurant?.coverImage || restaurant?.image
  );

  if (restaurantUri) {
    return { uri: restaurantUri };
  }

  return FALLBACK_RESTAURANT_IMAGE;
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function RestaurantScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const id = normalizeText(rawId);

  const auth = useAuth() || {};
  const token = auth.token ?? null;
  const favoriteRole = String(auth.role || auth.user?.role || 'client').toLowerCase();
  const canUseFavorites = !token || favoriteRole === 'client';

  const cart = useCart() || {};
  const addToCart = cart.addToCart;
  const getTotalItems = cart.getTotalItems;

  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [addingId, setAddingId] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const cartCount = useMemo(() => {
    return typeof getTotalItems === 'function'
      ? normalizeNumber(getTotalItems(), 0)
      : 0;
  }, [getTotalItems]);

  /**
   * =========================================================
   * FETCH
   * =========================================================
   */

  const fetchData = useCallback(
    async (isManualRefresh = false) => {
      const requestId = ++requestIdRef.current;
      const showRefreshIndicator = isManualRefresh || hasLoadedOnceRef.current;

      try {
        if (!id) {
          if (requestId === requestIdRef.current) {
            setErrorMessage('Restaurant introuvable.');
            setRestaurant(null);
            setMenu([]);
            setLoading(false);
            setRefreshing(false);
          }
          return;
        }

        if (showRefreshIndicator) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage('');

        const [restoResponse, menuResponse] = await Promise.allSettled([
          apiGet(API_ENDPOINTS.restaurants.byId(id), token),
          apiGet(API_ENDPOINTS.menu.byRestaurant(id), token),
        ]);

        const safeRestaurantResponse =
          restoResponse.status === 'fulfilled' ? restoResponse.value : null;

        const safeMenuResponse =
          menuResponse.status === 'fulfilled' ? menuResponse.value : null;


        const rawRestaurantPayload = extractRestaurantPayload(safeRestaurantResponse);
        const normalizedRestaurant = normalizeRestaurant(rawRestaurantPayload);

        if (!normalizedRestaurant?._id) {
          throw new Error('Restaurant introuvable.');
        }

        const menuFromEndpoint = extractMenuArray(safeMenuResponse);
        const menuFromRestaurant = extractEmbeddedRestaurantMenu(rawRestaurantPayload);

        let primaryMenuSource = [];

        if (menuFromEndpoint.length > 0) {
          primaryMenuSource = menuFromEndpoint;
        } else if (menuFromRestaurant.length > 0) {
          primaryMenuSource = menuFromRestaurant;
        }

        const normalizedMenu = dedupeMenuItems(
          primaryMenuSource
            .map((item, index) => normalizeMenuItem(item, normalizedRestaurant, index))
            .filter(Boolean)
            .filter((item) => item?._id)
        );

        if (requestId === requestIdRef.current) {
          setRestaurant(normalizedRestaurant);
          setMenu(normalizedMenu);
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          if (!hasLoadedOnceRef.current) {
            setRestaurant(null);
            setMenu([]);
          }
          setErrorMessage(
            error?.message || 'Impossible de charger ce restaurant.'
          );
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
          hasLoadedOnceRef.current = true;
        }
      }
    },
    [id, token]
  );

  useFocusEffect(
    useCallback(() => {
      fetchData(false);
    }, [fetchData])
  );

  useFocusEffect(
    useCallback(() => {
      if (!token || !id || favoriteRole !== 'client') {
        setIsFavorite(false);
        return undefined;
      }

      let isCurrent = true;
      getFavoriteRestaurants(token)
        .then((restaurants) => {
          if (!isCurrent) return;
          setIsFavorite(restaurants.some(
            (item) => String(item?._id || item?.id) === String(id)
          ));
        })
        .catch(() => {
          if (isCurrent) setIsFavorite(false);
        });

      return () => {
        isCurrent = false;
      };
    }, [favoriteRole, id, token])
  );

  /**
   * =========================================================
   * ACTIONS
   * =========================================================
   */

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/explore');
  }, []);

  const handleOpenCart = useCallback(() => {
    router.push('/cart');
  }, []);

  const handleToggleFavorite = useCallback(async () => {
    if (!token) {
      router.push('/auth/role');
      return;
    }
    if (!restaurant?._id || favoriteBusy) return;

    setFavoriteBusy(true);
    try {
      if (isFavorite) {
        await removeFavoriteRestaurant(restaurant._id, token);
        setIsFavorite(false);
      } else {
        await addFavoriteRestaurant(restaurant._id, token);
        setIsFavorite(true);
      }
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error?.message || t('restaurant.favoriteError')
      );
    } finally {
      setFavoriteBusy(false);
    }
  }, [token, restaurant, favoriteBusy, isFavorite, t]);

  const handleAddToCart = useCallback(
    async (item) => {
      if (
        !item?._id ||
        !restaurant?._id ||
        typeof addToCart !== 'function' ||
        addingId === item._id
      ) {
        return;
      }

      const price = normalizeNumber(item?.price, 0);

      if (price <= 0) {
        Alert.alert(t('restaurant.error'), t('restaurant.invalidPrice'));
        return;
      }

      if (item?.available === false) {
        Alert.alert(
          t('restaurant.unavailable'),
          t('restaurant.itemUnavailable')
        );
        return;
      }

      if (!restaurant?.isOpen) {
        Alert.alert(
          t('restaurant.closedTitle'),
          t('restaurant.closedBody')
        );
        return;
      }

      try {
        setAddingId(item._id);

        const cartItem = {
          ...item,
          menuItem: item._id,
          menuItemId: item._id,
          productId: item._id,
          restaurant: restaurant._id,
          restaurantId: restaurant._id,
          restaurantName: restaurant.name,
          restaurantImage:
            restaurant.coverImage ||
            restaurant.image ||
            normalizeText(restaurant?.image),
          image:
            item.image ||
            restaurant.coverImage ||
            restaurant.image ||
            normalizeText(restaurant?.image),
          price,
          quantity: 1,
          currency: restaurant.currency || 'EUR',
          deliveryFee: restaurant.deliveryFee,
        };

        await Promise.resolve(addToCart(cartItem));
        Alert.alert(t('restaurant.addedToCart'), item.name);
      } catch (error) {
        Alert.alert(
          t('restaurant.error'),
          error?.message || t('restaurant.addToCartError')
        );
      } finally {
        setAddingId(null);
      }
    },
    [addToCart, restaurant, addingId, t]
  );

  /**
   * =========================================================
   * DERIVED
   * =========================================================
   */

  const menuCategories = useMemo(() => {
    return Array.from(
      new Set(menu.map((item) => normalizeText(item?.category, 'Autres')))
    );
  }, [menu]);

  const filteredMenu = useMemo(() => {
    const locale = i18n.language || 'fr';
    const query = normalizeSearchText(menuSearch.trim(), locale);

    return menu.filter((item) => {
      if (
        categoryFilter !== 'all' &&
        normalizeText(item?.category, 'Autres') !== categoryFilter
      ) {
        return false;
      }

      if (!query) return true;

      return [item?.name, item?.description, item?.category, item?.story]
        .filter(Boolean)
        .some((value) => normalizeSearchText(value, locale).includes(query));
    });
  }, [categoryFilter, i18n.language, menu, menuSearch]);

  const menuByCategory = useMemo(() => {
    return filteredMenu.reduce((acc, item) => {
      const category = normalizeText(item?.category, 'Autres');

      if (!acc[category]) {
        acc[category] = [];
      }

      acc[category].push(item);
      return acc;
    }, {});
  }, [filteredMenu]);

  const flatMenu = useMemo(() => {
    const categories = Object.keys(menuByCategory);

    if (!categories.length) {
      return [];
    }

    return categories.flatMap((category) => [
      { _type: 'category', id: `cat-${category}`, title: category },
      ...menuByCategory[category].map((item) => ({
        ...item,
        _type: 'item',
      })),
    ]);
  }, [menuByCategory]);

  const heroImageSource = useMemo(() => {
    return getRestaurantImageSource(restaurant);
  }, [restaurant]);

  const availableItemsCount = useMemo(() => {
    return menu.filter((item) => item?.available !== false).length;
  }, [menu]);

  const featuredItemsCount = useMemo(() => {
    return menu.filter((item) => item?.isPopular || item?.isRecommended).length;
  }, [menu]);

  /**
   * =========================================================
   * RENDER ITEM
   * =========================================================
   */

  const renderItem = useCallback(
    ({ item }) => {
      if (item?._type === 'category') {
        const categoryLabel = getMenuCategoryLabel(item.title, t);
        return <Text style={styles.categoryTitle}>{categoryLabel}</Text>;
      }

      const isAdding = addingId === item._id;
      const itemImageSource = getMenuItemImageSource(item, restaurant);

      return (
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Image
              source={itemImageSource}
              style={styles.itemImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={160}
            />

            <View style={styles.textContent}>
              <Text style={styles.itemName}>{item.name}</Text>

              <Text style={styles.desc} numberOfLines={2}>
                {item.description}
              </Text>

              {!!item.story && (
                <Text style={styles.storyText} numberOfLines={3}>
                  📖 {item.story}
                </Text>
              )}

              <View style={styles.tagsRow}>
                <Text style={styles.price}>
                  {formatPrice(item.price, restaurant?.currency)}
                </Text>

                {item?.isPopular ? (
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagBadgeText}>{t('restaurant.popular')}</Text>
                  </View>
                ) : null}

                {item?.isRecommended ? (
                  <View style={styles.tagBadgeSecondary}>
                    <Text style={styles.tagBadgeSecondaryText}>
                      {t('restaurant.recommended')}
                    </Text>
                  </View>
                ) : null}

                {item?.available === false ? (
                  <View style={styles.unavailableBadge}>
                    <Text style={styles.unavailableBadgeText}>
                      {t('restaurant.unavailable')}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.addBtn,
                (pressed || isAdding || item?.available === false) &&
                  styles.buttonPressed,
                item?.available === false && styles.addBtnDisabled,
              ]}
              onPress={() => handleAddToCart(item)}
              disabled={isAdding || item?.available === false}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Ionicons name="add" size={20} color="#000000" />
              )}
            </Pressable>
          </View>
        </View>
      );
    },
    [restaurant, addingId, handleAddToCart, t]
  );

  /**
   * =========================================================
   * STATES
   * =========================================================
   */

  if (loading || (!restaurant && refreshing)) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#D4A017" />
        <Text style={styles.loaderText}>{t('restaurant.loading')}</Text>
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View style={styles.loader}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />
        <Text style={styles.errorText}>
          {errorMessage || t('restaurant.loadError')}
        </Text>

        <Pressable style={styles.retryBtn} onPress={() => fetchData(false)}>
          <Text style={styles.retryText}>{t('restaurant.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  /**
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.heroWrapper}>
        <Image
          source={heroImageSource}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={180}
        />

        <View style={styles.overlay} />
        <View style={styles.overlaySoft} />

        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleGoBack}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>

          <View style={styles.topBarRight}>
            <View style={styles.logoBubble}>
              <Image
                source={LOGO_IMAGE}
                style={styles.logoImage}
                contentFit="contain"
              />
            </View>

            {canUseFavorites ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(isFavorite ? 'restaurant.removeFavorite' : 'restaurant.addFavorite')}
                disabled={favoriteBusy}
                style={({ pressed }) => [
                  styles.iconBtn,
                  styles.favoriteIconBtn,
                  pressed && styles.buttonPressed,
                  favoriteBusy && styles.buttonPressed,
                ]}
                onPress={handleToggleFavorite}
              >
                {favoriteBusy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name={isFavorite ? 'heart' : 'heart-outline'}
                    size={19}
                    color={isFavorite ? '#FF7866' : '#FFFFFF'}
                  />
                )}
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleOpenCart}
            >
              <Ionicons name="cart-outline" size={20} color="#FFFFFF" />
              {cartCount > 0 ? (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>
                    {cartCount > 99 ? '99+' : cartCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        <View style={styles.heroBottomContent}>
          {restaurant.isFeatured ? (
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={13} color="#111111" />
              <Text style={styles.heroBadgeText}>{t('restaurant.premiumRestaurant')}</Text>
            </View>
          ) : null}

          <Text style={styles.heroTitle}>{restaurant.name}</Text>

          <Text style={styles.heroMeta}>
            {restaurant.ratingCount > 0
              ? `⭐ ${formatRating(restaurant.rating)} (${restaurant.ratingCount})`
              : t('restaurant.ratingUnavailable')}
            {' • '}
            {formatPreparationTime(restaurant.preparationTime)}
          </Text>
        </View>
      </View>

      <FlatList
        data={flatMenu}
        keyExtractor={getItemKey}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            colors={['#D4A017']}
            tintColor="#D4A017"
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {!!errorMessage && (
              <View style={styles.refreshWarning}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={18}
                  color="#A85A24"
                />
                <Text style={styles.refreshWarningText}>
                  {t('restaurant.refreshFailed')}
                </Text>
                <Pressable
                  onPress={() => fetchData(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('restaurant.retry')}
                >
                  <Text style={styles.refreshRetryText}>
                    {t('restaurant.retry')}
                  </Text>
                </Pressable>
              </View>
            )}

            <View style={styles.quickStatsRow}>
              <View style={styles.quickStatCard}>
                <Text style={styles.quickStatValue}>{menu.length}</Text>
                <Text style={styles.quickStatLabel}>{t('restaurant.dishes')}</Text>
              </View>

              <View style={styles.quickStatCard}>
                <Text style={styles.quickStatValue}>{availableItemsCount}</Text>
                <Text style={styles.quickStatLabel}>{t('restaurant.available')}</Text>
              </View>

              <View style={styles.quickStatCard}>
                <Text style={styles.quickStatValue}>{featuredItemsCount}</Text>
                  <Text style={styles.quickStatLabel}>{t('restaurant.featuredDishes')}</Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.metaRow}>
                <Ionicons name="restaurant-outline" size={16} color="#D96C2D" />
                <Text style={styles.metaText}>
                  {restaurant.cuisine}
                  {restaurant.city ? ` • ${restaurant.city}` : ''}
                  {!restaurant.isOpen ? ` • ${t('home.closed')}` : ` • ${t('home.open')}`}
                </Text>
              </View>

              {!!restaurant.address && (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={16} color="#1F6F43" />
                  <Text style={styles.metaText}>{restaurant.address}</Text>
                </View>
              )}

              <View style={styles.metaRow}>
                <Ionicons name="card-outline" size={16} color="#245EA8" />
                <Text style={styles.metaText}>
                  {t('restaurant.deliveryFee', { amount: formatPrice(restaurant.deliveryFee, restaurant.currency) })}
                </Text>
              </View>

              {!!restaurant.description && (
                <Text style={styles.descriptionBlock}>
                  {restaurant.description}
                </Text>
              )}
            </View>

            <Text style={styles.menuSectionTitle}>{t('restaurant.menu')}</Text>

            <View style={styles.menuSearchBox}>
              <Ionicons name="search-outline" size={18} color="#8A8278" />
              <TextInput
                value={menuSearch}
                onChangeText={setMenuSearch}
                placeholder={t('restaurant.searchMenu')}
                placeholderTextColor="#9B938A"
                style={styles.menuSearchInput}
                returnKeyType="search"
                accessibilityLabel={t('restaurant.searchMenu')}
              />
              {!!menuSearch && (
                <Pressable
                  onPress={() => setMenuSearch('')}
                  accessibilityRole="button"
                  accessibilityLabel={t('restaurant.clearMenuSearch')}
                >
                  <Ionicons name="close-circle" size={19} color="#8A8278" />
                </Pressable>
              )}
            </View>

            {menuCategories.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryFilters}
              >
                {[
                  { key: 'all', label: t('restaurant.allCategories') },
                  ...menuCategories.map((category) => ({
                    key: category,
                    label: getMenuCategoryLabel(category, t),
                  })),
                ].map((category) => {
                  const selected = categoryFilter === category.key;

                  return (
                    <Pressable
                      key={category.key}
                      style={[
                        styles.categoryFilter,
                        selected && styles.categoryFilterSelected,
                      ]}
                      onPress={() => setCategoryFilter(category.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.categoryFilterText,
                          selected && styles.categoryFilterTextSelected,
                        ]}
                      >
                        {category.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {menu.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>{t('restaurant.noDishAvailable')}</Text>
                <Text style={styles.emptyText}>
                  {t('restaurant.noDishText')}
                </Text>
              </View>
            ) : filteredMenu.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>
                  {t('restaurant.menuNoResults')}
                </Text>
                <Text style={styles.emptyText}>
                  {t('restaurant.menuNoResultsText')}
                </Text>
                <Pressable
                  style={styles.clearFiltersButton}
                  onPress={() => {
                    setMenuSearch('');
                    setCategoryFilter('all');
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.clearFiltersText}>
                    {t('restaurant.clearMenuFilters')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
      />
    </View>
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

  heroWrapper: {
    position: 'relative',
  },

  cover: {
    width: '100%',
    height: 270,
    backgroundColor: '#E9E1D5',
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },

  overlaySoft: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.20)',
  },

  topBar: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.34)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  favoriteIconBtn: {
    marginRight: 10,
  },

  logoBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },

  logoImage: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },

  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#D4A017',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },

  cartBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },

  heroBottomContent: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
  },

  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4C95D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },

  heroBadgeText: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: '900',
    color: '#111111',
  },

  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 6,
  },

  heroMeta: {
    color: '#F7F7F7',
    fontSize: 14,
    fontWeight: '700',
  },

  listContent: {
    paddingBottom: 28,
  },

  header: {
    padding: 16,
    paddingBottom: 8,
  },

  refreshWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF2E4',
    borderColor: '#F0D4B8',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },

  refreshWarningText: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
    color: '#7A4A24',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },

  refreshRetryText: {
    color: '#1F6F43',
    fontSize: 12,
    fontWeight: '800',
  },

  quickStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 16,
  },

  quickStatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#F1E7DA',
  },

  quickStatValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 4,
  },

  quickStatLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#777777',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#F2E9DD',
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },

  metaText: {
    flex: 1,
    marginLeft: 8,
    color: '#5F5A54',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },

  descriptionBlock: {
    color: '#555555',
    marginTop: 4,
    lineHeight: 21,
    fontSize: 14,
  },

  debugSourceBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#FFF3D8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  debugSourceText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8A6500',
  },

  menuSectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1F1F1F',
    marginBottom: 4,
  },

  menuSearchBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9E1D8',
    borderRadius: 15,
    paddingHorizontal: 13,
    marginTop: 10,
    marginBottom: 12,
  },

  menuSearchInput: {
    flex: 1,
    color: '#1F1F1F',
    fontSize: 14,
    paddingVertical: 10,
    paddingHorizontal: 9,
  },

  categoryFilters: {
    flexDirection: 'row',
    paddingBottom: 12,
    paddingRight: 4,
  },

  categoryFilter: {
    minHeight: 36,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9E1D8',
    borderRadius: 999,
    paddingHorizontal: 13,
    marginRight: 8,
  },

  categoryFilterSelected: {
    backgroundColor: '#1F6F43',
    borderColor: '#1F6F43',
  },

  categoryFilterText: {
    color: '#655E56',
    fontSize: 12,
    fontWeight: '800',
  },

  categoryFilterTextSelected: {
    color: '#FFFFFF',
  },

  clearFiltersButton: {
    alignSelf: 'center',
    backgroundColor: '#1F6F43',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginTop: 4,
  },

  clearFiltersText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  categoryTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1F1F1F',
    marginTop: 18,
    marginBottom: 6,
    marginHorizontal: 16,
  },

  card: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  itemImage: {
    width: 78,
    height: 78,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: '#F3E6D7',
  },

  textContent: {
    flex: 1,
    paddingRight: 8,
  },

  itemName: {
    fontWeight: '800',
    fontSize: 16,
    color: '#1A1A1A',
  },

  desc: {
    color: '#777777',
    marginTop: 6,
    lineHeight: 18,
    fontSize: 13,
  },

  storyText: {
    color: '#9A6A3C',
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 17,
    fontSize: 12.5,
  },

  tagsRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  price: {
    color: '#D96C2D',
    fontWeight: '800',
    fontSize: 14,
    marginRight: 10,
    marginBottom: 6,
  },

  tagBadge: {
    backgroundColor: '#FFF3D8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 6,
    marginBottom: 6,
  },

  tagBadgeText: {
    color: '#8A6500',
    fontSize: 11,
    fontWeight: '800',
  },

  tagBadgeSecondary: {
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 6,
    marginBottom: 6,
  },

  tagBadgeSecondaryText: {
    color: '#245EA8',
    fontSize: 11,
    fontWeight: '800',
  },

  unavailableBadge: {
    backgroundColor: '#FDEAEA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 6,
  },

  unavailableBadgeText: {
    color: '#B63B3B',
    fontSize: 11,
    fontWeight: '800',
  },

  addBtn: {
    backgroundColor: '#D4A017',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  addBtnDisabled: {
    opacity: 0.5,
  },

  emptyState: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F2E9DD',
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
  },

  emptyText: {
    color: '#777777',
    marginTop: 6,
    lineHeight: 20,
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    paddingHorizontal: 24,
  },

  loaderText: {
    marginTop: 12,
    color: '#666666',
  },

  errorText: {
    fontSize: 15,
    color: '#333333',
    textAlign: 'center',
  },

  retryBtn: {
    marginTop: 16,
    backgroundColor: '#D4A017',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },

  retryText: {
    fontWeight: '800',
    color: '#111111',
  },

  buttonPressed: {
    opacity: 0.84,
  },
});
