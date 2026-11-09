import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import OwnImage from '../components/OwnImage';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../components/FadeInView';
import { useTranslation } from 'react-i18next';

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeArray = (value) => {
  return Array.isArray(value) ? value : [];
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

const getSafeItemId = (item) => {
  return (
    item?._id ||
    item?.id ||
    item?.menuItem ||
    item?.menuItemId ||
    item?.productId ||
    null
  );
};

const getRestaurantRoute = (restaurantId) => {
  const safeId = normalizeText(restaurantId);
  return safeId ? `/restaurant/${safeId}` : null;
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function CartScreen() {
  const { t } = useTranslation();
  const cart = useCart() || {};
  const auth = useAuth() || {};

  const cartItems = cart.cartItems;
  const totals = cart.totals || {};
  const totalPrice = cart.totalPrice;
  const getTotalPrice = cart.getTotalPrice;
  const updateQuantity = cart.updateQuantity;
  const removeFromCart = cart.removeFromCart;
  const clearCart = cart.clearCart;
  const getRestaurantName = cart.getRestaurantName;
  const getRestaurantId = cart.getRestaurantId;

  const isAuthenticated = Boolean(auth.isAuthenticated);
  const token = auth.token;
  const user = auth.user ?? null;
  const role = normalizeRole(auth.role || user?.role);

  const isLoggedIn = Boolean(isAuthenticated || token || user?._id);
  const canCheckoutAsCustomer = !isLoggedIn || role === 'client';

  const safeCartItems = useMemo(() => {
    return normalizeArray(cartItems)
      .map((item) => ({
        ...item,
        _id: getSafeItemId(item),
        id: item?.id || getSafeItemId(item),
        name: normalizeText(item?.name || item?.nom || item?.title, 'Article'),
        description: normalizeText(item?.description),
        image: normalizeText(item?.image || item?.photo || item?.thumbnail),
        price: Math.max(0, normalizeNumber(item?.price, 0)),
        quantity: Math.max(0, normalizeNumber(item?.quantity, 0)),
        restaurantId:
          item?.restaurantId ||
          item?.restaurant?._id ||
          item?.restaurant ||
          item?.storeId ||
          null,
        restaurantName: normalizeText(
          item?.restaurantName || item?.restaurant?.name
        ),
        currency: normalizeText(item?.currency, 'EUR'),
      }))
      .filter((item) => item?._id);
  }, [cartItems]);

  const cartCurrency = useMemo(() => {
    return normalizeText(safeCartItems?.[0]?.currency, 'EUR');
  }, [safeCartItems]);

  const cartRestaurantName = useMemo(() => {
    if (typeof getRestaurantName === 'function') {
      return normalizeText(getRestaurantName());
    }

    return normalizeText(safeCartItems?.[0]?.restaurantName);
  }, [getRestaurantName, safeCartItems]);

  const cartRestaurantId = useMemo(() => {
    if (typeof getRestaurantId === 'function') {
      return getRestaurantId();
    }

    return safeCartItems?.[0]?.restaurantId || null;
  }, [getRestaurantId, safeCartItems]);

  const totalItems = useMemo(() => {
    return safeCartItems.reduce((sum, item) => {
      return sum + Math.max(0, normalizeNumber(item?.quantity, 0));
    }, 0);
  }, [safeCartItems]);

  const subtotal = useMemo(() => {
    if (Number.isFinite(Number(totals?.subtotal))) {
      return Math.max(0, normalizeNumber(totals.subtotal, 0));
    }

    return safeCartItems.reduce((sum, item) => {
      const lineTotal =
        Math.max(0, normalizeNumber(item?.price, 0)) *
        Math.max(0, normalizeNumber(item?.quantity, 0));

      return sum + lineTotal;
    }, 0);
  }, [safeCartItems, totals]);

  const delivery = useMemo(() => {
    if (totals?.delivery === null || totals?.delivery === undefined) return null;
    return Math.max(0, normalizeNumber(totals.delivery, 0));
  }, [totals]);

  const safeTotal = useMemo(() => {
    if (typeof getTotalPrice === 'function') {
      const value = getTotalPrice();
      return value === null || value === undefined
        ? null
        : Math.max(0, normalizeNumber(value, 0));
    }

    if (totalPrice === null || totalPrice === undefined) return null;
    if (Number.isFinite(Number(totalPrice))) {
      return Math.max(0, normalizeNumber(totalPrice, 0));
    }

    if (totals?.total === null || totals?.total === undefined) return null;
    if (Number.isFinite(Number(totals?.total))) {
      return Math.max(0, normalizeNumber(totals.total, 0));
    }

    return null;
  }, [delivery, getTotalPrice, subtotal, totalPrice, totals]);

  /**
   * =========================================================
   * ACTIONS
   * =========================================================
   */

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/explore');
  }, []);

  const handleDecrease = useCallback(
    (item) => {
      const itemId = item?._id;
      if (!itemId || typeof updateQuantity !== 'function') return;

      const currentQuantity = Math.max(0, normalizeNumber(item?.quantity, 0));
      const nextQuantity = currentQuantity - 1;

      if (nextQuantity <= 0) {
        if (typeof removeFromCart === 'function') {
          removeFromCart(itemId);
        } else {
          updateQuantity(itemId, 0);
        }
        return;
      }

      updateQuantity(itemId, nextQuantity);
    },
    [removeFromCart, updateQuantity]
  );

  const handleIncrease = useCallback(
    (item) => {
      const itemId = item?._id;
      if (!itemId || typeof updateQuantity !== 'function') return;

      const currentQuantity = Math.max(0, normalizeNumber(item?.quantity, 0));
      const nextQuantity = currentQuantity + 1;

      updateQuantity(itemId, nextQuantity);
    },
    [updateQuantity]
  );

  const handleRemove = useCallback(
    (item) => {
      const itemId = item?._id;
      if (!itemId || typeof removeFromCart !== 'function') return;

      removeFromCart(itemId);
    },
    [removeFromCart]
  );

  const handleClearCart = useCallback(() => {
    if (safeCartItems.length === 0 || typeof clearCart !== 'function') {
      return;
    }

    Alert.alert(
      t('cart.clearCart'),
      t('cart.clearCartAlertBody'),
      [
        { text: t('cart.cancel'), style: 'cancel' },
        {
          text: t('cart.clear'),
          style: 'destructive',
          onPress: () => clearCart(),
        },
      ]
    );
  }, [clearCart, safeCartItems.length]);

  const handleCheckout = useCallback(() => {
    if (safeCartItems.length === 0) {
      return;
    }

    if (!canCheckoutAsCustomer) {
      Alert.alert(
        t('checkout.alertUnauthorizedTitle'),
        t('cart.unauthorizedBody')
      );
      return;
    }

    if (!isLoggedIn) {
      router.push('/auth/role');
      return;
    }

    router.push('/checkout');
  }, [canCheckoutAsCustomer, isLoggedIn, safeCartItems.length]);

  const handleExplore = useCallback(() => {
    router.push('/(tabs)/explore');
  }, []);

  const handleOpenRestaurant = useCallback(() => {
    const route = getRestaurantRoute(cartRestaurantId);

    if (!route) {
      router.push('/(tabs)/explore');
      return;
    }

    router.push(route);
  }, [cartRestaurantId]);

  /**
   * =========================================================
   * RENDER ITEM
   * =========================================================
   */

  const renderItem = useCallback(
    ({ item }) => {
      const itemName = normalizeText(item?.name, 'Article');
      const itemPrice = Math.max(0, normalizeNumber(item?.price, 0));
      const itemQuantity = Math.max(0, normalizeNumber(item?.quantity, 0));
      const itemTotal = itemPrice * itemQuantity;
      const itemDescription = normalizeText(item?.description);
      
      return (
        <View style={styles.card}>
          <View style={styles.cardTopRow}>
            <OwnImage uri={item?.image} style={styles.itemImage} />

            <View style={styles.itemInfo}>
              <Text style={styles.name} numberOfLines={1}>
                {itemName}
              </Text>

              {!!itemDescription && (
                <Text style={styles.description} numberOfLines={2}>
                  {itemDescription}
                </Text>
              )}

              <Text style={styles.price}>
                {formatPrice(itemPrice, item?.currency || cartCurrency)}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('cart.removeItem', { item: itemName })}
              onPress={() => handleRemove(item)}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="trash-outline" size={18} color="#C8331A" />
            </Pressable>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.quantityBox}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('cart.decreaseQty', { item: itemName })}
                onPress={() => handleDecrease(item)}
                style={({ pressed }) => [
                  styles.quantityButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Ionicons name="remove" size={18} color="#0D1C11" />
              </Pressable>

              <Text style={styles.quantityText}>{itemQuantity}</Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('cart.increaseQty', { item: itemName })}
                onPress={() => handleIncrease(item)}
                style={({ pressed }) => [
                  styles.quantityButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Ionicons name="add" size={18} color="#0D1C11" />
              </Pressable>
            </View>

            <Text style={styles.itemTotal}>
              {formatPrice(itemTotal, item?.currency || cartCurrency)}
            </Text>
          </View>
        </View>
      );
    },
    [cartCurrency, handleDecrease, handleIncrease, handleRemove]
  );

  /**
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('cart.back')}
          onPress={handleBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Ionicons name="arrow-back" size={22} color="#0D1C11" />
        </Pressable>

        <Text style={styles.title}>{t('cart.title')}</Text>

        {safeCartItems.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('cart.clearCart')}
            onPress={handleClearCart}
            style={({ pressed }) => [
              styles.clearButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.clearButtonText}>{t('cart.clear')}</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {!!cartRestaurantName && safeCartItems.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('cart.openRestaurant', { restaurant: cartRestaurantName })}
          style={({ pressed }) => [
            styles.restaurantBanner,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleOpenRestaurant}
        >
          <Ionicons name="restaurant-outline" size={16} color="#084424" />
          <Text style={styles.restaurantBannerText} numberOfLines={1}>
            {t('checkout.orderingAt', { restaurant: cartRestaurantName })}
          </Text>
          <Ionicons
            name="chevron-forward-outline"
            size={18}
            color="#084424"
          />
        </Pressable>
      )}

      {!isLoggedIn && safeCartItems.length > 0 && (
        <View style={styles.guestBanner}>
          <Ionicons name="sparkles-outline" size={16} color="#8A6500" />
          <Text style={styles.guestBannerText}>
            {t('cart.guestBannerText')}
          </Text>
        </View>
      )}

      {isLoggedIn && role !== 'client' && safeCartItems.length > 0 && (
        <View style={styles.roleWarningBanner}>
          <Ionicons name="shield-outline" size={16} color="#8A2E2E" />
          <Text style={styles.roleWarningText}>
            {t('cart.roleWarningText')}
          </Text>
        </View>
      )}

      <FlatList
        data={safeCartItems}
        keyExtractor={(item, index) =>
          `${item?._id || item?.id || 'cart-item'}-${index}`
        }
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="basket-outline" size={54} color="#C4B7A6" />
            <Text style={styles.emptyTitle}>{t('checkout.emptyCart')}</Text>
            <Text style={styles.emptyText}>
              {t('cart.emptyText')}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('checkout.exploreRestaurants')}
              style={({ pressed }) => [
                styles.exploreButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleExplore}
            >
              <Text style={styles.exploreButtonText}>
                {t('checkout.exploreRestaurants')}
              </Text>
            </Pressable>
          </View>
        }
      />

      <View style={styles.footer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('checkout.items')}</Text>
          <Text style={styles.summaryValue}>{totalItems}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('checkout.subtotal')}</Text>
          <Text style={styles.summaryValue}>
            {formatPrice(subtotal, cartCurrency)}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('checkout.delivery')}</Text>
          <Text style={styles.summaryValue}>
            {delivery === null
              ? t('checkout.feeAtCheckout')
              : delivery === 0
                ? t('checkout.free')
                : formatPrice(delivery, cartCurrency)}
          </Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('checkout.total')}</Text>
          <Text style={styles.totalValue}>
            {safeTotal === null
              ? t('checkout.totalAtCheckout')
              : formatPrice(safeTotal, cartCurrency)}
          </Text>
        </View>

        {!isLoggedIn && safeCartItems.length > 0 && (
          <Text style={styles.footerHelperText}>
            {t('cart.loginHelperText')}
          </Text>
        )}

        {isLoggedIn && role !== 'client' && safeCartItems.length > 0 && (
          <Text style={styles.footerHelperTextDanger}>
            {t('cart.roleBlockedText')}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            !canCheckoutAsCustomer
              ? t('cart.checkoutBlockedLabel')
              : isLoggedIn
              ? t('cart.proceedToOrder')
              : t('cart.loginToOrder')
          }
          style={({ pressed }) => [
            styles.button,
            safeCartItems.length === 0 && styles.buttonDisabled,
            !canCheckoutAsCustomer && styles.buttonDisabled,
            pressed &&
              safeCartItems.length > 0 &&
              canCheckoutAsCustomer &&
              styles.buttonPressed,
          ]}
          onPress={handleCheckout}
          disabled={safeCartItems.length === 0 || !canCheckoutAsCustomer}
        >
          <Text style={styles.buttonText}>
            {!canCheckoutAsCustomer
              ? t('cart.checkoutBlockedButton')
              : isLoggedIn
              ? t('cart.orderButton')
              : t('cart.loginToOrder')}
          </Text>
        </Pressable>
      </View>
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
    paddingTop: 18,
  },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  headerSpacer: {
    width: 42,
  },

  clearButton: {
    minWidth: 52,
    alignItems: 'flex-end',
  },

  clearButtonText: {
    color: '#C8331A',
    fontWeight: '800',
    fontSize: 14,
  },

  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0D1C11',
  },

  restaurantBanner: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#E8F5ED',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D6EAD9',
  },

  restaurantBannerText: {
    marginLeft: 8,
    color: '#084424',
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },

  guestBanner: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#FFF3D8',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#F2E0A8',
  },

  guestBannerText: {
    marginLeft: 8,
    color: '#8A6500',
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },

  roleWarningBanner: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#FFF0F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#F1CCCC',
  },

  roleWarningText: {
    marginLeft: 8,
    color: '#8A2E2E',
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 240,
    flexGrow: 1,
  },

  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 14,
    borderRadius: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },

  itemImage: {
    width: 74,
    height: 74,
    borderRadius: 16,
    backgroundColor: '#F1ECE5',
    marginRight: 12,
  },

  itemInfo: {
    flex: 1,
    paddingRight: 12,
  },

  name: {
    fontWeight: '800',
    fontSize: 17,
    color: '#0D1C11',
    marginBottom: 6,
  },

  description: {
    fontSize: 13,
    color: '#777777',
    lineHeight: 19,
    marginBottom: 6,
  },

  price: {
    fontSize: 14,
    color: '#777777',
    fontWeight: '600',
  },

  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF4F2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  quantityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  quantityButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  quantityText: {
    minWidth: 34,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#0D1C11',
  },

  itemTotal: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0D1C11',
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  summaryLabel: {
    fontSize: 14,
    color: '#777777',
    fontWeight: '700',
  },

  summaryValue: {
    fontSize: 14,
    color: '#0D1C11',
    fontWeight: '800',
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 2,
  },

  totalLabel: {
    fontSize: 16,
    color: '#555555',
    fontWeight: '700',
  },

  totalValue: {
    fontSize: 22,
    color: '#0D1C11',
    fontWeight: '900',
  },

  footerHelperText: {
    color: '#8A6500',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    fontWeight: '700',
  },

  footerHelperTextDanger: {
    color: '#8A2E2E',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    fontWeight: '700',
  },

  button: {
    backgroundColor: '#EAB02F',
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  buttonText: {
    color: '#0D1C11',
    fontWeight: '900',
    fontSize: 16,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 70,
    paddingHorizontal: 20,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0D1C11',
    marginTop: 16,
    marginBottom: 8,
  },

  emptyText: {
    textAlign: 'center',
    color: '#777777',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },

  exploreButton: {
    backgroundColor: '#084424',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
  },

  exploreButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },

  buttonPressed: {
    opacity: 0.82,
  },
});
