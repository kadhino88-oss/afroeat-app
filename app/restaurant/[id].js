import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  StatusBar,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiGet } from '../../services/apiClient';
import { API_ENDPOINTS } from '../../constants/api';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

/**
 * =========================================================
 * CONFIG DEBUG / FALLBACK
 * =========================================================
 * Temporairement activé pour débloquer l’app si l’API menu renvoie vide.
 * Mets à false plus tard quand la vraie data sera 100% stable.
 */

const ENABLE_LOCAL_MENU_FALLBACK = true;

/**
 * =========================================================
 * ASSETS LOCAUX
 * =========================================================
 */

const LOGO_IMAGE = require('../../assets/images/icon.png');
const FALLBACK_RESTAURANT_IMAGE = require('../../assets/images/react-logo.png');

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
    rating: normalizeNumber(data?.ratingAverage ?? data?.rating, 4.5),
    deliveryTime: normalizeNumber(
      data?.averagePreparationTimeMinutes ??
        data?.estimatedDeliveryTimeMinutes ??
        data?.deliveryTime ??
        data?.preparationTime,
      25
    ),
    cuisine: normalizeText(
      data?.cuisine || data?.cuisineType || data?.category,
      'Africaine'
    ),
    address: normalizeText(
      data?.address || data?.location?.address || data?.fullAddress
    ),
    isOpen: normalizeBoolean(data?.isOpen, true),
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

const buildLocalFallbackMenu = (restaurant) => {
  const restaurantId = restaurant?._id || restaurant?.id || 'fallback-restaurant';
  const cuisine = restaurant?.cuisine || 'Africaine';

  return [
    {
      _id: `fallback-${restaurantId}-1`,
      id: `fallback-${restaurantId}-1`,
      name: 'Poulet braisé premium',
      description: 'Poulet grillé mariné aux épices africaines, tendre et fumé.',
      category: 'Plats principaux',
      price: 13.9,
      image: '',
      restaurantId,
      restaurant: restaurantId,
      restaurantName: restaurant?.name || 'Restaurant',
      quantity: 1,
      available: true,
      isPopular: true,
      isRecommended: true,
      cuisine,
    },
    {
      _id: `fallback-${restaurantId}-2`,
      id: `fallback-${restaurantId}-2`,
      name: 'Attiéké poisson',
      description: 'Attiéké frais servi avec poisson frit et crudités.',
      category: 'Plats principaux',
      price: 14.5,
      image: '',
      restaurantId,
      restaurant: restaurantId,
      restaurantName: restaurant?.name || 'Restaurant',
      quantity: 1,
      available: true,
      isPopular: true,
      isRecommended: false,
      cuisine,
    },
    {
      _id: `fallback-${restaurantId}-3`,
      id: `fallback-${restaurantId}-3`,
      name: 'Alloco',
      description: 'Bananes plantains frites dorées et fondantes.',
      category: 'Accompagnements',
      price: 5.5,
      image: '',
      restaurantId,
      restaurant: restaurantId,
      restaurantName: restaurant?.name || 'Restaurant',
      quantity: 1,
      available: true,
      isPopular: true,
      isRecommended: false,
      cuisine,
    },
    {
      _id: `fallback-${restaurantId}-4`,
      id: `fallback-${restaurantId}-4`,
      name: 'Yassa poulet',
      description: 'Poulet mariné au citron et aux oignons, servi avec riz.',
      category: 'Plats principaux',
      price: 15.9,
      image: '',
      restaurantId,
      restaurant: restaurantId,
      restaurantName: restaurant?.name || 'Restaurant',
      quantity: 1,
      available: true,
      isPopular: false,
      isRecommended: true,
      cuisine,
    },
    {
      _id: `fallback-${restaurantId}-5`,
      id: `fallback-${restaurantId}-5`,
      name: 'Bissap maison',
      description: 'Boisson fraîche à l’hibiscus, légèrement sucrée.',
      category: 'Boissons',
      price: 3.9,
      image: '',
      restaurantId,
      restaurant: restaurantId,
      restaurantName: restaurant?.name || 'Restaurant',
      quantity: 1,
      available: true,
      isPopular: true,
      isRecommended: true,
      cuisine,
    },
    {
      _id: `fallback-${restaurantId}-6`,
      id: `fallback-${restaurantId}-6`,
      name: 'Thiakry',
      description: 'Dessert frais et gourmand à base de semoule fine et yaourt.',
      category: 'Desserts',
      price: 5.9,
      image: '',
      restaurantId,
      restaurant: restaurantId,
      restaurantName: restaurant?.name || 'Restaurant',
      quantity: 1,
      available: true,
      isPopular: false,
      isRecommended: true,
      cuisine,
    },
  ];
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
      'Aucune description'
    ),
    story: normalizeText(item?.story, ''),
    category: normalizeText(
      item?.category ||
        item?.section ||
        item?.group ||
        item?.menuCategory ||
        item?.type,
      'Autres'
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

const formatDeliveryTime = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return '25 min';
  return `${parsed} min`;
};

