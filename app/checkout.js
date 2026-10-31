import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Image,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../components/FadeInView';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { createOrder } from '../services/orderService';
import { useTranslation } from 'react-i18next';

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

const normalizeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

// Montants proposes pour le don "Afro Impact" - le client choisit,
// rien n'est ajoute par defaut (0 = pas de don).
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

  if (safeCurrency === 'USD') return `$${amount.toFixed(2)}`;
  if (safeCurrency === 'GBP') return `£${amount.toFixed(2)}`;
  if (safeCurrency === 'CHF') return `CHF ${amount.toFixed(2)}`;
  if (safeCurrency === 'XOF' || safeCurrency === 'XAF') {
    return `${amount.toFixed(0)} ${safeCurrency}`;
  }
  if (safeCurrency === 'CAD') return `${amount.toFixed(2)} $CA`;

  return `${amount.toFixed(2)} €`;
};

const getFallbackImage = () => {
  return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200&auto=format&fit=crop';
};

const getSafeItemId = (item) => {
  const menuItem = item?.menuItem;
  const nestedMenuItemId =
    menuItem && typeof menuItem === 'object'
      ? menuItem?._id || menuItem?.id
      : null;

  const candidates = [
    nestedMenuItemId,
    item?._id,
    item?.id,
    typeof menuItem === 'string' || typeof menuItem === 'number'
      ? menuItem
      : null,
    item?.menuItemId,
    item?.productId,
  ];

  return (
    candidates.find(
      (value) =>
        (typeof value === 'string' || typeof value === 'number') &&
        String(value).trim().length > 0
    ) ?? null
  );
};

const buildOrderItemsPayload = (cartItems = []) => {
  return normalizeArray(cartItems)
    .map((item) => {
      const quantity = Math.max(0, normalizeNumber(item?.quantity, 0));
      const price = Math.max(0, normalizeNumber(item?.price, 0));
      const menuItemId = getSafeItemId(item);

      if (!menuItemId || quantity <= 0) {
        return null;
      }

      return {
        menuItem: menuItemId,
        name: normalizeText(item?.name || item?.nom || item?.title, 'Article'),
        quantity,
        price,
        image: normalizeText(item?.image),
      };
    })
    .filter(Boolean);
};

