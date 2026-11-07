import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CartContext = createContext(null);

/**
 * =========================================================
 * STORAGE
 * =========================================================
 */

const STORAGE_KEY = '@afroeat_cart_v2';

/**
 * =========================================================
 * HELPERS CORE
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

const normalizeQuantity = (value, fallback = 1) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.floor(parsed));
};

const isPlainObject = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

/**
 * =========================================================
 * NORMALIZE RESTAURANT
 * =========================================================
 */

const normalizeRestaurant = (restaurant) => {
  if (!isPlainObject(restaurant)) {
    return null;
  }

  return {
    ...restaurant,
    _id: restaurant?._id || restaurant?.id || null,
    id: restaurant?.id || restaurant?._id || null,
    name: normalizeText(restaurant?.name, 'Restaurant'),
    image: normalizeText(restaurant?.image || restaurant?.coverImage),
    coverImage: normalizeText(restaurant?.coverImage || restaurant?.image),
    currency: normalizeText(restaurant?.currency, 'EUR'),
  };
};

/**
 * =========================================================
 * NORMALIZE ITEM
 * =========================================================
 */

const normalizeCartItem = (item) => {
  if (!isPlainObject(item)) {
    return null;
  }

  const itemId = item?._id || item?.id || item?.menuItem || item?.menuItemId;

  if (!itemId) {
    return null;
  }

  const restaurantObject =
    isPlainObject(item?.restaurant) ? normalizeRestaurant(item.restaurant) : null;

  const restaurantId =
    item?.restaurantId ||
    restaurantObject?._id ||
    restaurantObject?.id ||
    (typeof item?.restaurant === 'string' ? item.restaurant : null) ||
    null;

  return {
    ...item,
    _id: itemId,
    id: item?.id || itemId,
    menuItem: item?.menuItem || itemId,

    name: normalizeText(item?.name || item?.title || item?.nom, 'Article'),
    description: normalizeText(
      item?.description || item?.desc,
      'Aucune description'
    ),
    image: normalizeText(item?.image || item?.photo || item?.thumbnail),
    price: Math.max(0, normalizeNumber(item?.price, 0)),
    quantity: normalizeQuantity(item?.quantity, 1),
    currency: normalizeText(item?.currency || restaurantObject?.currency, 'EUR'),

    restaurantId,
    restaurant: restaurantObject || restaurantId || null,
    restaurantName: normalizeText(
      item?.restaurantName || restaurantObject?.name
    ),
    restaurantImage: normalizeText(
      item?.restaurantImage ||
        restaurantObject?.image ||
        restaurantObject?.coverImage
    ),
  };
};

const normalizeCartItems = (items) => {
  return Array.isArray(items)
    ? items.map(normalizeCartItem).filter(Boolean)
    : [];
};

/**
 * =========================================================
 * STORAGE SAFE
 * =========================================================
 */

const saveCart = async (items) => {
  try {
    const normalized = normalizeCartItems(items);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch (error) {
    console.log('SAVE CART ERROR:', error);
    return false;
  }
};

const clearCartStorage = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.log('CLEAR CART ERROR:', error);
    return false;
  }
};

