
import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import OwnImage from '../components/OwnImage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from '../components/FadeInView';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { createOrder, getOrderQuote } from '../services/orderService';
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

const EMPTY_TOTALS = Object.freeze({});

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
    item?.menuItem ||
    item?._id ||
    item?.id ||
    item?.menuItemId ||
    item?.productId ||
    null
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
    response?.data?.order?._id ||
    response?.data?.order?.id ||
    response?.data?._id ||
    response?.data?.id ||
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
  const totals = cart.totals || EMPTY_TOTALS;
  const getRestaurantName = cart.getRestaurantName;
  const getRestaurantId = cart.getRestaurantId;

  const user = auth.user ?? null;
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const role = normalizeRole(auth.role || user?.role);

  const [loading, setLoading] = useState(false);
  const orderInProgressRef = useRef(false);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteRetryVersion, setQuoteRetryVersion] = useState(0);

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

  const localSubtotal = useMemo(() => {
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

  const subtotal = Number.isFinite(Number(quote?.itemsSubtotal))
    ? Number(quote.itemsSubtotal)
    : localSubtotal;

  const delivery = Number.isFinite(Number(quote?.deliveryFee))
    ? Number(quote.deliveryFee)
    : null;

  const totalPrice = Number.isFinite(Number(quote?.totalPrice))
    ? Number(quote.totalPrice)
    : null;

  const quoteCurrency = normalizeText(quote?.currency, currency);

  const totalItems = useMemo(() => {
    return safeCartItems.reduce((sum, item) => {
      return sum + Math.max(0, normalizeNumber(item?.quantity, 0));
    }, 0);
  }, [safeCartItems]);

  const hasValidAddress = useMemo(() => {
    return normalizeText(deliveryAddress).length >= 5;
  }, [deliveryAddress]);

  const handleRetryQuote = useCallback(() => {
    if (quoteLoading) return;
    setQuote(null);
    setQuoteError('');
    setQuoteRetryVersion((current) => current + 1);
  }, [quoteLoading]);

  useEffect(() => {
    let isActive = true;
    const timer = setTimeout(() => {
      if (
        !isLoggedIn ||
        !isClient ||
        !restaurantId ||
        normalizedItems.length === 0
      ) {
        setQuote(null);
        setQuoteLoading(false);
        setQuoteError('');
        return;
      }

      setQuote(null);
      setQuoteError('');
      setQuoteLoading(true);

      getOrderQuote(
        {
          restaurant: restaurantId,
          items: normalizedItems.map(({ menuItem, quantity }) => ({
            menuItem,
            quantity,
          })),
        },
        token
      )
        .then((result) => {
          if (!result?.quote) {
            throw new Error(t('checkout.quoteUnavailable'));
          }

          if (isActive) setQuote(result.quote);
        })
        .catch((error) => {
          if (isActive) {
            setQuoteError(error?.message || t('checkout.quoteUnavailable'));
          }
        })
        .finally(() => {
          if (isActive) setQuoteLoading(false);
        });
    }, 0);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [
    isClient,
    isLoggedIn,
    normalizedItems,
    quoteRetryVersion,
    restaurantId,
    t,
    token,
  ]);

  const pricedItems = useMemo(
    () =>
      Array.isArray(quote?.items) && quote.items.length
        ? quote.items
        : safeCartItems,
    [quote, safeCartItems]
  );

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

  const handleGoToProfile = useCallback(() => {
    router.push('/(tabs)/profile');
  }, []);

  /**
   * =========================================================
   * CREATE ORDER AND OPEN PAYMENT
   * =========================================================
   *
   * Important:
   * - The cart is not cleared here.
   * - The order ID is required before navigating to payment.
   * - Payment.js is responsible for handling payment completion.
   */

  const handleOrder = useCallback(async () => {
    // The state update is asynchronous; a ref blocks a second tap immediately.
    if (orderInProgressRef.current) return;

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
      Alert.alert(
        t('checkout.alertEmptyCartTitle'),
        t('checkout.alertEmptyCartBody')
      );
      return;
    }

    if (!quote || quoteLoading) {
      Alert.alert(
        t('checkout.error'),
        quoteError || t('checkout.quoteUnavailable')
      );
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
      orderInProgressRef.current = true;
      setLoading(true);

      const isValidMongoId = (id) =>
        /^[a-f\d]{24}$/i.test(String(id || ''));

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

      const payload = {
        restaurant: restaurantId,
        items: normalizedItems,
        quotedTotal: quote.totalPrice,
        quotedCurrency: quote.currency,
        deliveryAddress: normalizeText(deliveryAddress),
        deliveryAddressDetails: {
          address: normalizeText(deliveryAddress),
          fullAddress: normalizeText(deliveryAddress),
        },
        notes: '',
      };

      const response = await createOrder(payload, token);
      const createdOrder = response?.order || response?.data?.order || response?.data || response;
      const orderId = getOrderIdFromResponse(response);

      if (!orderId) {
        throw new Error(
          'La commande a été créée, mais son identifiant est introuvable. Vérifie tes commandes avant de réessayer.'
        );
      }

      const serverAmount = Number(
        createdOrder?.totalPrice ??
          createdOrder?.financials?.totalPrice ??
          createdOrder?.total ??
          quote?.totalPrice
      );

      if (!Number.isFinite(serverAmount) || serverAmount < 0) {
        throw new Error(t('checkout.quoteUnavailable'));
      }

      const paymentAmount = serverAmount;

      const paymentCurrency = normalizeText(
        createdOrder?.currency ||
          createdOrder?.financials?.currency ||
          createdOrder?.currencyCode,
        quoteCurrency
      ).toUpperCase();

      router.replace({
        pathname: '/payment',
        params: {
          orderId: String(orderId),
          amount: String(paymentAmount),
          currency: paymentCurrency,
        },
      });

      return;
    } catch (error) {
      if (error?.data?.code === 'QUOTE_CHANGED') {
        try {
          const refreshedQuote = await getOrderQuote(
            {
              restaurant: restaurantId,
              items: normalizedItems.map(({ menuItem, quantity }) => ({
                menuItem,
                quantity,
              })),
            },
            token
          );

          setQuote(refreshedQuote?.quote || null);

          Alert.alert(
            t('checkout.quoteChangedTitle'),
            t('checkout.quoteChangedBody')
          );

          return;
        } catch {
          setQuote(null);
          setQuoteError(t('checkout.quoteUnavailable'));
        }
      }

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
      orderInProgressRef.current = false;
      setLoading(false);
    }
  }, [
    deliveryAddress,
    hasValidAddress,
    isClient,
    isLoggedIn,
    normalizedItems,
    quote,
    quoteCurrency,
    quoteError,
    quoteLoading,
    restaurantId,
    t,
    token,
  ]);

  if (!isLoggedIn) {
    return (
      <FadeInView style={styles.centeredContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

        <View style={styles.guestHeroCard}>
          <View style={styles.guestBadge}>
            <Ionicons
              name="sparkles-outline"
              size={16}
              color="#8A6500"
            />
            <Text style={styles.guestBadgeText}>
              {t('checkout.guestPremiumTitle')}
            </Text>
          </View>

          <Ionicons
            name="lock-closed-outline"
            size={54}
            color="#C4B7A6"
          />

          <Text style={styles.emptyTitle}>
            {t('checkout.loginRequired')}
          </Text>

          <Text style={styles.emptyText}>
            {t('checkout.guestPremiumText')}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('checkout.login')}
            style={styles.primaryButton}
            onPress={handleGoToLogin}
          >
            <Text style={styles.primaryButtonText}>
              {t('checkout.login')}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('checkout.backToCart')}
            style={styles.secondaryButton}
            onPress={handleBack}
          >
            <Text style={styles.secondaryButtonText}>
              {t('checkout.backToCart')}
            </Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  if (!isClient) {
    return (
      <FadeInView style={styles.centeredContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

        <View style={styles.guestHeroCard}>
          <Ionicons
            name="shield-outline"
            size={54}
            color="#C65D2E"
          />

          <Text style={styles.emptyTitle}>
            {t('checkout.clientOnly')}
          </Text>

          <Text style={styles.emptyText}>
            {t('checkout.clientOnlyText')}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('checkout.backToCart')}
            style={styles.primaryButton}
            onPress={handleBack}
          >
            <Text style={styles.primaryButtonText}>
              {t('checkout.backToCart')}
            </Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  }

  return (
    <FadeInView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF6EC" />

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
          <Ionicons name="arrow-back" size={22} color="#0D1C11" />
        </Pressable>

        <Text style={styles.title}>{t('checkout.summary')}</Text>

        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={pricedItems}
        keyExtractor={(item, index) =>
          `${item?._safeId || item?._id || item?.menuItem || item?.id || 'item'}-${index}`
        }
        renderItem={({ item }) => {
          const quantity = Math.max(
            0,
            normalizeNumber(item?.quantity, 0)
          );

          const price = Math.max(0, normalizeNumber(item?.price, 0));
          const lineTotal = quantity * price;

          return (
            <View style={styles.item}>
              <OwnImage uri={item?.image} style={styles.itemImage} />

              <View style={styles.itemLeft}>
                <Text style={styles.name} numberOfLines={1}>
                  {item?.name || item?.nom || 'Plat'}
                </Text>

                <Text style={styles.details}>
                  {quantity} x {formatPrice(price, quoteCurrency)}
                </Text>
              </View>

              <Text style={styles.lineTotal}>
                {formatPrice(lineTotal, quoteCurrency)}
              </Text>
            </View>
          );
        }}
        ListHeaderComponent={
          <View>
            {!!restaurantName && safeCartItems.length > 0 && (
              <View style={styles.infoCard}>
                <Ionicons
                  name="restaurant-outline"
                  size={18}
                  color="#084424"
                />

                <Text style={styles.infoText} numberOfLines={1}>
                  {t('checkout.orderingAt', {
                    restaurant: restaurantName,
                  })}
                </Text>
              </View>
            )}

            <View style={styles.addressCard}>
              <View style={styles.addressHeader}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color="#C8331A"
                />

                <Text style={styles.addressTitle}>
                  {t('checkout.deliveryAddress')}
                </Text>
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
                accessibilityLabel={t('checkout.viewProfile')}
                style={styles.addressAction}
                onPress={handleGoToProfile}
              >
                <Text style={styles.addressActionText}>
                  {t('checkout.viewProfile')}
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color="#084424"
                />
              </Pressable>
            </View>

            <View style={styles.paymentPreviewCard}>
              <View style={styles.paymentPreviewHeader}>
                <Ionicons
                  name="card-outline"
                  size={18}
                  color="#2457C5"
                />

                <Text style={styles.paymentPreviewTitle}>
                  {t('checkout.securePayment')}
                </Text>
              </View>

              <Text style={styles.paymentPreviewText}>
                {quoteLoading
                  ? t('checkout.quoteLoading')
                  : quote
                    ? t('checkout.paymentPreviewText')
                    : t('checkout.quoteUnavailable')}
              </Text>

              {!!quoteError && (
                <View style={styles.quoteErrorActions}>
                  <Text style={styles.quoteError}>{quoteError}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('checkout.retryQuote')}
                    style={({ pressed }) => [
                      styles.retryQuoteButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={handleRetryQuote}
                    disabled={quoteLoading}
                  >
                    <Ionicons name="refresh-outline" size={15} color="#084424" />
                    <Text style={styles.retryQuoteText}>
                      {t('checkout.retryQuote')}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons
              name="basket-outline"
              size={52}
              color="#C4B7A6"
            />

            <Text style={styles.emptyTitle}>
              {t('checkout.emptyCart')}
            </Text>

            <Text style={styles.emptyText}>
              {t('checkout.emptyCartText')}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('checkout.exploreRestaurants')}
              style={styles.primaryButton}
              onPress={handleGoToExplore}
            >
              <Text style={styles.primaryButtonText}>
                {t('checkout.exploreRestaurants')}
              </Text>
            </Pressable>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.footer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {t('checkout.items')}
          </Text>
          <Text style={styles.summaryValue}>{totalItems}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {t('checkout.subtotal')}
          </Text>
          <Text style={styles.summaryValue}>
            {formatPrice(subtotal, quoteCurrency)}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {t('checkout.delivery')}
          </Text>

          <Text style={styles.summaryValue}>
            {delivery === null
              ? quoteLoading
                ? t('checkout.quoteLoading')
                : t('checkout.feeAtCheckout')
              : delivery === 0
                ? t('checkout.free')
                : formatPrice(delivery, quoteCurrency)}
          </Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            {t('checkout.total')}
          </Text>

          <Text style={styles.totalValue}>
            {quoteLoading
              ? t('checkout.quoteLoading')
              : totalPrice === null
                ? quoteError
                  ? t('checkout.quoteUnavailable')
                  : t('checkout.totalAtCheckout')
                : formatPrice(totalPrice, quoteCurrency)}
          </Text>
        </View>

        {!hasValidAddress && safeCartItems.length > 0 && (
          <Pressable
            onPress={() => router.push('/profile/info')}
            style={styles.addressWarningBlock}
          >
            <Ionicons
              name="warning-outline"
              size={16}
              color="#B04A00"
            />

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
            (
              loading ||
              quoteLoading ||
              !quote ||
              safeCartItems.length === 0 ||
              !hasValidAddress
            ) && styles.buttonDisabled,
            pressed &&
              !loading &&
              !quoteLoading &&
              Boolean(quote) &&
              safeCartItems.length > 0 &&
              hasValidAddress &&
              styles.buttonPressed,
          ]}
          onPress={handleOrder}
          disabled={
            loading ||
            quoteLoading ||
            !quote ||
            safeCartItems.length === 0 ||
            !hasValidAddress
          }
        >
          {loading ? (
            <ActivityIndicator color="#0D1C11" />
          ) : (
            <Text style={styles.buttonText}>
              {t('checkout.placeOrder')}
            </Text>
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
    backgroundColor: '#FBF6EC',
    paddingTop: 18,
  },

  centeredContainer: {
    flex: 1,
    backgroundColor: '#FBF6EC',
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
    color: '#0D1C11',
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
    color: '#084424',
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
    color: '#0D1C11',
  },

  addressText: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 21,
  },

  addressTextWarning: {
    color: '#C8331A',
  },

  addressAction: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },

  addressActionText: {
    color: '#084424',
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

  quoteError: {
    color: '#9B342E',
    fontSize: 12,
    lineHeight: 17,
  },

  quoteErrorActions: {
    marginTop: 8,
    alignItems: 'flex-start',
  },

  retryQuoteButton: {
    marginTop: 8,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6EAD9',
  },

  retryQuoteText: {
    marginLeft: 6,
    color: '#084424',
    fontSize: 12,
    fontWeight: '800',
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
    color: '#0D1C11',
    fontSize: 15,
  },

  details: {
    color: '#666666',
    fontSize: 13,
  },

  lineTotal: {
    fontWeight: '900',
    color: '#0D1C11',
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
    fontWeight: '900',
    color: '#0D1C11',
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
    color: '#084424',
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
    backgroundColor: '#084424',
    borderColor: '#084424',
  },

  donationChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#084424',
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
    backgroundColor: '#EAB02F',
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
    color: '#0D1C11',
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
    color: '#0D1C11',
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
    backgroundColor: '#EAB02F',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },

  primaryButtonText: {
    color: '#0D1C11',
    fontWeight: '900',
    fontSize: 14,
  },

  secondaryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  secondaryButtonText: {
    color: '#084424',
    fontWeight: '800',
    fontSize: 14,
  },

  buttonPressed: {
    opacity: 0.82,
  },
});