const formatRating = (value) => {
  const parsed = normalizeNumber(value, 4.5);
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

  const cart = useCart() || {};
  const addToCart = cart.addToCart;
  const getTotalItems = cart.getTotalItems;

  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [addingId, setAddingId] = useState(null);
  const [menuSource, setMenuSource] = useState('');

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
      try {
        if (!id) {
          setErrorMessage('Restaurant introuvable.');
          setRestaurant(null);
          setMenu([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        if (isManualRefresh) {
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

        let source = '';
        let primaryMenuSource = [];

        if (menuFromEndpoint.length > 0) {
          primaryMenuSource = menuFromEndpoint;
          source = 'api-menu';
        } else if (menuFromRestaurant.length > 0) {
          primaryMenuSource = menuFromRestaurant;
          source = 'restaurant-embedded';
        } else if (ENABLE_LOCAL_MENU_FALLBACK) {
          primaryMenuSource = buildLocalFallbackMenu(normalizedRestaurant);
          source = 'local-fallback';
        }

        const normalizedMenu = dedupeMenuItems(
          primaryMenuSource
            .map((item, index) => normalizeMenuItem(item, normalizedRestaurant, index))
            .filter(Boolean)
            .filter((item) => item?._id)
        );


        setRestaurant(normalizedRestaurant);
        setMenu(normalizedMenu);
        setMenuSource(source);
      } catch (error) {
        setRestaurant(null);
        setMenu([]);
        setErrorMessage(error?.message || 'Impossible de charger ce restaurant.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, token]
  );

  useFocusEffect(
    useCallback(() => {
      fetchData(false);
    }, [fetchData])
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
    [addToCart, restaurant, addingId]
  );

  /**
   * =========================================================
   * DERIVED
   * =========================================================
   */

  const menuByCategory = useMemo(() => {
    return menu.reduce((acc, item) => {
      const category = normalizeText(item?.category, 'Autres');

      if (!acc[category]) {
        acc[category] = [];
      }

      acc[category].push(item);
      return acc;
    }, {});
  }, [menu]);

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
        const categorySlug = CATEGORY_SLUG_BY_LABEL[item.title];
        const categoryLabel = categorySlug
          ? t(`restaurant.addMenuItem.categories.${categorySlug}`, item.title)
          : item.title;
        return <Text style={styles.categoryTitle}>{categoryLabel}</Text>;
      }

      const isAdding = addingId === item._id;
      const itemImageSource = getMenuItemImageSource(item, restaurant);

      return (
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <Image source={itemImageSource} style={styles.itemImage} />

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

  if (loading) {
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
        <Image source={heroImageSource} style={styles.cover} />

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
              <Image source={LOGO_IMAGE} style={styles.logoImage} />
            </View>

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
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles-outline" size={13} color="#111111" />
            <Text style={styles.heroBadgeText}>{t('restaurant.premiumRestaurant')}</Text>
          </View>

          <Text style={styles.heroTitle}>{restaurant.name}</Text>

          <Text style={styles.heroMeta}>
            ⭐ {formatRating(restaurant.rating)} • {formatDeliveryTime(restaurant.deliveryTime)}
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
                <Text style={styles.quickStatLabel}>{t('restaurant.premium')}</Text>
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

            {menu.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>{t('restaurant.noDishAvailable')}</Text>
                <Text style={styles.emptyText}>
                  {t('restaurant.noDishText')}
                </Text>
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