/**
 * =========================================================
 * PROVIDER
 * =========================================================
 */

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);

  /**
   * =========================================================
   * HYDRATE
   * =========================================================
   */

  const hydrate = useCallback(async () => {
    try {
      setLoading(true);

      const raw = await AsyncStorage.getItem(STORAGE_KEY);

      if (!raw) {
        setCartItems([]);
        return;
      }

      let parsed = [];

      try {
        parsed = JSON.parse(raw);
      } catch (parseError) {
        console.log('HYDRATE PARSE ERROR:', parseError);
        await clearCartStorage();
        setCartItems([]);
        return;
      }

      setCartItems(normalizeCartItems(parsed));
    } catch (error) {
      console.log('HYDRATE ERROR:', error);
      await clearCartStorage();
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void hydrate();
    }, 0);
    return () => clearTimeout(timer);
  }, [hydrate]);

  /**
   * =========================================================
   * RULES
   * =========================================================
   */

  const ensureSingleRestaurant = useCallback((currentItems, incomingItem) => {
    const existingRestaurantId = currentItems?.[0]?.restaurantId || null;
    const incomingRestaurantId = incomingItem?.restaurantId || null;

    if (
      currentItems.length > 0 &&
      existingRestaurantId &&
      incomingRestaurantId &&
      String(existingRestaurantId) !== String(incomingRestaurantId)
    ) {
      throw new Error(
        'Tu ne peux pas ajouter des articles de plusieurs restaurants dans le même panier.'
      );
    }
  }, []);

  /**
   * =========================================================
   * ADD
   * =========================================================
   */

  const addToCart = useCallback(
    async (item) => {
      const normalizedItem = normalizeCartItem(item);

      if (!normalizedItem?._id) {
        throw new Error('Article panier invalide.');
      }

      ensureSingleRestaurant(cartItems, normalizedItem);

      const existingItem = cartItems.find(
        (cartItem) => String(cartItem._id) === String(normalizedItem._id)
      );

      let nextCart = [];

      if (existingItem) {
        nextCart = cartItems.map((cartItem) =>
          String(cartItem._id) === String(normalizedItem._id)
            ? {
                ...cartItem,
                quantity: normalizeQuantity(
                  normalizeNumber(cartItem.quantity, 1) +
                    normalizeQuantity(normalizedItem.quantity, 1)
                ),
              }
            : cartItem
        );
      } else {
        nextCart = [...cartItems, normalizedItem];
      }

      setCartItems(nextCart);
      await saveCart(nextCart);

      return nextCart;
    },
    [cartItems, ensureSingleRestaurant]
  );

  /**
   * =========================================================
   * REMOVE
   * =========================================================
   */

  const removeFromCart = useCallback(
    async (id) => {
      const safeId = normalizeText(id);

      if (!safeId) {
        return;
      }

      const nextCart = cartItems.filter(
        (item) => String(item._id) !== String(safeId)
      );

      setCartItems(nextCart);

      if (nextCart.length === 0) {
        await clearCartStorage();
      } else {
        await saveCart(nextCart);
      }

      return nextCart;
    },
    [cartItems]
  );

  /**
   * =========================================================
   * UPDATE QUANTITY
   * =========================================================
   */

  const updateQuantity = useCallback(
    async (id, quantity) => {
      const safeId = normalizeText(id);
      const parsedQty = Number(quantity);

      if (!safeId) {
        return;
      }

      if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
        return removeFromCart(safeId);
      }

      const nextCart = cartItems.map((item) =>
        String(item._id) === String(safeId)
          ? {
              ...item,
              quantity: normalizeQuantity(parsedQty, 1),
            }
          : item
      );

      setCartItems(nextCart);
      await saveCart(nextCart);

      return nextCart;
    },
    [cartItems, removeFromCart]
  );

  /**
   * =========================================================
   * CLEAR
   * =========================================================
   */

  const clearCart = useCallback(async () => {
    setCartItems([]);
    await clearCartStorage();
    return true;
  }, []);

  /**
   * =========================================================
   * REPLACE
   * =========================================================
   */

  const replaceCart = useCallback(async (items) => {
    const normalized = normalizeCartItems(items);

    setCartItems(normalized);

    if (normalized.length === 0) {
      await clearCartStorage();
    } else {
      await saveCart(normalized);
    }

    return normalized;
  }, []);

  /**
   * =========================================================
   * TOTALS
   * =========================================================
   */

  const totals = useMemo(() => {
    const items = cartItems.reduce((sum, item) => {
      return sum + normalizeQuantity(item?.quantity, 1);
    }, 0);

    const subtotal = cartItems.reduce((sum, item) => {
      return (
        sum +
        Math.max(0, normalizeNumber(item?.price, 0)) *
          normalizeQuantity(item?.quantity, 1)
      );
    }, 0);

    return {
      items,
      subtotal: Number(subtotal.toFixed(2)),
      delivery: null,
      total: null,
    };
  }, [cartItems]);

  const totalPrice = useMemo(() => totals.total, [totals]);

  /**
   * =========================================================
   * HELPERS EXPORT
   * =========================================================
   */

  const getTotalItems = useCallback(() => totals.items, [totals]);

  const getTotalPrice = useCallback(() => totals.total, [totals]);

  const getRestaurantId = useCallback(() => {
    return cartItems?.[0]?.restaurantId || null;
  }, [cartItems]);

  const getRestaurantName = useCallback(() => {
    return cartItems?.[0]?.restaurantName || '';
  }, [cartItems]);

  const getRestaurantImage = useCallback(() => {
    return cartItems?.[0]?.restaurantImage || '';
  }, [cartItems]);

  const hasItems = useMemo(() => cartItems.length > 0, [cartItems]);

  /**
   * =========================================================
   * CONTEXT VALUE
   * =========================================================
   */

  const value = useMemo(
    () => ({
      cartItems,
      loading,
      hasItems,

      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      replaceCart,

      totals,
      totalPrice,

      getTotalItems,
      getTotalPrice,
      getRestaurantId,
      getRestaurantName,
      getRestaurantImage,

      refreshCart: hydrate,
    }),
    [
      cartItems,
      loading,
      hasItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      replaceCart,
      totals,
      totalPrice,
      getTotalItems,
      getTotalPrice,
      getRestaurantId,
      getRestaurantName,
      getRestaurantImage,
      hydrate,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

/**
 * =========================================================
 * HOOK
 * =========================================================
 */

export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart doit être utilisé à l’intérieur de CartProvider');
  }

  return context;
};
