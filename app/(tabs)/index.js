import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { router, Redirect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import FadeInView from '../../components/FadeInView';
import HomeHeader from '../../components/HomeHeader';
import { BrandFonts } from '../../constants/brand';
import * as Location from 'expo-location';
import { getNearbyRestaurants } from '../../services/restaurantService';
import { getNearbyPlaces } from '../../services/placeService';
import { matchesAfricanPlaceSearch } from '../../services/placeSearch';
import {
  DEFAULT_NEARBY_CENTER,
  DEFAULT_NEARBY_RADIUS,
  loadNearbyRadius,
} from '../../services/nearbySearchSettings';
import { getAllMenuItems } from '../../services/menuService';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import PlaceBrandMark from '../../components/PlaceBrandMark';
import OwnImage from '../../components/OwnImage';

/**
 * =========================================================
 * DATA
 * =========================================================
 */

const CATEGORIES = [
  {
    id: '1',
    titleKey: 'explore.restaurants',
    icon: 'silverware-fork-knife',
    route: '/(tabs)/explore?category=restaurants',
  },
  {
    id: '2',
    titleKey: 'home.categories.groceries',
    icon: 'cart-outline',
    route: '/(tabs)/explore?category=groceries',
  },
  {
    id: '3',
    titleKey: 'home.categories.drinks',
    icon: 'cup-outline',
    route: '/(tabs)/explore?category=drinks',
  },
  {
    id: '4',
    titleKey: 'home.categories.shops',
    icon: 'shopping-outline',
    route: '/(tabs)/explore?category=shops',
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
  'Boutique',
];

// Les valeurs CUISINES restent en francais car elles servent de cle de
// recherche/filtre sur les donnees restaurants (stockees en francais).
// Cette map ne sert qu'a afficher un libelle traduit a l'ecran.
const CUISINE_SLUG_BY_LABEL = {
  Africaine: 'africaine',
  Sénégalaise: 'senegalaise',
  Ivoirienne: 'ivoirienne',
  Camerounaise: 'camerounaise',
  Congolaise: 'congolaise',
  Malienne: 'malienne',
  Marocaine: 'marocaine',
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
  Boutique: 'boutique',
};

// Chips "Envie du moment" : chaque humeur est reliee a des mots-cles
// verifies sur le nom, la description, la categorie et l'histoire du plat.
// Idee inspiree d'un prototype concurrent regarde avec Kader - mais
// branchee ici sur les vrais plats des restaurants AFROEAT.
const MOODS = [
  { id: 'genereux', label: 'Généreux', emoji: '🍗', keywords: ['poulet', 'grill', 'braise', 'brochette', 'viande', 'boeuf'] },
  { id: 'epice', label: 'Épicé', emoji: '🌶️', keywords: ['epice', 'piment', 'pili', 'berbere', 'harissa', 'pimente'] },
  { id: 'traditionnel', label: 'Traditionnel', emoji: '🥘', keywords: ['traditionnel', 'mijote', 'sauce', 'mafe', 'ndole', 'pondu'] },
  { id: 'riz', label: 'Avec du riz', emoji: '🍚', keywords: ['riz', 'jollof', 'thieboudienne', 'thieb', 'pilau'] },
  { id: 'plantain', label: 'Plantain', emoji: '🍌', keywords: ['plantain', 'alloco', 'aloco', 'dodo', 'kelewele'] },
  { id: 'poisson', label: 'Poisson', emoji: '🐟', keywords: ['poisson', 'tilapia', 'crevette', 'fruits de mer', 'thiof'] },
  { id: 'vegetarien', label: 'Végétarien', emoji: '🥬', keywords: ['vegetarien', 'vegan', 'legumes', 'legumineuse'] },
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

const normalizeRestaurant = (item = {}) => {
  const isPublicListing =
    item?.isPublicListing === true ||
    ['openstreetmap', 'public-directory'].includes(item?.source);
  const rawDeliveryTime = item?.deliveryTime ?? item?.estimatedDeliveryTime;
  return {
    ...item,
    _id: item?._id || item?.id || '',
    id: item?.id || item?._id || '',
    name: normalizeText(item?.name, 'Restaurant africain'),
    cuisine: normalizeText(
      item?.cuisine,
      isPublicListing ? '' : 'Cuisine africaine'
    ),
    address: normalizeText(
      item?.address || item?.location || item?.city,
      'Adresse non disponible'
    ),
    image: normalizeText(item?.image || item?.imageUrl),
    coverImage: normalizeText(item?.coverImage || item?.image || item?.imageUrl),
    isOpen:
      isPublicListing && item?.isOpen == null
        ? null
        : normalizeBoolean(item?.isOpen, true),
    isFeatured: normalizeBoolean(item?.isFeatured, false),
    rating: normalizeNumber(item?.ratingAverage ?? item?.rating, 0),
    ratingCount: normalizeNumber(item?.ratingCount, 0),
    distanceKm:
      item?.distanceKm === null || item?.distanceKm === undefined
        ? null
        : normalizeNumber(item.distanceKm, null),
    deliveryTime:
      rawDeliveryTime === null || rawDeliveryTime === undefined || rawDeliveryTime === ''
        ? ''
        : typeof rawDeliveryTime === 'number'
          ? `${rawDeliveryTime} min`
          : normalizeText(rawDeliveryTime),
    deliveryFee: item?.deliveryFee ?? null,
    currency: normalizeText(item?.currency, 'EUR'),
  };
};

const isPublicDirectoryPlace = (item) =>
  item?.isPublicListing === true ||
  ['openstreetmap', 'public-directory'].includes(item?.source);

const getDishRestaurantId = (dish) =>
  normalizeText(
    dish?.restaurant?._id ||
      dish?.restaurantId ||
      (typeof dish?.restaurant === 'string' ? dish.restaurant : '')
  );

const resolveHomeSearchArea = async () => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const latitude = Number(position?.coords?.latitude);
      const longitude = Number(position?.coords?.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return {
          coordinates: { latitude, longitude },
          usingDefaultArea: false,
        };
      }
    }
  } catch {
    // Use the configured starter area when device location is unavailable.
  }

  return {
    coordinates: DEFAULT_NEARBY_CENTER,
    usingDefaultArea: true,
  };
};

