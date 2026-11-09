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
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, Redirect, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import FadeInView from '../../components/FadeInView';
import HomeHeader from '../../components/HomeHeader';
import PlaceBrandMark from '../../components/PlaceBrandMark';
import OwnImage from '../../components/OwnImage';
import { getAllMenuItems } from '../../services/menuService';
import { getNearbyPlacesAdaptive } from '../../services/placeService';
import { matchesAfricanPlaceSearch } from '../../services/placeSearch';
import { getAllRestaurants, searchRestaurants, getNearbyRestaurants } from '../../services/restaurantService';
import {
  DEFAULT_NEARBY_CENTER,
  DEFAULT_NEARBY_RADIUS,
  NEARBY_RADIUS_OPTIONS,
  loadNearbyRadius,
  normalizeNearbyRadius,
  saveNearbyRadius,
} from '../../services/nearbySearchSettings';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { BrandFonts } from '../../constants/brand';

/**
 * =========================================================
 * ASSETS LOCAUX
 * =========================================================
 */

const withTimeout = (promise, timeoutMs, message) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });

const resolveNearbyCoordinates = async () => {
  let permissionGranted = false;

  try {
    const permission = await withTimeout(
      Location.getForegroundPermissionsAsync(),
      8000,
      'La vérification de la localisation a expiré.'
    );
    permissionGranted = permission?.status === 'granted';

    if (permissionGranted) {
      const position = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        12000,
        'La position GPS n’a pas répondu à temps.'
      );
      const latitude = position?.coords?.latitude;
      const longitude = position?.coords?.longitude;

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return {
          coordinates: { latitude, longitude },
          usingDefaultArea: false,
          permissionGranted,
        };
      }
    }
  } catch (error) {
    console.log('Position indisponible pour explorer :', error);
  }

  return {
    coordinates: DEFAULT_NEARBY_CENTER,
    usingDefaultArea: true,
    permissionGranted,
  };
};

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
  'Malienne',
  'Africaine',
  'Camerounaise',
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
  'Boissons',
  'Boutique',
  'Salon afro',
];

const AFRICAN_CUISINE_FILTERS = [
  'Ivoirienne',
  'Sénégalaise',
  'Congolaise',
  'Malienne',
  'Camerounaise',
  'Marocaine',
  'Algérienne',
  'Tunisienne',
  'Nigériane',
  'Ghanéenne',
  'Éthiopienne',
  'Sud-africaine',
];

// Valeurs FILTERS en francais (cles de filtre) ; slug pour affichage traduit.
const FILTER_SLUG_BY_LABEL = {
  Tous: 'all',
  Ivoirienne: 'ivoirienne',
  Sénégalaise: 'senegalaise',
  Congolaise: 'congolaise',
  Malienne: 'malienne',
  Africaine: 'africaine',
  Camerounaise: 'camerounaise',
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
  Épicerie: 'epicerie',
  Boissons: 'boissons',
  Boutique: 'boutique',
  'Pizza': 'pizza',
  'Burgers': 'burgers',
  'Tacos': 'tacos',
  'Grillades': 'grillades',
  'Cuisine internationale': 'internationale',
  'Fast-food': 'fastFood',
  'Salon afro': 'africanSalon',
};

const isPublicDirectoryPlace = (item) =>
  item?.source === 'openstreetmap' || item?.source === 'public-directory';