const getOrderIdFromResponse = (response) => {
  return (
    response?.order?._id ||
    response?.order?.id ||
    response?._id ||
    response?.id ||
    null
  );
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function CheckoutScreen() {
  const { t } = useTranslation();
  const cart = useCart() || {};
  const auth = useAuth() || {};

  const cartItems = cart.cartItems;
  const totals = cart.totals || {};
  const getTotalPrice = cart.getTotalPrice;
  const getRestaurantName = cart.getRestaurantName;
  const getRestaurantId = cart.getRestaurantId;

  const user = auth.user ?? null;
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const role = normalizeRole(auth.role || user?.role);

  const idempotencyRequestRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const isLoggedIn = Boolean(isAuthenticated && token && user?._id);
  const isClient = role === 'client';

  const safeCartItems = useMemo(() => {
    return normalizeArray(cartItems)
      .map((item) => ({
        ...item,
        _safeId: getSafeItemId(item),
        name: normalizeText(item?.name || item?.nom || item?.title, 'Plat'),
        image: normalizeText(item?.image, ''),
        price: Math.max(0, normalizeNumber(item?.price, 0)),
        quantity: Math.max(0, normalizeNumber(item?.quantity, 0)),
        currency: normalizeText(item?.currency, 'EUR'),
        restaurantId:
          item?.restaurantId ||
          item?.restaurant?._id ||
          item?.restaurant ||
          item?.storeId ||
          null,
        restaurantName: normalizeText(
          item?.restaurantName || item?.restaurant?.name,
          ''
        ),
      }))
      .filter((item) => item?._safeId && item.quantity > 0);
  }, [cartItems]);

  const currency = useMemo(() => {
    return normalizeText(safeCartItems?.[0]?.currency, 'EUR');
  }, [safeCartItems]);

  const restaurantId = useMemo(() => {
    if (typeof getRestaurantId === 'function') {
      return getRestaurantId();
    }

    return safeCartItems?.[0]?.restaurantId || null;
  }, [getRestaurantId, safeCartItems]);

  const restaurantName = useMemo(() => {
    if (typeof getRestaurantName === 'function') {
      return normalizeText(getRestaurantName(), 'Restaurant');
    }

    return normalizeText(safeCartItems?.[0]?.restaurantName, 'Restaurant');
  }, [getRestaurantName, safeCartItems]);

  const deliveryAddress = useMemo(() => {
    return normalizeText(
      user?.address ||
        user?.adresse ||
        user?.deliveryAddress ||
        user?.profile?.address,
      ''
    );
  }, [user]);

  const normalizedItems = useMemo(() => {
    return buildOrderItemsPayload(safeCartItems);
  }, [safeCartItems]);

  const subtotal = useMemo(() => {
    if (Number.isFinite(Number(totals?.subtotal))) {
      return Math.max(0, normalizeNumber(totals.subtotal, 0));
    }

    return safeCartItems.reduce((sum, item) => {
      return (
        sum +
        Math.max(0, normalizeNumber(item?.price, 0)) *
          Math.max(0, normalizeNumber(item?.quantity, 0))
      );
    }, 0);
  }, [safeCartItems, totals]);

  const delivery = useMemo(() => {
    return Math.max(
      0,
      normalizeNumber(totals?.delivery, safeCartItems.length ? 2.99 : 0)
    );
  }, [totals, safeCartItems.length]);

  const totalPrice = useMemo(() => {
    return Number((subtotal + delivery).toFixed(2));
  }, [subtotal, delivery]);

  const totalItems = useMemo(() => {
    return safeCartItems.reduce((sum, item) => {
      return sum + Math.max(0, normalizeNumber(item?.quantity, 0));
    }, 0);
  }, [safeCartItems]);

  const hasValidAddress = useMemo(() => {
    return normalizeText(deliveryAddress).length >= 5;
  }, [deliveryAddress]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/cart');
  }, []);

  const handleGoToLogin = useCallback(() => {
    router.push('/auth/role');
  }, []);

  const handleGoToExplore = useCallback(() => {
    router.replace('/(tabs)/explore');
  }, []);

  const handleGoToAddressMap = useCallback(() => {
    router.push('/map');
  }, []);

  const handleOrder = useCallback(async () => {
    if (!isLoggedIn) {
      Alert.alert(
        t('checkout.alertLoginRequiredTitle'),
        t('checkout.alertLoginRequiredBody')
      );
      router.push('/auth/role');
      return;
    }

    if (!isClient) {
      Alert.alert(
        t('checkout.alertUnauthorizedTitle'),
        t('checkout.alertUnauthorizedBody')
      );
      return;
    }

    if (!restaurantId) {
      Alert.alert(t('checkout.error'), t('checkout.alertNoRestaurant'));
      return;
    }

    if (normalizedItems.length === 0) {
      Alert.alert(t('checkout.alertEmptyCartTitle'), t('checkout.alertEmptyCartBody'));
      return;
    }

    if (!hasValidAddress) {
      Alert.alert(
        t('checkout.alertMissingAddressTitle'),
        t('checkout.alertMissingAddressBody')
      );
      return;
    }

    try {
      setLoading(true);

      const isValidMongoId = (id) => /^[a-f\d]{24}$/i.test(String(id || ''));

      const hasFallbackItems = normalizedItems.some(
        (item) => !isValidMongoId(item?.menuItem)
      );

      if (hasFallbackItems) {
        Alert.alert(
          t('checkout.alertDemoMenuTitle'),
          t('checkout.alertDemoMenuBody'),
          [{ text: 'OK' }]
        );
        return;
      }

      // Send item IDs and quantities only. The API reloads menu records and
      // calculates authoritative prices, delivery fees, currency and totals.
      const payload = {
        restaurant: restaurantId,
        items: normalizedItems.map((item) => ({
          menuItem: item.menuItem,
          quantity: item.quantity,
        })),
        deliveryAddress: normalizeText(deliveryAddress),
        notes: '',
      };

      const requestSignature = JSON.stringify(payload);
      if (
        !idempotencyRequestRef.current ||
        idempotencyRequestRef.current.signature !== requestSignature
      ) {
        idempotencyRequestRef.current = {
          signature: requestSignature,
          key: `afroeat_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`,
        };
      }

      // Keep the same key while retrying the exact same checkout after a timeout.
      const response = await createOrder(
        payload,
        token,
        idempotencyRequestRef.current.key
      );
      const createdOrder = response?.order || response?.data?.order || null;
      const orderId = getOrderIdFromResponse(response);
      const serverAmount = Number(createdOrder?.totalPrice);
      const serverCurrency = normalizeText(createdOrder?.currency, currency).toUpperCase();

      if (!orderId || !Number.isFinite(serverAmount) || serverAmount < 0 || !serverCurrency) {
        throw new Error('Le serveur n’a pas retourné le montant confirmé de la commande.');
      }

      // Do not clear the cart here: order creation is not payment confirmation.
      // Keep it available if the payment is declined or the payment API fails.

      Alert.alert(t('checkout.alertOrderCreatedTitle'), t('checkout.alertOrderCreatedBody'));

      router.replace({
        pathname: '/payment',
        params: {
          orderId,
          amount: String(serverAmount),
          currency: serverCurrency,
        },
      });
      return;
    } catch (error) {
      const msg = error?.message || '';
      const status = error?.status;
      let title = t('checkout.alertOrderFailedTitle');
      let body = msg || t('checkout.alertOrderFailedBody');

      if (status === 400) {
        title = t('checkout.alertInvalidDataTitle');
        body = msg || t('checkout.alertInvalidDataBody');
      } else if (status === 401 || status === 403) {
        title = t('checkout.alertSessionExpiredTitle');
        body = t('checkout.alertSessionExpiredBody');
      } else if (
        msg.toLowerCase().includes('réseau') ||
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('serveur') ||
        msg.toLowerCase().includes('contacter')
      ) {
        title = t('checkout.alertConnectionFailedTitle');
        body = t('checkout.alertConnectionFailedBody');
      }

      Alert.alert(title, body);
    } finally {
      setLoading(false);
    }
  }, [
    currency,
    delivery,
    deliveryAddress,
    hasValidAddress,
    isClient,
    isLoggedIn,
    normalizedItems,
    restaurantId,
    token,
    totalPrice,
    user,
  ]);

  if (!isLoggedIn) {
    return (
      <FadeInView style={styles.centeredContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

        <View style={styles.guestHeroCard}>
          <View style={styles.guestBadge}>
            <Ionicons name="sparkles-outline" size={16} color="#8A6500" />
            <Text style={styles.guestBadgeText}>{t('checkout.guestPremiumTitle')}</Text>
          </View>

          <Ionicons name="lock-closed-outline" size={54} color="#C4B7A6" />

          <Text style={styles.emptyTitle}>{t('checkout.loginRequired')}</Text>

          <Text style={styles.emptyText}>
            {t('checkout.guestPremiumText')}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('checkout.login')}
            style={styles.primaryButton}
            onPress={handleGoToLogin}
          >
            <Text style={styles.primaryButtonText}>{t('checkout.login')}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('checkout.backToCart')}
            style={styles.secondaryButton}
            onPress={handleBack}
          >
            <Text style={styles.secondaryButtonText}>{t('checkout.backToCart')}</Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  if (!isClient) {
    return (
      <FadeInView style={styles.centeredContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

        <View style={styles.guestHeroCard}>
          <Ionicons name="shield-outline" size={54} color="#C65D2E" />

          <Text style={styles.emptyTitle}>{t('checkout.clientOnly')}</Text>

          <Text style={styles.emptyText}>
            {t('checkout.clientOnlyText')}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('checkout.backToCart')}
            style={styles.primaryButton}
            onPress={handleBack}
          >
            <Text style={styles.primaryButtonText}>{t('checkout.backToCart')}</Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('checkout.back')}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleBack}
        >
          <Ionicons name="arrow-back" size={22} color="#1E1E1E" />
        </Pressable>

        <Text style={styles.title}>{t('checkout.summary')}</Text>

        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={safeCartItems}
        keyExtractor={(item, index) =>
          `${item?._safeId || item?._id || item?.menuItem || item?.id || 'item'}-${index}`
        }
        renderItem={({ item }) => {
          const quantity = Math.max(0, normalizeNumber(item?.quantity, 0));
          const price = Math.max(0, normalizeNumber(item?.price, 0));
          const lineTotal = quantity * price;
          const imageUri = normalizeText(item?.image, getFallbackImage());

          return (
            <View style={styles.item}>
              <Image source={{ uri: imageUri }} style={styles.itemImage} />

              <View style={styles.itemLeft}>
                <Text style={styles.name} numberOfLines={1}>
                  {item?.name || item?.nom || 'Plat'}
                </Text>
                <Text style={styles.details}>
                  {quantity} x {formatPrice(price, currency)}
                </Text>
              </View>

              <Text style={styles.lineTotal}>
                {formatPrice(lineTotal, currency)}
              </Text>
            </View>
          );
        }}
        ListHeaderComponent={
          <View>
            {!!restaurantName && safeCartItems.length > 0 && (
              <View style={styles.infoCard}>
                <Ionicons name="restaurant-outline" size={18} color="#1F6F43" />
                <Text style={styles.infoText} numberOfLines={1}>
                  {t('checkout.orderingAt', { restaurant: restaurantName })}
                </Text>
              </View>
            )}

            <View style={styles.addressCard}>
              <View style={styles.addressHeader}>
                <Ionicons name="location-outline" size={18} color="#D96C2D" />
                <Text style={styles.addressTitle}>{t('checkout.deliveryAddress')}</Text>
              </View>

              <Text
                style={[
                  styles.addressText,
                  !hasValidAddress && styles.addressTextWarning,
                ]}
              >
                {hasValidAddress
                  ? deliveryAddress
                  : t('checkout.addressPlaceholder')}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('checkout.editAddress')}
                style={styles.addressAction}
                onPress={handleGoToAddressMap}
              >
                <Text style={styles.addressActionText}>{t('checkout.editAddress')}</Text>
                <Ionicons name="chevron-forward" size={16} color="#1F6F43" />
              </Pressable>
            </View>

            <View style={styles.paymentPreviewCard}>
              <View style={styles.paymentPreviewHeader}>
                <Ionicons name="card-outline" size={18} color="#2457C5" />
                <Text style={styles.paymentPreviewTitle}>{t('checkout.securePayment')}</Text>
              </View>
              <Text style={styles.paymentPreviewText}>
                {t('checkout.paymentPreviewText')}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="basket-outline" size={52} color="#C4B7A6" />
            <Text style={styles.emptyTitle}>{t('checkout.emptyCart')}</Text>
            <Text style={styles.emptyText}>
              {t('checkout.emptyCartText')}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('checkout.exploreRestaurants')}
              style={styles.primaryButton}
              onPress={handleGoToExplore}
            >
              <Text style={styles.primaryButtonText}>{t('checkout.exploreRestaurants')}</Text>
            </Pressable>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.footer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('checkout.items')}</Text>
          <Text style={styles.summaryValue}>{totalItems}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('checkout.subtotal')}</Text>
          <Text style={styles.summaryValue}>{formatPrice(subtotal, currency)}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('checkout.delivery')}</Text>
          <Text style={styles.summaryValue}>
            {delivery === 0 ? t('checkout.free') : formatPrice(delivery, currency)}
          </Text>
        </View>


        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('checkout.total')}</Text>
          <Text style={styles.totalValue}>{formatPrice(totalPrice, currency)}</Text>
        </View>

        {!hasValidAddress && safeCartItems.length > 0 && (
          <Pressable
            onPress={() => router.push('/profile/info')}
            style={styles.addressWarningBlock}
          >
            <Ionicons name="warning-outline" size={16} color="#B04A00" />
            <Text style={styles.footerHelperText}>
              {t('checkout.addressMissing')}{' '}
              <Text style={styles.footerHelperLink}>
                {t('checkout.addToProfile')}
              </Text>
            </Text>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('checkout.placeOrder')}
          style={({ pressed }) => [
            styles.button,
            (loading || safeCartItems.length === 0 || !hasValidAddress) &&
              styles.buttonDisabled,
            pressed &&
              !loading &&
              safeCartItems.length > 0 &&
              hasValidAddress &&
              styles.buttonPressed,
          ]}
          onPress={handleOrder}
          disabled={loading || safeCartItems.length === 0 || !hasValidAddress}
        >
          {loading ? (
            <ActivityIndicator color="#1E1E1E" />
          ) : (
            <Text style={styles.buttonText}>{t('checkout.placeOrder')}</Text>
          )}
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
    backgroundColor: '#FFF8F0',
    paddingTop: 18,
  },

  centeredContainer: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  guestHeroCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  guestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3D8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 18,
  },

  guestBadgeText: {
    marginLeft: 6,
    color: '#8A6500',
    fontSize: 12,
    fontWeight: '800',
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

  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1E1E1E',
  },

  infoCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#E8F5ED',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D6EAD9',
  },

  infoText: {
    marginLeft: 8,
    color: '#1F6F43',
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
  },

  addressCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  addressTitle: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '800',
    color: '#1E1E1E',
  },

  addressText: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 21,
  },

  addressTextWarning: {
    color: '#B63B3B',
  },

  addressAction: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },

  addressActionText: {
    color: '#1F6F43',
    fontSize: 14,
    fontWeight: '800',
    marginRight: 4,
  },

  paymentPreviewCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#EEF4FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DBE7FF',
  },

  paymentPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  paymentPreviewTitle: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '800',
    color: '#2457C5',
  },

  paymentPreviewText: {
    color: '#4F5F88',
    fontSize: 14,
    lineHeight: 21,
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 200,
    flexGrow: 1,
  },

  item: {
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  itemImage: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: '#F1ECE5',
    marginRight: 12,
  },

  itemLeft: {
    flex: 1,
    paddingRight: 12,
  },

  name: {
    fontWeight: '800',
    marginBottom: 4,
    color: '#1E1E1E',
    fontSize: 15,
  },

  details: {
    color: '#666666',
    fontSize: 13,
  },

  lineTotal: {
    fontWeight: '900',
    color: '#1E1E1E',
    fontSize: 15,
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
    color: '#111111',
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
    fontWeight: '900',
    color: '#1E1E1E',
  },

  donationCard: {
    backgroundColor: '#F1F8F3',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9EEDF',
    padding: 12,
    marginBottom: 12,
  },

  donationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },

  donationTitle: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '800',
    color: '#1F6F43',
  },

  donationSubtitle: {
    color: '#4C6B57',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },

  donationChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  donationChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBE4D3',
    marginRight: 8,
    marginBottom: 6,
  },

  donationChipActive: {
    backgroundColor: '#1F6F43',
    borderColor: '#1F6F43',
  },

  donationChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F6F43',
  },

  donationChipTextActive: {
    color: '#FFFFFF',
  },

  footerHelperText: {
    color: '#8A6500',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    fontWeight: '700',
    flex: 1,
  },

  footerHelperLink: {
    color: '#B04A00',
    textDecorationLine: 'underline',
    fontWeight: '800',
  },

  addressWarningBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FFF0E8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F5D5C0',
  },

  button: {
    backgroundColor: '#D4A017',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    fontWeight: '900',
    color: '#1E1E1E',
    fontSize: 16,
  },

  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    marginTop: 40,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E1E1E',
    marginTop: 14,
    marginBottom: 8,
    textAlign: 'center',
  },

  emptyText: {
    color: '#777777',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },

  primaryButton: {
    backgroundColor: '#D4A017',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },

  primaryButtonText: {
    color: '#1E1E1E',
    fontWeight: '900',
    fontSize: 14,
  },

  secondaryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  secondaryButtonText: {
    color: '#1F6F43',
    fontWeight: '800',
    fontSize: 14,
  },

  buttonPressed: {
    opacity: 0.82,
  },
});