const sortNearbyRestaurants = (items) =>
  [...items].sort((first, second) => {
    const firstDistance = Number.isFinite(first?.distanceKm)
      ? first.distanceKm
      : Number.POSITIVE_INFINITY;
    const secondDistance = Number.isFinite(second?.distanceKm)
      ? second.distanceKm
      : Number.POSITIVE_INFINITY;
    return firstDistance - secondDistance;
  });

const getNearbyRestaurantKey = (item) => {
  const name = normalizeSearch(item?.name);
  const location = normalizeSearch(item?.address || item?.city);
  return `${name}|${location}`;
};

const uniqueNearbyRestaurants = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = getNearbyRestaurantKey(item);
    if (key === '|' || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const formatDeliveryFee = (value, currency, freeLabel) => {
  if (value === null || value === undefined || value === '') return '';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return normalizeText(value);
  if (amount === 0) return freeLabel;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizeText(currency, 'EUR').toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${normalizeText(currency, 'EUR').toUpperCase()}`;
  }
};

const formatPrice = (value, currency = 'EUR') => {
  const amount = normalizeNumber(value, 0);
  const safeCurrency = normalizeText(currency, 'EUR').toUpperCase();

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: safeCurrency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${safeCurrency}`;
  }
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
  const { t } = useTranslation();
  const auth = useAuth() || {};

  const { user, isAuthenticated, loading: authLoading, role, token } = auth;

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role);
  }, [role, user]);

  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publicDirectoryLoading, setPublicDirectoryLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [usingDefaultSearchArea, setUsingDefaultSearchArea] = useState(true);
  const [searchRadius, setSearchRadius] = useState(DEFAULT_NEARBY_RADIUS);
  const [allDishes, setAllDishes] = useState([]);
  const [selectedMood, setSelectedMood] = useState(null);
  const restaurantsRequestId = useRef(0);
  const hasSearchQuery = normalizeSearch(search).length > 0;

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
      t('home.greetingFallback')
    );
  }, [user, t]);

  const userAddress = useMemo(() => {
    return normalizeText(
      user?.address ||
        user?.adresse ||
        user?.deliveryAddress ||
        user?.profile?.address,
      t('home.deliveryAddressFallback')
    );
  }, [user, t]);

  const userAvatar = useMemo(() => {
    return normalizeText(
      user?.avatar || user?.photo || user?.profileImage || user?.image
    );
  }, [user]);

  const restaurantCurrencies = useMemo(
    () =>
      new Map(
        restaurants.map((restaurant) => [
          String(restaurant._id),
          restaurant.currency,
        ])
      ),
    [restaurants]
  );

  const getDishCurrency = useCallback(
    (dish) => {
      const restaurantRef = dish?.restaurant;
      const restaurantId =
        restaurantRef?._id ||
        dish?.restaurantId ||
        (typeof restaurantRef === 'string' ? restaurantRef : null);

      return (
        dish?.currency ||
        restaurantRef?.currency ||
        restaurantCurrencies.get(String(restaurantId)) ||
        'EUR'
      );
    },
    [restaurantCurrencies]
  );

  const nearbyPartnerIds = useMemo(
    () =>
      new Set(
        restaurants
          .filter((restaurant) => !isPublicDirectoryPlace(restaurant))
          .map((restaurant) => String(restaurant?._id || ''))
          .filter(Boolean)
      ),
    [restaurants]
  );

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
    const requestId = ++restaurantsRequestId.current;
    let partnerError = null;
    let directoryError = null;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setPublicDirectoryLoading(true);
      setErrorMessage('');
      const [radius, searchArea] = await Promise.all([
        loadNearbyRadius(),
        resolveHomeSearchArea(),
      ]);
      if (requestId !== restaurantsRequestId.current) return;

      setSearchRadius(radius);
      setUsingDefaultSearchArea(searchArea.usingDefaultArea);

      const requestLocation = {
        ...searchArea.coordinates,
        token: tokenRef.current,
      };

      const partnerRequest = getNearbyRestaurants({
        ...requestLocation,
        maxDistance: radius,
      })
        .then((data) => {
          const partners = extractRestaurantsPayload(data)
            .map(normalizeRestaurant)
            .filter((item) => item?._id && !isPublicDirectoryPlace(item));
          if (requestId !== restaurantsRequestId.current) return;

          setRestaurants((current) => {
            if (requestId !== restaurantsRequestId.current) return current;
            const publicPlaces = current.filter(isPublicDirectoryPlace);
            const partnerKeys = new Set(
              partners.map(getNearbyRestaurantKey).filter((key) => key !== '|')
            );
            return sortNearbyRestaurants(uniqueNearbyRestaurants([
              ...partners,
              ...publicPlaces.filter(
                (item) => !partnerKeys.has(getNearbyRestaurantKey(item))
              ),
            ]));
          });
        })
        .catch((error) => {
          partnerError = error;
          console.log('Restaurants partenaires proches indisponibles :', error);
        })
        .finally(() => {
          if (requestId === restaurantsRequestId.current) setLoading(false);
        });

      const directoryRequest = getNearbyPlaces({
        ...searchArea.coordinates,
        radius,
        token: tokenRef.current,
      })
        .then((payload) => {
          const publicPlaces = [
            ...(Array.isArray(payload?.restaurants) ? payload.restaurants : []),
            ...(Array.isArray(payload?.fastFoods) ? payload.fastFoods : []),
            ...(Array.isArray(payload?.groceries) ? payload.groceries : []),
            ...(Array.isArray(payload?.businesses) ? payload.businesses : []),
          ]
            .map((place) =>
              normalizeRestaurant({
                ...place,
                isPublicListing: true,
                image: place?.imageUrl || place?.image,
                coverImage: place?.imageUrl || place?.image,
              })
            )
            .filter((item) => item?._id);
          if (requestId !== restaurantsRequestId.current) return;

          setRestaurants((current) => {
            if (requestId !== restaurantsRequestId.current) return current;
            const partners = current.filter(
              (item) => !isPublicDirectoryPlace(item)
            );
            const partnerKeys = new Set(
              partners.map(getNearbyRestaurantKey).filter((key) => key !== '|')
            );
            return sortNearbyRestaurants([
              ...partners,
              ...uniqueNearbyRestaurants(publicPlaces).filter(
                (item) => !partnerKeys.has(getNearbyRestaurantKey(item))
              ),
            ]);
          });
        })
        .catch((error) => {
          directoryError = error;
          console.log('Annuaire public proche indisponible :', error);
        })
        .finally(() => {
          if (requestId === restaurantsRequestId.current) {
            setPublicDirectoryLoading(false);
          }
        });

      await Promise.all([partnerRequest, directoryRequest]);
      if (
        requestId === restaurantsRequestId.current &&
        partnerError &&
        directoryError
      ) {
        setErrorMessage(
          partnerError?.message ||
            directoryError?.message ||
            'Impossible de charger les commerces à proximité.'
        );
      }
    } catch (error) {
      if (requestId !== restaurantsRequestId.current) return;
      console.log('Erreur recherche à proximité :', error);
      setErrorMessage(error?.message || 'Impossible de charger les commerces à proximité.');
    } finally {
      if (requestId === restaurantsRequestId.current) {
        setRefreshing(false);
        setLoading(false);
        setPublicDirectoryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!redirectPath) {
      const timer = setTimeout(() => loadRestaurants(), 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loadRestaurants, redirectPath]);

  // Charge tous les plats une fois, pour alimenter "Envie du moment".
  // Echec silencieux : c'est un bonus de decouverte, pas un ecran critique.
  useEffect(() => {
    if (redirectPath) return;

    let isMounted = true;

    getAllMenuItems(tokenRef.current)
      .then((items) => {
        if (isMounted) setAllDishes(Array.isArray(items) ? items : []);
      })
      .catch((error) => {
        console.log('Erreur chargement plats (Envie du moment) :', error);
      });

    return () => {
      isMounted = false;
    };
  }, [redirectPath]);

  const moodDishes = useMemo(() => {
    if (!selectedMood) return [];

    const mood = MOODS.find((item) => item.id === selectedMood);
    if (!mood) return [];

    return allDishes
      .filter((dish) => {
        if (dish?.available === false) return false;
        if (!nearbyPartnerIds.has(getDishRestaurantId(dish))) return false;

        const haystack = normalizeSearch(
          [dish?.name, dish?.description, dish?.category, dish?.story]
            .filter(Boolean)
            .join(' ')
        );

        return mood.keywords.some((keyword) => haystack.includes(keyword));
      })
      .slice(0, 10);
  }, [allDishes, nearbyPartnerIds, selectedMood]);

  const matchingDishes = useMemo(() => {
    const query = normalizeSearch(search);
    if (query.length < 2) return [];

    const queryWords = query.split(/\s+/).filter(Boolean);

    return allDishes
      .filter((dish) => {
        if (dish?.available === false || dish?.isAvailable === false) {
          return false;
        }
        if (!nearbyPartnerIds.has(getDishRestaurantId(dish))) return false;

        const searchableText = normalizeSearch(
          [
            dish?.name,
            dish?.description,
            dish?.category,
            dish?.cuisine,
            dish?.story,
            dish?.restaurant?.name,
            dish?.restaurantName,
          ]
            .filter(Boolean)
            .join(' ')
        );

        return (
          searchableText.includes(query) ||
          queryWords.every((word) => searchableText.includes(word))
        );
      })
      .slice(0, 8);
  }, [allDishes, nearbyPartnerIds, search]);

  const handleMoodPress = useCallback((moodId) => {
    setSelectedMood((current) => (current === moodId ? null : moodId));
  }, []);

  const handleMoodDishPress = useCallback((dish) => {
    const targetRestaurantId =
      dish?.restaurant?._id || dish?.restaurantId || dish?.restaurant;

    if (targetRestaurantId) {
      router.push(`/restaurant/${targetRestaurantId}`);
    }
  }, []);

  const filteredRestaurants = useMemo(() => {
    const query = normalizeSearch(search);

    const filtered = restaurants.filter((item) => {
      if (!query) {
        return (
          !isPublicDirectoryPlace(item) ||
          ['restaurant', 'african-fast-food'].includes(item?.category)
        );
      }

      // Recherche sur les métadonnées réelles du partenaire (catégories, type de
      // commerce, description) : les raccourcis d'accueil trouvent aussi les
      // fast-foods et commerces dont le format n'est pas stocké dans « cuisine ».
      const discoveryText = normalizeSearch([
        item?.cuisine,
        ...(Array.isArray(item?.categories) ? item.categories : []),
        item?.category,
        item?.type,
        item?.businessType,
        item?.storeType,
        item?.name,
        item?.description,
        item?.address,
      ].filter(Boolean).join(' '));

      return matchesAfricanPlaceSearch(item, search, t) || discoveryText.includes(query);
    });

    return filtered.sort((a, b) => {
      const aOpen = a?.isOpen ? 1 : 0;
      const bOpen = b?.isOpen ? 1 : 0;

      if (aOpen !== bOpen) {
        return bOpen - aOpen;
      }

      const aHasDistance = Number.isFinite(a?.distanceKm);
      const bHasDistance = Number.isFinite(b?.distanceKm);

      if (aHasDistance !== bHasDistance) {
        return aHasDistance ? -1 : 1;
      }

      if (aHasDistance && bHasDistance && a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }

      const aFeatured = a?.isFeatured ? 1 : 0;
      const bFeatured = b?.isFeatured ? 1 : 0;

      if (aFeatured !== bFeatured) {
        return bFeatured - aFeatured;
      }

      return normalizeNumber(b?.rating, 0) - normalizeNumber(a?.rating, 0);
    });
  }, [restaurants, search, t]);

  const handleCuisinePress = useCallback((value) => {
    setSearch(value);
  }, []);

  const handleCategoryPress = useCallback((routeValue) => {
    router.push(routeValue);
  }, []);

  const handleOpenRestaurant = useCallback((restaurant) => {
    if (!restaurant?._id) return;
    if (isPublicDirectoryPlace(restaurant)) {
      router.push({
        pathname: '/place/[id]',
        params: {
          id: String(restaurant._id),
          source: String(restaurant.source || ''),
          name: String(restaurant.name || ''),
          category: String(restaurant.category || 'restaurant'),
          address: String(restaurant.address || ''),
          cuisine: String(restaurant.cuisine || ''),
          origin: String(restaurant.origin || ''),
          city: String(restaurant.city || ''),
          country: String(restaurant.country || ''),
          distanceKm: String(restaurant.distanceKm ?? ''),
          phone: String(restaurant.phone || ''),
          email: String(restaurant.email || ''),
          website: String(restaurant.website || ''),
          menuUrl: String(restaurant.menuUrl || ''),
          logoUrl: String(restaurant.logoUrl || ''),
          imageUrl: String(restaurant.imageUrl || restaurant.image || ''),
          openingHours: String(restaurant.openingHours || ''),
          description: String(restaurant.description || ''),
          brand: String(restaurant.brand || ''),
          operator: String(restaurant.operator || ''),
          osmUrl: String(restaurant.osmUrl || ''),
        },
      });
      return;
    }
    router.push(`/restaurant/${restaurant._id}`);
  }, []);

  const renderRestaurant = useCallback(
    ({ item }) => {
      const isPublicListing = isPublicDirectoryPlace(item);
      const isOpen = item?.isOpen === true;
      const hasOpeningStatus = typeof item?.isOpen === 'boolean';
      const hasRating = normalizeNumber(item?.ratingCount, 0) > 0;
      const rating = normalizeNumber(item?.rating, 0).toFixed(1);
      const publicCategoryLabel =
        item?.category === 'african-fast-food'
          ? t('publicPlace.fastFood')
          : item?.category === 'african-grocery'
            ? t('publicPlace.grocery')
            : item?.category === 'african-salon'
              ? t('publicPlace.salon')
              : item?.category === 'restaurant'
                ? t('publicPlace.restaurant')
                : t('publicPlace.business');
      const cuisineLabel = normalizeText(item?.cuisine, publicCategoryLabel);
      const deliveryTime = isPublicListing
        ? ''
        : normalizeText(item?.deliveryTime, t('home.timeUnavailable'));
      const deliveryFee = isPublicListing
        ? ''
        : formatDeliveryFee(item?.deliveryFee, item?.currency, t('home.deliveryFree'));
      const distanceText = Number.isFinite(item?.distanceKm)
        ? item.distanceKm < 1
          ? `${Math.round(item.distanceKm * 1000)} m`
          : `${item.distanceKm.toFixed(1)} km`
        : '';

      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ouvrir ${item?.name}`}
          style={({ pressed }) => [
            styles.restaurantCard,
            pressed && styles.restaurantCardPressed,
          ]}
          onPress={() => handleOpenRestaurant(item)}
        >
          <View style={styles.restaurantImageWrapper}>
            {isPublicListing ? (
              <View style={styles.publicBrandPanel}>
                <PlaceBrandMark
                  logoUrl={item?.logoUrl}
                  website={item?.website}
                  category={item?.category}
                  size={78}
                />
                <Text style={styles.publicListingLabel}>
                  {t('publicPlace.publicListing')}
                </Text>
              </View>
            ) : (
              <OwnImage
                uri={item?.image || item?.coverImage}
                style={styles.restaurantImage}
                icon="restaurant-outline"
                iconSize={40}
              />
            )}

            {hasRating && (
              <View style={styles.badge}>
                <Ionicons name="star" size={13} color="#EAB02F" />
                <Text style={styles.badgeText}>{rating}</Text>
              </View>
            )}

            {hasOpeningStatus ? (
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
                  {isOpen ? t('home.open') : t('home.closed')}
                </Text>
              </View>
            ) : null}

            {!!item?.isFeatured && (
              <View style={styles.featuredBadge}>
                <Ionicons name="flash-outline" size={12} color="#0D1C11" />
                <Text style={styles.featuredBadgeText}>{t('home.featured')}</Text>
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
              {cuisineLabel}
            </Text>

            <View style={styles.restaurantMetaRow}>
              <Ionicons name="location-outline" size={14} color="#606D5D" />
              <Text style={styles.restaurantAddress} numberOfLines={1}>
                {item?.address}
              </Text>
            </View>

            {!!deliveryFee || !!distanceText ? (
              <View style={styles.restaurantFooterRow}>
                {!!deliveryFee && (
                  <View style={styles.deliveryFeeBadge}>
                    <Ionicons name="bicycle-outline" size={14} color="#084424" />
                    <Text style={styles.deliveryFeeText}>{deliveryFee}</Text>
                  </View>
                )}
                {!!distanceText && (
                  <View style={styles.distanceBadge}>
                    <Ionicons name="navigate-outline" size={13} color="#6B5D4D" />
                    <Text style={styles.distanceText}>{distanceText}</Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [handleOpenRestaurant, t]
  );

  if (redirectPath) {
    return <Redirect href={redirectPath} />;
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

      <FlatList
        data={filteredRestaurants}
        keyExtractor={(item, index) =>
          item?._id?.toString() || index.toString()
        }
        renderItem={renderRestaurant}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={5}
        maxToRenderPerBatch={6}
        windowSize={8}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRestaurants(true)}
            tintColor="#EAB02F"
          />
        }
        ListHeaderComponent={
          <View>
            <HomeHeader
              userName={userName}
              locationText={userAddress}
              avatarUri={userAvatar}
              user={user}
            />

            <View style={styles.heroCard}>
              <Image
                source={{
                  uri: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop',
                }}
                style={styles.heroImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={220}
              />
              <View style={styles.heroImageShade} />
              <View style={styles.heroTextWrapper}>
                <View style={styles.heroMiniBadge}>
                  <Ionicons name="sparkles-outline" size={14} color="#F4C95D" />
                  <Text style={styles.heroMiniBadgeText}>{t('home.heroEyebrow')}</Text>
                </View>

                <Text style={styles.heroTitle}>{t('home.heroTitle')}</Text>
                <Text style={styles.heroSubtitle}>{t('home.heroSubtitle')}</Text>

                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.heroButton,
                    pressed && styles.heroButtonPressed,
                  ]}
                  onPress={() => router.push('/(tabs)/explore')}
                >
                  <Text style={styles.heroButtonText}>{t('home.heroButton')}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#173725" />
                </Pressable>
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
                placeholder={t('home.searchPlaceholder')}
                placeholderTextColor="#999999"
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel={t('home.searchPlaceholder')}
              />
              {!!search && (
                <Pressable onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={20} color="#999999" />
                </Pressable>
              )}
            </View>

            {!!search && matchingDishes.length > 0 && (
              <View style={styles.searchDishesSection}>
                <View style={styles.searchDishesHeading}>
                  <Text style={styles.sectionTitle}>{t('home.dishResults')}</Text>
                  <View style={styles.searchDishCount}>
                    <Text style={styles.searchDishCountText}>{matchingDishes.length}</Text>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.searchDishesContainer}
                >
                  {matchingDishes.map((dish) => (
                    <Pressable
                      key={dish._id || dish.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${dish.name}, ${t('home.dishResults')}`}
                      style={({ pressed }) => [
                        styles.searchDishCard,
                        pressed && styles.searchDishCardPressed,
                      ]}
                      onPress={() => handleMoodDishPress(dish)}
                    >
                      <OwnImage uri={dish.image} style={styles.searchDishImage} />
                      <Text style={styles.searchDishName} numberOfLines={1}>
                        {dish.name}
                      </Text>
                      <Text style={styles.searchDishRestaurant} numberOfLines={1}>
                        {dish?.restaurant?.name || dish?.restaurantName || dish?.cuisine || ''}
                      </Text>
                      <Text style={styles.searchDishPrice}>
                        {formatPrice(
                          dish.price,
                          getDishCurrency(dish)
                        )}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {!hasSearchQuery && (
              <>
                <Text style={styles.sectionTitle}>{t('moods.title')}</Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsContainer}
                >
                  {MOODS.map((mood) => {
                    const isActive = selectedMood === mood.id;

                    return (
                      <Pressable
                        key={mood.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Plats ${t(`moods.${mood.id}`)}`}
                        style={({ pressed }) => [
                          styles.chip,
                          isActive && styles.chipActive,
                          pressed && styles.chipPressed,
                        ]}
                        onPress={() => handleMoodPress(mood.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isActive && styles.chipTextActive,
                          ]}
                        >
                          {mood.emoji} {t(`moods.${mood.id}`)}
                        </Text>
                      </Pressable>
                    );
                })}
                </ScrollView>

                {!!selectedMood && (
                  moodDishes.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.moodDishesContainer}
                    >
                      {moodDishes.map((dish) => (
                        <Pressable
                          key={dish._id || dish.id}
                          style={({ pressed }) => [
                            styles.moodDishCard,
                            pressed && styles.moodDishCardPressed,
                          ]}
                          onPress={() => handleMoodDishPress(dish)}
                        >
                          <OwnImage uri={dish.image} style={styles.moodDishImage} />
                          <Text style={styles.moodDishName} numberOfLines={1}>
                            {dish.name}
                          </Text>
                          <Text style={styles.moodDishRestaurant} numberOfLines={1}>
                            {dish?.restaurant?.name ||
                              dish?.restaurantName ||
                              dish?.cuisine ||
                              t('restaurant.profile.restaurantFallbackName')}
                          </Text>
                          <Text style={styles.moodDishPrice}>
                            {formatPrice(dish.price, getDishCurrency(dish))}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.moodEmptyText}>{t('moods.empty')}</Text>
                  )
                )}
              </>
            )}

            {!hasSearchQuery && (
              <>
                <Text style={styles.sectionTitle}>{t('home.exploreTitle')}</Text>

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
                          color="#EAB02F"
                        />
                      </View>
                      <Text style={styles.categoryText}>{t(item.titleKey)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={styles.sectionTitle}>
                  {t('home.popularCategories')}
                </Text>

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
                          {t(`cuisines.${CUISINE_SLUG_BY_LABEL[item] || ''}`, item)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {(!hasSearchQuery ||
              filteredRestaurants.length > 0 ||
              loading ||
              errorMessage) && (
              <View style={styles.listHeaderRow}>
                <Text style={styles.sectionTitle}>
                  {hasSearchQuery
                    ? t('home.restaurantResults')
                    : t('home.popularRestaurants')}
                </Text>
                <Pressable onPress={() => router.push('/(tabs)/explore')}>
                  <Text style={styles.seeAll}>{t('home.seeAll')}</Text>
                </Pressable>
              </View>
            )}

            {usingDefaultSearchArea && !hasSearchQuery ? (
              <Text style={styles.nearbyNotice}>
                {t('explore.defaultAreaNotice', { distance: searchRadius })}
              </Text>
            ) : null}

            {!!errorMessage && !loading && (
              <View style={styles.errorCard}>
                <Ionicons name="warning-outline" size={18} color="#C8331A" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading || publicDirectoryLoading ? (
            <View style={styles.loaderWrapper}>
              <ActivityIndicator size="large" color="#EAB02F" />
              <Text style={styles.loaderText}>
                {t('home.loadingRestaurants')}
              </Text>
            </View>
          ) : matchingDishes.length > 0 ? (
            <View style={styles.dishOnlySpacer} />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="restaurant-outline" size={48} color="#C4B7A6" />
              <Text style={styles.emptyTitle}>{t('home.noRestaurantFound')}</Text>
              <Text style={styles.emptyText}>
                {t('home.emptyText')}
              </Text>

              <Pressable
                style={styles.retryButton}
                onPress={() => loadRestaurants()}
              >
                <Text style={styles.retryButtonText}>{t('home.retry')}</Text>
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
    backgroundColor: '#FBF6EC',
  },

  listContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 120,
  },

  heroCard: {
    backgroundColor: '#084424',
    borderRadius: 28,
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
    minHeight: 244,
    justifyContent: 'center',
  },

  heroTextWrapper: {
    maxWidth: '80%',
    zIndex: 2,
  },

  heroMiniBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },

  heroMiniBadgeText: {
    marginLeft: 6,
    color: '#FFF7E6',
    fontSize: 12,
    fontWeight: '800',
  },

  heroTitle: {
    fontSize: 25,
    fontFamily: BrandFonts.display,
    fontWeight: 'normal',
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 31,
  },

  heroSubtitle: {
    fontSize: 14,
    color: '#EDE7DD',
    lineHeight: 21,
    marginBottom: 16,
  },

  heroButton: {
    backgroundColor: '#EAB02F',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  heroButtonPressed: {
    opacity: 0.85,
  },

  heroButtonText: {
    color: '#0D1C11',
    fontWeight: '800',
    fontSize: 14,
  },

  heroImage: {
    position: 'absolute',
    right: -20,
    bottom: -16,
    width: 200,
    height: 200,
    opacity: 0.58,
  },

  heroImageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,43,25,0.27)',
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
    color: '#0D1C11',
    fontSize: 15,
  },

  searchDishesSection: {
    marginTop: -4,
    marginBottom: 20,
  },

  searchDishesHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  searchDishCount: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    marginLeft: 8,
    marginBottom: 14,
    backgroundColor: '#E8F2EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchDishCountText: {
    color: '#084424',
    fontSize: 12,
    fontWeight: '900',
  },

  searchDishesContainer: {
    paddingBottom: 4,
    paddingRight: 4,
  },

  searchDishCard: {
    width: 158,
    marginRight: 12,
    padding: 9,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E6D9',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  searchDishCardPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },

  searchDishImage: {
    width: '100%',
    height: 94,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F3EDE4',
  },

  searchDishName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D1C11',
  },

  searchDishRestaurant: {
    marginTop: 3,
    fontSize: 11,
    color: '#82796E',
  },

  searchDishPrice: {
    marginTop: 6,
    fontSize: 13,
    color: '#084424',
    fontWeight: '900',
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0D1C11',
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
    color: '#0D1C11',
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
    backgroundColor: '#084424',
    borderColor: '#084424',
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

  moodDishesContainer: {
    paddingBottom: 8,
    marginBottom: 18,
  },

  moodDishCard: {
    width: 132,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  moodDishCardPressed: {
    opacity: 0.85,
  },

  moodDishImage: {
    width: '100%',
    height: 84,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F1EBDA',
  },

  moodDishName: {
    fontWeight: '800',
    fontSize: 13,
    color: '#0D1C11',
    marginBottom: 2,
  },

  moodDishRestaurant: {
    fontSize: 11,
    color: '#999999',
    marginBottom: 4,
  },

  moodDishPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C8331A',
  },

  moodEmptyText: {
    color: '#999999',
    fontSize: 13,
    marginBottom: 18,
  },

  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  seeAll: {
    color: '#EAB02F',
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

  publicBrandPanel: {
    width: '100%',
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F2ECE0',
  },

  publicListingLabel: {
    color: '#6D6358',
    fontSize: 12,
    fontWeight: '700',
  },

  nearbyNotice: {
    marginTop: -8,
    marginBottom: 14,
    color: '#655B50',
    fontSize: 12,
    lineHeight: 17,
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
    color: '#0D1C11',
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
    color: '#084424',
  },

  statusBadgeTextClosed: {
    color: '#C8331A',
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
    color: '#0D1C11',
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
    color: '#0D1C11',
    flex: 1,
    marginRight: 10,
  },

  deliveryTime: {
    fontSize: 13,
    color: '#084424',
    fontWeight: '800',
  },

  restaurantCuisine: {
    color: '#C8331A',
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
    color: '#606D5D',
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

  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: '#F7F4EF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  distanceText: {
    marginLeft: 5,
    color: '#6B5D4D',
    fontWeight: '700',
    fontSize: 12,
  },

  deliveryFeeText: {
    marginLeft: 6,
    color: '#084424',
    fontWeight: '700',
    fontSize: 12,
  },

  dishOnlySpacer: {
    height: 16,
  },

  loaderWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },

  loaderText: {
    marginTop: 12,
    color: '#606D5D',
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
    color: '#C8331A',
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
    color: '#0D1C11',
    marginTop: 14,
    marginBottom: 8,
  },

  emptyText: {
    textAlign: 'center',
    color: '#606D5D',
    fontSize: 15,
    lineHeight: 22,
  },

  retryButton: {
    marginTop: 18,
    backgroundColor: '#EAB02F',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },

  retryButtonText: {
    color: '#0D1C11',
    fontWeight: '800',
    fontSize: 14,
  },
});