const getPublicPlaceTypeLabel = (category, t) => {
  const keyByCategory = {
    restaurant: 'restaurant',
    'african-fast-food': 'fastFood',
    'african-grocery': 'grocery',
    'african-salon': 'salon',
    'african-business': 'business',
  };
  return t(`publicPlace.${keyByCategory[category] || 'business'}`);
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

const resolveExploreFilter = (value) => {
  const normalized = normalizeSearch(value);
  const aliases = {
    'restaurant africain': 'Africaine',
    'restaurants africains': 'Africaine',
    restaurants: 'Africaine',
    restaurant: 'Africaine',
    groceries: 'Épicerie',
    drinks: 'Boissons',
    shops: 'Boutique',
    'epiceries africaines': 'Épicerie',
    'epicerie africaine': 'Épicerie',
    epiceries: 'Épicerie',
    'boutiques & salons afro': 'Boutique',
    'commerces africains': 'Boutique',
    boutique: 'Boutique',
    'fast food africain': 'Fast-food',
    'fast foods africains': 'Fast-food',
    'salon afro': 'Salon afro',
  };
  if (aliases[normalized]) return aliases[normalized];
  return FILTERS.find((filter) => normalizeSearch(filter) === normalized) || 'Tous';
};

// ---------------------------------------------------------------------------
// Règles de correspondance des filtres (reprises de la version GitHub).
// Les métadonnées réelles du partenaire restent la source de vérité : on ne
// déduit aucune catégorie pour l'affichage, on rend seulement le filtre choisi
// par le client plus tolérant (pluriels, variantes FR/EN, pays et régions).
// ---------------------------------------------------------------------------
const FAST_FOOD_TERMS = [
    'fast food', 'fast-food', 'burger', 'hamburger', 'pizza', 'tacos',
    'fried chicken', 'poulet frit', 'sandwich', 'kebab', 'shawarma',
    'snack', 'hot dog', 'wrap',
  ];

const AFRICAN_REGION_TERMS = {
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

const matchesExtendedFilter = (normalizedFilter, item) => {
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
  const includesAny = (terms) =>
    terms.some((term) => cuisineText.includes(normalizeSearch(term)));

  const matchesFastFood = normalizedFilter === 'fast-food' && includesAny(FAST_FOOD_TERMS);
  const beverageTerms = [
    'boisson', 'beverage', 'drink', 'juice', 'jus', 'smoothie', 'cocktail',
    'coffee', 'cafe', 'tea', 'the', 'soda', 'water', 'eau', 'milkshake',
  ];
  const matchesBeverages = normalizedFilter === 'boissons' && includesAny(beverageTerms);
  const matchesGroceries =
    normalizedFilter === 'epicerie' &&
    includesAny(['grocery', 'groceries', 'epicerie', 'épicerie', 'market', 'supermarket', 'alimentaire']);
  const matchesShops =
    normalizedFilter === 'boutique' &&
    includesAny(['shop', 'store', 'boutique', 'marketplace']);
  const regionKey = normalizedFilter.replace(/[’']/g, '').replace(/\s+/g, ' ');
  const matchesAfricanRegion = includesAny(AFRICAN_REGION_TERMS[regionKey] || []);
  const countryCuisineTerms = {
    malienne: ['malian', 'mali', 'malienne', 'malien'],
    algerienne: ['algerian', 'algeria', 'algerienne', 'algerien', 'algérienne'],
    tunisienne: ['tunisian', 'tunisia', 'tunisienne', 'tunisien'],
  };
  const matchesCountryCuisine = includesAny(countryCuisineTerms[normalizedFilter] || []);
  const categoryTerms = {
    pizza: ['pizza', 'pizzeria'],
    burgers: ['burger', 'burgers', 'hamburger', 'cheeseburger'],
    tacos: ['taco', 'tacos', 'tacos français'],
    grillades: ['grillade', 'grillades', 'grill', 'grilled', 'barbecue', 'bbq', 'braisé', 'braise'],
    internationale: ['international', 'world cuisine', 'fusion', 'cuisine du monde'],
  };
  const matchesCuisineFormat = includesAny(categoryTerms[normalizedFilter] || []);

  return (
    matchesFastFood ||
    matchesCuisineFormat ||
    matchesBeverages ||
    matchesGroceries ||
    matchesShops ||
    matchesAfricanRegion ||
    matchesCountryCuisine
  );
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
  const rating = normalizeNumber(value, 0);

  if (rating < 0) return 0;
  if (rating > 5) return 5;

  return rating;
};

const normalizeDeliveryTimeValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  const text = normalizeText(value);
  if (!text) return null;

  const numeric = Number.parseInt(text, 10);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  return null;
};

const formatDeliveryTime = (value, unavailableLabel) => {
  const minutes = normalizeDeliveryTimeValue(value);
  return minutes ? `${minutes} min` : unavailableLabel;
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

const normalizeRestaurant = (item = {}) => {
  const rawId =
    item?._id || item?.id || item?.restaurantId || item?.slug || '';

  const cuisine = normalizeText(item?.cuisine, 'Cuisine à préciser');
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
    isOpen: normalizeBoolean(item?.isOpen, false),
    rating: clampRating(item?.ratingAverage ?? item?.rating),
    ratingCount: normalizeNumber(item?.ratingCount, 0),
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

const getDishRestaurantId = (dish) => {
  const restaurantRef = dish?.restaurant;
  return normalizeText(
    restaurantRef?._id ||
      restaurantRef?.id ||
      dish?.restaurantId ||
      (typeof restaurantRef === 'string' ? restaurantRef : '')
  );
};

// Photo propre au commerce uniquement (jamais de photo d'illustration).
const getRestaurantImageUri = (item) =>
  normalizeText(
    isPublicDirectoryPlace(item)
      ? item?.imageUrl
      : item?.coverImage || item?.image
  );

const normalizePublicPlace = (item = {}, category) => {
  const id = normalizeText(item?.id || item?._id);
  if (!id) return null;

  return {
    ...item,
    _id: id,
    id,
    source: item?.source || 'openstreetmap',
    category: item?.category || category,
    name: normalizeText(item?.name, 'Commerce africain référencé'),
    cuisine: normalizeText(item?.cuisine),
    address: normalizeText(item?.address, item?.city || 'Adresse non disponible'),
    city: normalizeText(item?.city),
    isOpen: null,
    isFeatured: false,
    rating: 0,
    ratingCount: 0,
    distanceKm: normalizeNumber(item?.distanceKm, null),
  };
};

const isSameDirectoryPlace = (partner, publicPlace) => {
  if (normalizeSearch(partner?.name) !== normalizeSearch(publicPlace?.name)) {
    return false;
  }

  const partnerAddress = normalizeSearch(partner?.address);
  const publicAddress = normalizeSearch(publicPlace?.address);
  if (
    partnerAddress &&
    publicAddress &&
    partnerAddress !== 'adresse non disponible' &&
    publicAddress !== 'adresse non disponible' &&
    partnerAddress === publicAddress
  ) {
    return true;
  }

  const readCoordinate = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const partnerLatitude = readCoordinate(partner?.latitude ?? partner?.location?.latitude);
  const partnerLongitude = readCoordinate(partner?.longitude ?? partner?.location?.longitude);
  const publicLatitude = readCoordinate(publicPlace?.latitude);
  const publicLongitude = readCoordinate(publicPlace?.longitude);
  if (![partnerLatitude, partnerLongitude, publicLatitude, publicLongitude].every(Number.isFinite)) {
    return false;
  }

  const radians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLatitude = radians(publicLatitude - partnerLatitude);
  const deltaLongitude = radians(publicLongitude - partnerLongitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(radians(partnerLatitude)) *
      Math.cos(radians(publicLatitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) < 0.25;
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function ExploreScreen() {
  const routeParams = useLocalSearchParams();
  const routeQuery = Array.isArray(routeParams.q) ? routeParams.q[0] : routeParams.q;
  const routeCategory = Array.isArray(routeParams.category)
    ? routeParams.category[0]
    : routeParams.category;
  return (
    <ExploreScreenContent
      key={`${routeCategory || ''}:${routeQuery || ''}`}
      routeQuery={routeQuery}
      routeCategory={routeCategory}
    />
  );
}

function ExploreScreenContent({ routeQuery, routeCategory }) {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const user = auth.user ?? null;
  const token = auth.token ?? null;
  const currentRole = normalizeRole(auth.role || user?.role);
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const authLoading = Boolean(auth.loading);

  const [query, setQuery] = useState(() => normalizeText(routeQuery));
  const [activeFilter, setActiveFilter] = useState(() => resolveExploreFilter(routeCategory));
  const [openOnly, setOpenOnly] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [publicPlaces, setPublicPlaces] = useState([]);
  const [expandedRadius, setExpandedRadius] = useState(null);
  const [allDishes, setAllDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publicPlacesLoading, setPublicPlacesLoading] = useState(false);
  const [needsLocationPermission, setNeedsLocationPermission] = useState(false);
  const [usingDefaultArea, setUsingDefaultArea] = useState(false);
  const [selectedDistance, setSelectedDistance] = useState(DEFAULT_NEARBY_RADIUS);
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
  const restaurantsRequestId = useRef(0);
  const publicPlacesRequestId = useRef(0);
  const searchCoordinatesRequest = useRef(null);

  const getSearchCoordinates = useCallback(async () => {
    if (!searchCoordinatesRequest.current) {
      const pending = resolveNearbyCoordinates();
      searchCoordinatesRequest.current = pending;
      try {
        return await pending;
      } finally {
        if (searchCoordinatesRequest.current === pending) {
          searchCoordinatesRequest.current = null;
        }
      }
    }

    return searchCoordinatesRequest.current;
  }, []);

  const loadPublicPlaces = useCallback(async (radiusOverride = null) => {
    const requestId = ++publicPlacesRequestId.current;
    setPublicPlacesLoading(true);

    try {
      const radiusKm = normalizeNearbyRadius(
        radiusOverride ?? await loadNearbyRadius()
      );
      if (requestId !== publicPlacesRequestId.current) return;
      setSelectedDistance(radiusKm);

      const searchContext = await getSearchCoordinates();
      if (requestId !== publicPlacesRequestId.current) return;
      setNeedsLocationPermission(!searchContext.permissionGranted);
      setUsingDefaultArea(searchContext.usingDefaultArea);

      const payload = await getNearbyPlacesAdaptive({
        ...searchContext.coordinates,
        radius: radiusKm,
        token: tokenRef.current,
      });
      if (requestId !== publicPlacesRequestId.current) return;
      setExpandedRadius(payload?.expanded ? payload.effectiveRadius : null);

      const foundPlaces = [
        ...(Array.isArray(payload?.restaurants) ? payload.restaurants : []).map((item) =>
          normalizePublicPlace(item, 'restaurant')
        ),
        ...(Array.isArray(payload?.fastFoods) ? payload.fastFoods : []).map((item) =>
          normalizePublicPlace(item, 'african-fast-food')
        ),
        ...(Array.isArray(payload?.groceries) ? payload.groceries : []).map((item) =>
          normalizePublicPlace(item, 'african-grocery')
        ),
        ...(Array.isArray(payload?.businesses) ? payload.businesses : []).map((item) =>
          normalizePublicPlace(item, 'african-business')
        ),
      ].filter(Boolean);

      setPublicPlaces(foundPlaces);
    } catch (error) {
      console.log('Commerces africains publics indisponibles :', error);
    } finally {
      if (requestId === publicPlacesRequestId.current) {
        setPublicPlacesLoading(false);
      }
    }
  }, [getSearchCoordinates]);

  const loadRestaurants = useCallback(async (isRefresh = false, radiusOverride = null) => {
    const requestId = ++restaurantsRequestId.current;

    try {
      const radiusKm = normalizeNearbyRadius(
        radiusOverride ?? await loadNearbyRadius()
      );
      if (requestId !== restaurantsRequestId.current) return;
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage('');
      setSelectedDistance(radiusKm);

      const searchContext = await getSearchCoordinates();
      if (requestId !== restaurantsRequestId.current) return;
      setNeedsLocationPermission(!searchContext.permissionGranted);
      setUsingDefaultArea(searchContext.usingDefaultArea);

      const data = await getNearbyRestaurants({
        ...searchContext.coordinates,
        maxDistance: radiusKm,
        token: tokenRef.current,
      });
      if (requestId !== restaurantsRequestId.current) return;

      const extracted = extractRestaurantsFromResponse(data);

      const safeRestaurants = extracted
        .map((item, index) => normalizeRestaurant(item, index))
        .filter((item) => item?._id);

      setRestaurants(safeRestaurants);
    } catch (error) {
      if (requestId !== restaurantsRequestId.current) return;
      console.log('Erreur explore restaurants :', error);
      setErrorMessage(
        normalizeText(
          error?.message,
          'Impossible de charger les restaurants.'
        )
      );
    } finally {
      if (requestId === restaurantsRequestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [getSearchCoordinates]);

  // Épiceries, boissons et boutiques : filtrées côté serveur (par type de commerce),
  // avec repli sur la liste complète si le serveur ne sait pas filtrer.
  const [categoryRestaurants, setCategoryRestaurants] = useState(null);
  const loadCategoryRestaurants = useCallback(async () => {
    const businessTypeByFilter = {
      'Épicerie': 'grocery',
      'Boissons': 'drinks',
      'Boutique': 'shop',
    };
    const businessType = businessTypeByFilter[activeFilter];
    if (!businessType) {
      setCategoryRestaurants(null);
      return;
    }

    try {
      let data;
      try {
        data = await searchRestaurants({ businessType, token: tokenRef.current });
      } catch {
        data = await getAllRestaurants(tokenRef.current);
      }
      setCategoryRestaurants(
        extractRestaurantsFromResponse(data)
          .map((item) => normalizeRestaurant(item))
          .filter((item) => item?._id)
      );
    } catch (error) {
      console.log('Erreur explore catégorie :', error);
      setCategoryRestaurants(null);
    }
  }, [activeFilter]);

  useEffect(() => {
    if (redirectPath) return undefined;
    const categoryTimer = setTimeout(() => {
      loadCategoryRestaurants();
    }, 0);
    return () => clearTimeout(categoryTimer);
  }, [loadCategoryRestaurants, redirectPath]);

  useEffect(() => {
    if (redirectPath) return undefined;

    const startupTimer = setTimeout(() => {
      loadRestaurants(false);
      loadPublicPlaces();
    }, 0);

    return () => clearTimeout(startupTimer);
  }, [loadRestaurants, loadPublicPlaces, redirectPath]);

  useEffect(() => {
    if (redirectPath) return undefined;

    let isMounted = true;

    getAllMenuItems(tokenRef.current)
      .then((items) => {
        if (isMounted) setAllDishes(Array.isArray(items) ? items : []);
      })
      .catch((error) => {
        console.log('Impossible de charger les plats à explorer :', error);
      });

    return () => {
      isMounted = false;
    };
  }, [redirectPath]);

  /**
   * =========================================================
   * DERIVED STATE
   * =========================================================
   */

  const restaurantsById = useMemo(
    () => new Map(restaurants.map((restaurant) => [String(restaurant._id), restaurant])),
    [restaurants]
  );

  const directoryItems = useMemo(() => {
    const partners = categoryRestaurants ?? restaurants;
    const uniquePublicPlaces = publicPlaces.filter(
      (place) => !partners.some((partner) => isSameDirectoryPlace(partner, place))
    );
    return [...partners, ...uniquePublicPlaces];
  }, [publicPlaces, restaurants, categoryRestaurants]);

  const filteredRestaurants = useMemo(() => {
    const normalizedFilter = normalizeSearch(activeFilter);

    return directoryItems
      .filter((item) => {
        const cuisine = normalizeSearch(item?.cuisine);
        const matchesQuery = matchesAfricanPlaceSearch(item, query, t);

        const matchesFilter =
          normalizedFilter === 'tous' ||
          cuisine.includes(normalizedFilter) ||
          (normalizedFilter === 'africaine' && (
            cuisine.includes('afric') ||
            AFRICAN_CUISINE_FILTERS.some((label) => cuisine.includes(normalizeSearch(label))) ||
            ['restaurant', 'african-fast-food'].includes(item?.category) ||
            !isPublicDirectoryPlace(item)
          )) ||
          (normalizedFilter === 'epicerie' && item?.category === 'african-grocery') ||
          (normalizedFilter === 'boutique' && ['african-business', 'african-salon'].includes(item?.category)) ||
          (normalizedFilter === 'fast-food' && item?.category === 'african-fast-food') ||
          (normalizedFilter === 'salon afro' && item?.category === 'african-salon') ||
          matchesExtendedFilter(normalizedFilter, item);
        const matchesAvailability =
          !openOnly || (!isPublicDirectoryPlace(item) && item?.isOpen === true);

        return matchesQuery && matchesFilter && matchesAvailability;
      })
      .sort((a, b) => {
        const aOpen = isPublicDirectoryPlace(a) ? 0 : Number(Boolean(a?.isOpen));
        const bOpen = isPublicDirectoryPlace(b) ? 0 : Number(Boolean(b?.isOpen));

        if (aOpen !== bOpen) {
          return bOpen - aOpen;
        }

        const ratingDifference = clampRating(b?.rating) - clampRating(a?.rating);
        if (ratingDifference !== 0) return ratingDifference;

        const aFeatured = a?.isFeatured ? 1 : 0;
        const bFeatured = b?.isFeatured ? 1 : 0;
        if (aFeatured !== bFeatured) return bFeatured - aFeatured;

        // À égalité : le plus proche d'abord.
        const aDistance = Number.isFinite(a?.distanceKm) ? a.distanceKm : Infinity;
        const bDistance = Number.isFinite(b?.distanceKm) ? b.distanceKm : Infinity;
        return aDistance - bDistance;
      });
  }, [directoryItems, query, activeFilter, openOnly, t]);

  const matchingDishes = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (normalizedQuery.length < 2) return [];

    const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
    const normalizedFilter = normalizeSearch(activeFilter);

    return allDishes
      .filter((dish) => {
        if (dish?.available === false || dish?.isAvailable === false) {
          return false;
        }

        const restaurantRef = dish?.restaurant;
        const restaurantId = getDishRestaurantId(dish);
        const restaurant = restaurantsById.get(String(restaurantId));
        const restaurantIsOpen =
          restaurant?.isOpen === true || restaurantRef?.isOpen === true;
        if (openOnly && !restaurantIsOpen) return false;

        const searchableText = normalizeSearch(
          [
            dish?.name,
            dish?.description,
            dish?.category,
            dish?.cuisine,
            dish?.story,
            restaurantRef?.name,
            restaurantRef?.cuisine,
            restaurantRef?.address,
            restaurant?.name,
            restaurant?.cuisine,
            restaurant?.address,
          ]
            .filter(Boolean)
            .join(' ')
        );

        const matchesQuery =
          searchableText.includes(normalizedQuery) ||
          queryWords.every((word) => searchableText.includes(word));
        const dishCuisine = normalizeSearch(
          restaurantRef?.cuisine || restaurant?.cuisine || dish?.cuisine
        );
        const matchesFilter =
          normalizedFilter === 'tous' ||
          dishCuisine.includes(normalizedFilter) ||
          (normalizedFilter === 'africaine' && dishCuisine.includes('afric'));

        return matchesQuery && matchesFilter;
      })
      .sort((a, b) => {
        const aName = normalizeSearch(a?.name);
        const bName = normalizeSearch(b?.name);
        const aExact = aName === normalizedQuery ? 1 : 0;
        const bExact = bName === normalizedQuery ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;

        const aStartsWithQuery = aName.startsWith(normalizedQuery) ? 1 : 0;
        const bStartsWithQuery = bName.startsWith(normalizedQuery) ? 1 : 0;
        if (aStartsWithQuery !== bStartsWithQuery) {
          return bStartsWithQuery - aStartsWithQuery;
        }

        const aRecommended = a?.isRecommended ? 1 : 0;
        const bRecommended = b?.isRecommended ? 1 : 0;
        if (aRecommended !== bRecommended) return bRecommended - aRecommended;

        return Number(Boolean(b?.isPopular)) - Number(Boolean(a?.isPopular));
      })
      .slice(0, 8);
  }, [allDishes, query, activeFilter, openOnly, restaurantsById]);

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
      normalizeSearch(activeFilter) !== 'tous' ||
      openOnly);

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

  const handleOpenDirectoryItem = useCallback((item) => {
    if (!isPublicDirectoryPlace(item)) {
      handleOpenRestaurant(item?._id);
      return;
    }

    router.push({
      pathname: '/place/[id]',
      params: {
        id: item.id,
        source: item.source,
        name: item.name,
        category: item.category,
        address: item.address,
        cuisine: item.cuisine,
        origin: item.origin,
        city: item.city,
        country: item.country,
        distanceKm: item.distanceKm == null ? '' : String(item.distanceKm),
        phone: item.phone,
        email: item.email,
        website: item.website,
        menuUrl: item.menuUrl,
        logoUrl: item.logoUrl,
        imageUrl: item.imageUrl,
        openingHours: item.openingHours,
        description: item.description,
        brand: item.brand,
        operator: item.operator,
        osmType: item.osmType,
        osmId: item.osmId,
        osmUrl: item.osmUrl,
      },
    });
  }, [handleOpenRestaurant]);

  const getDishCurrency = useCallback(
    (dish) => {
      const restaurantRef = dish?.restaurant;
      const restaurantId = getDishRestaurantId(dish);

      return (
        dish?.currency ||
        restaurantRef?.currency ||
        restaurantsById.get(String(restaurantId))?.currency ||
        'EUR'
      );
    },
    [restaurantsById]
  );

  const handleResetFilters = useCallback(() => {
    setQuery('');
    setActiveFilter('Tous');
    setOpenOnly(false);
  }, []);

  const handleRetry = useCallback(() => {
    loadRestaurants(false);
    loadPublicPlaces();
  }, [loadPublicPlaces, loadRestaurants]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadRestaurants(true), loadPublicPlaces()]);
  }, [loadPublicPlaces, loadRestaurants]);

  const handleDistanceChange = useCallback(async (radiusKm) => {
    if (radiusKm === selectedDistance) return;

    const safeRadius = normalizeNearbyRadius(radiusKm);
    setSelectedDistance(safeRadius);
    setRestaurants([]);
    setPublicPlaces([]);
    await saveNearbyRadius(safeRadius);
    await Promise.all([
      loadRestaurants(true, safeRadius),
      loadPublicPlaces(safeRadius),
    ]);
  }, [loadPublicPlaces, loadRestaurants, selectedDistance]);

  const handleEnableNearbySearch = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission?.status === 'granted') {
        await Promise.all([loadRestaurants(true), loadPublicPlaces()]);
      } else {
        setNeedsLocationPermission(true);
      }
    } catch (error) {
      console.log('Autorisation de localisation indisponible :', error);
      setNeedsLocationPermission(true);
    }
  }, [loadPublicPlaces, loadRestaurants]);

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
          user={user}
        />

        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="compass-outline" size={22} color="#084424" />
          </View>
          <View style={styles.heroTextBlock}>
            <Text style={styles.title}>{t('explore.title')}</Text>
            <Text style={styles.subtitle}>{t('explore.subtitle')}</Text>
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
              accessibilityLabel={t('explore.searchPlaceholder')}
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

        {!!query && matchingDishes.length > 0 && (
          <View style={styles.dishesSection}>
            <View style={styles.dishesHeading}>
              <Text style={styles.sectionTitle}>{t('explore.dishesFound')}</Text>
              <View style={styles.dishesCount}>
                <Text style={styles.dishesCountText}>{matchingDishes.length}</Text>
              </View>
            </View>
            <FlatList
              data={matchingDishes}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, index) => `${item?._id || item?.id || 'dish'}-${index}`}
              contentContainerStyle={styles.dishesRow}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('explore.openDish', { name: item?.name })}
                  style={({ pressed }) => [
                    styles.dishCard,
                    pressed && styles.dishCardPressed,
                  ]}
                  onPress={() => {
                    handleOpenRestaurant(getDishRestaurantId(item));
                  }}
                >
                  <OwnImage uri={item?.image} style={styles.dishImage} />
                  <Text style={styles.dishName} numberOfLines={1}>
                    {item?.name}
                  </Text>
                  <Text style={styles.dishRestaurant} numberOfLines={1}>
                    {item?.restaurant?.name ||
                      item?.restaurantName ||
                      item?.restaurant?.cuisine ||
                      t('restaurant.profile.restaurantFallbackName')}
                  </Text>
                  <Text style={styles.dishPrice}>
                    {formatPrice(item?.price, getDishCurrency(item))}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        )}

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

        <View style={styles.distanceSection}>
          <Text style={styles.distanceLabel}>{t('explore.distance')}</Text>
          <View style={styles.distanceOptions}>
            {NEARBY_RADIUS_OPTIONS.map((distance) => (
              <Pressable
                key={distance}
                accessibilityRole="button"
                accessibilityLabel={t('explore.distanceOption', { distance })}
                accessibilityState={{ selected: selectedDistance === distance }}
                onPress={() => handleDistanceChange(distance)}
                style={({ pressed }) => [
                  styles.distanceChip,
                  selectedDistance === distance && styles.distanceChipActive,
                  pressed && styles.filterChipPressed,
                ]}
              >
                <Text
                  style={[
                    styles.distanceChipText,
                    selectedDistance === distance && styles.distanceChipTextActive,
                  ]}
                >
                  {distance} km
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: openOnly }}
          accessibilityLabel={t('explore.openNow')}
          style={({ pressed }) => [
            styles.openOnlyChip,
            openOnly && styles.openOnlyChipActive,
            pressed && styles.filterChipPressed,
          ]}
          onPress={() => setOpenOnly((current) => !current)}
        >
          <Ionicons
            name={openOnly ? 'checkmark-circle' : 'time-outline'}
            size={17}
            color={openOnly ? '#FFFFFF' : '#084424'}
          />
          <Text
            style={[
              styles.openOnlyText,
              openOnly && styles.openOnlyTextActive,
            ]}
          >
            {t('explore.openNow')}
          </Text>
        </Pressable>

        {(needsLocationPermission || usingDefaultArea) && (
          <View style={styles.locationNotice}>
            <Ionicons name="location-outline" size={19} color="#084424" />
            <Text style={styles.locationNoticeText}>
              {t(usingDefaultArea ? 'explore.defaultAreaNotice' : 'explore.nearbyPermissionText', {
                distance: selectedDistance,
              })}
            </Text>
            {needsLocationPermission ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleEnableNearbySearch}
                style={({ pressed }) => [styles.locationNoticeButton, pressed && styles.filterChipPressed]}
              >
                <Text style={styles.locationNoticeButtonText}>{t('explore.enableLocation')}</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <View style={styles.resultsHeader}>
          <View>
            <Text style={styles.resultsTitle}>{t('explore.results')}</Text>
            <Text style={styles.resultsSubtitle}>
              {t('explore.resultsSubtitle', { count: directoryItems.length })}
              {publicPlacesLoading ? ` · ${t('explore.publicSearchLoading')}` : ''}
            </Text>
            {expandedRadius ? (
              <Text style={styles.resultsSubtitle}>
                {t('explore.zoneExpanded', { km: expandedRadius })}
              </Text>
            ) : null}
          </View>

          <Text style={styles.resultsCount}>
            {t('explore.resultsCount', { count: resultCount })}
          </Text>
        </View>

        {!!errorMessage && !loading && (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={18} color="#C8331A" />
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
    handleDistanceChange,
    errorMessage,
    expandedRadius,
    getDishCurrency,
    directoryItems.length,
    handleEnableNearbySearch,
    handleOpenRestaurant,
    loading,
    matchingDishes,
    needsLocationPermission,
    usingDefaultArea,
    openOnly,
    publicPlacesLoading,
    query,
    resultCount,
    selectedDistance,
    t,
    user,
  ]);

  /**
   * =========================================================
   * RENDER RESTAURANT
   * =========================================================
   */

  const renderRestaurant = useCallback(
    ({ item }) => {
      const isPublicPlace = isPublicDirectoryPlace(item);
      const isOpen = !isPublicPlace && item?.isOpen !== false;
      const hasRating = normalizeNumber(item?.ratingCount, 0) > 0;
      const rating = clampRating(item?.rating).toFixed(1);
      const deliveryTime = formatDeliveryTime(item?.deliveryTimeMinutes, t('home.timeUnavailable'));
      const imageUri = getRestaurantImageUri(item);
      // Pas de photo propre au commerce : fond neutre + son logo ou l'icône de sa catégorie.
      const showPlaceholder = !imageUri;
      const publicPlaceType = getPublicPlaceTypeLabel(item?.category, t);

      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('explore.openRestaurant', { name: item?.name })}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => handleOpenDirectoryItem(item)}
        >
          <View style={styles.cardImageWrap}>
            {showPlaceholder ? (
              <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                <PlaceBrandMark
                  logoUrl={item?.logoUrl}
                  website={item?.website}
                  category={item?.category}
                  size={72}
                />
              </View>
            ) : (
              <Image
                source={{ uri: imageUri }}
                style={styles.cardImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={180}
              />
            )}

            {!!item?.isFeatured ? (
              <View style={styles.featuredBadge}>
                <Ionicons name="flash-outline" size={12} color="#0D1C11" />
                <Text style={styles.featuredBadgeText}>{t('home.featured')}</Text>
              </View>
            ) : null}
            {isPublicPlace ? (
              <View style={styles.publicBadge}>
                <Ionicons name="globe-outline" size={12} color="#FFFFFF" />
                <Text style={styles.publicBadgeText}>{t('publicPlace.publicListing')}</Text>
              </View>
            ) : null}
            {isPublicPlace && !showPlaceholder && Boolean(item?.logoUrl || item?.website) ? (
              <View style={styles.placeBrandBadge}>
                <PlaceBrandMark
                  logoUrl={item.logoUrl}
                  website={item.website}
                  category={item.category}
                  size={48}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item?.name}
              </Text>

              {hasRating && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color="#EAB02F" />
                  <Text style={styles.cardRating}>{rating}</Text>
                </View>
              )}
            </View>

            <Text style={styles.cardCuisine} numberOfLines={1}>
              {item?.cuisine || publicPlaceType}
            </Text>

            <View style={styles.cardMetaRow}>
              <Ionicons name="location-outline" size={14} color="#606D5D" />
              <Text style={styles.cardAddress} numberOfLines={1}>
                {item?.address}
              </Text>
            </View>

            {isPublicPlace ? (
              <View style={styles.cardFooter}>
                <Text style={styles.publicCardMetaText}>{publicPlaceType}</Text>
                {Number.isFinite(item?.distanceKm) && (
                  <Text style={styles.publicCardMetaText}>
                    {t('publicPlace.distance', { distance: item.distanceKm })}
                  </Text>
                )}
                <Text style={styles.deliveryTime}>{t('publicPlace.openDetails')}</Text>
              </View>
            ) : <View style={styles.cardFooter}>
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
                  {isOpen ? t('home.open') : t('home.closed')}
                </Text>
              </View>

              <Text style={styles.deliveryTime}>{deliveryTime}</Text>
            </View>}
          </View>
        </Pressable>
      );
    },
    [handleOpenDirectoryItem, t]
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
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

      <FlatList
        data={filteredRestaurants}
        keyExtractor={(item, index) =>
          `${item?._id || item?.id || 'restaurant'}-${index}`
        }
        renderItem={renderRestaurant}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#EAB02F"
          />
        }
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={10}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          loading || publicPlacesLoading ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color="#EAB02F" />
              <Text style={styles.loaderText}>{t('explore.loadingResults')}</Text>
            </View>
          ) : matchingDishes.length > 0 ? (
            <View style={styles.dishOnlySpacer} />
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
    backgroundColor: '#FBF6EC',
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 120,
    flexGrow: 1,
  },

  heroCard: {
    backgroundColor: '#084424',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },

  heroTextBlock: {
    flex: 1,
  },

  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  searchCard: {
    marginBottom: 8,
  },

  title: {
    fontSize: 21,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },

  subtitle: {
    textAlign: 'left',
    color: '#E9F3EC',
    fontSize: 13,
    lineHeight: 19,
  },

  searchBox: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#ECE1D4',
  },

  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#0D1C11',
  },

  dishesSection: {
    marginTop: -2,
    marginBottom: 18,
  },

  dishesHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  dishesCount: {
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

  dishesCountText: {
    color: '#084424',
    fontSize: 12,
    fontWeight: '900',
  },

  dishesRow: {
    paddingBottom: 4,
  },

  dishCard: {
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

  dishCardPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },

  dishImage: {
    width: '100%',
    height: 92,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F3EDE4',
  },

  dishName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D1C11',
  },

  dishRestaurant: {
    marginTop: 3,
    fontSize: 11,
    color: '#82796E',
  },

  dishPrice: {
    marginTop: 6,
    fontSize: 13,
    color: '#084424',
    fontWeight: '900',
  },

  sectionTitle: {
    fontSize: 22,
    fontFamily: BrandFonts.display,
    fontWeight: 'normal',
    color: '#0D1C11',
    marginBottom: 16,
  },

  filtersRow: {
    paddingBottom: 8,
    marginBottom: 8,
  },

  distanceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },

  distanceLabel: {
    color: '#526257',
    fontSize: 13,
    fontWeight: '800',
    marginRight: 8,
  },

  distanceOptions: {
    flexDirection: 'row',
    gap: 6,
  },

  distanceChip: {
    minWidth: 53,
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE8DE',
  },

  distanceChipActive: {
    backgroundColor: '#084424',
    borderColor: '#084424',
  },

  distanceChipText: {
    color: '#526257',
    fontSize: 12,
    fontWeight: '800',
  },

  distanceChipTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: '#EAB02F',
    borderColor: '#EAB02F',
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
    color: '#0D1C11',
  },

  openOnlyChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 13,
    marginBottom: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFD8C7',
    backgroundColor: '#F5FBF7',
  },

  openOnlyChipActive: {
    backgroundColor: '#084424',
    borderColor: '#084424',
  },

  openOnlyText: {
    marginLeft: 7,
    fontSize: 13,
    fontWeight: '800',
    color: '#084424',
  },

  openOnlyTextActive: {
    color: '#FFFFFF',
  },

  locationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#EEF6EF',
    borderWidth: 1,
    borderColor: '#D8E8DA',
  },

  locationNoticeText: {
    flex: 1,
    marginHorizontal: 9,
    color: '#526257',
    fontSize: 12,
    lineHeight: 17,
  },

  locationNoticeButton: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#084424',
  },

  locationNoticeButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 18,
  },

  resultsTitle: {
    fontSize: 24,
    fontFamily: BrandFonts.display,
    fontWeight: 'normal',
    color: '#0D1C11',
  },

  resultsSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#606D5D',
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
    color: '#C8331A',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },

  dishOnlySpacer: {
    height: 18,
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
  cardImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B1B22',
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
    color: '#0D1C11',
  },

  publicBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#084424',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  publicBadgeText: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  placeBrandBadge: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    padding: 4,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.94)',
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
    color: '#0D1C11',
    marginRight: 10,
  },

  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E7CA',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  cardRating: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D1C11',
    marginLeft: 4,
  },

  cardCuisine: {
    marginTop: 8,
    color: '#C8331A',
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
    color: '#606D5D',
    fontSize: 13,
    flex: 1,
  },

  cardFooter: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  publicCardMetaText: {
    color: '#82796E',
    fontSize: 11,
    fontWeight: '700',
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
    color: '#084424',
  },

  statusTextClosed: {
    color: '#C8331A',
  },

  deliveryTime: {
    fontSize: 13,
    fontWeight: '800',
    color: '#084424',
  },

  loaderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
  },

  loaderText: {
    marginTop: 12,
    color: '#606D5D',
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
    fontFamily: BrandFonts.display,
    fontWeight: 'normal',
    color: '#0D1C11',
    textAlign: 'center',
  },

  emptyText: {
    marginTop: 14,
    fontSize: 15,
    color: '#606D5D',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },

  resetButton: {
    backgroundColor: '#EAB02F',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
  },

  resetButtonText: {
    color: '#0D1C11',
    fontWeight: '900',
    fontSize: 14,
  },
});
