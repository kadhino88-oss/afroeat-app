import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { BrandFonts } from '../constants/brand';
import { MAX_CONTENT_WIDTH } from '../hooks/use-grid-columns';

/** Pages sans barre (page d'accueil du site et écrans de connexion / inscription). */
export const isNavHidden = (pathname) =>
  pathname === '/' || pathname.startsWith('/auth');

/** Pages principales : pas de bouton « retour ». */
const ROOT_PATHS = ['/', '/explore', '/orders', '/profile', '/index', '/restaurant/RestaurantDashboard', '/livraison', '/admin'];

export const isRootPath = (pathname) => ROOT_PATHS.includes(pathname);

const LINKS = [
  { key: 'home', href: '/(tabs)', match: (p) => p === '/' || p === '/index', icon: 'home-outline' },
  { key: 'explore', href: '/(tabs)/explore', match: (p) => p.startsWith('/explore'), icon: 'compass-outline' },
  { key: 'orders', href: '/(tabs)/orders', match: (p) => p.startsWith('/orders') || p.startsWith('/order'), icon: 'receipt-outline' },
  { key: 'profile', href: '/(tabs)/profile', match: (p) => p.startsWith('/profile'), icon: 'person-outline' },
];

const norm = (role) => String(role || '').trim().toLowerCase();

/** Liens et page d'accueil selon le rôle : un partenaire ne voit pas le menu du client. */
const LINKS_BY_ROLE = {
  restaurant: {
    home: '/restaurant/RestaurantDashboard',
    links: [
      { key: 'dashboard', href: '/restaurant/RestaurantDashboard', match: (p) => p === '/restaurant/RestaurantDashboard', icon: 'speedometer-outline' },
      { key: 'orders', href: '/restaurant/restaurant-orders', match: (p) => p.startsWith('/restaurant/restaurant-orders'), icon: 'receipt-outline' },
      { key: 'menu', href: '/restaurant/MenuScreen', match: (p) => p.startsWith('/restaurant/MenuScreen') || p.includes('MenuItem'), icon: 'restaurant-outline' },
      { key: 'profile', href: '/restaurant/restaurant-profile', match: (p) => p.startsWith('/restaurant/restaurant-profile') || p.startsWith('/restaurant/restaurant-settings'), icon: 'person-outline' },
    ],
  },
  livreur: {
    home: '/livraison',
    links: [
      { key: 'missions', href: '/livraison', match: (p) => p === '/livraison' || p.startsWith('/livraison/orders'), icon: 'bicycle-outline' },
      { key: 'history', href: '/livraison/history', match: (p) => p.startsWith('/livraison/history'), icon: 'time-outline' },
      { key: 'profile', href: '/livraison/profile', match: (p) => p.startsWith('/livraison/profile'), icon: 'person-outline' },
    ],
  },
  admin: {
    home: '/admin',
    links: [
      { key: 'dashboard', href: '/admin', match: (p) => p === '/admin', icon: 'speedometer-outline' },
      { key: 'orders', href: '/admin/orders', match: (p) => p.startsWith('/admin/orders'), icon: 'receipt-outline' },
      { key: 'partners', href: '/admin/partner-applications', match: (p) => p.startsWith('/admin/partner-applications'), icon: 'people-outline' },
    ],
  },
};
LINKS_BY_ROLE.driver = LINKS_BY_ROLE.livreur;
LINKS_BY_ROLE.delivery = LINKS_BY_ROLE.livreur;

export default function WebNavBar() {
  const { t } = useTranslation();
  const pathname = usePathname() || '/';
  const { width } = useWindowDimensions();
  const { isAuthenticated, role, user } = useAuth() || {};
  const partner = isAuthenticated ? LINKS_BY_ROLE[norm(role || user?.role)] : null;
  const links = partner ? partner.links : LINKS;
  const homeHref = partner ? partner.home : '/(tabs)';
  const cart = useCart() || {};

  if (isNavHidden(pathname)) return null;

  const compact = width < 760;
  const tiny = width < 560;
  const cartCount = typeof cart.getTotalItems === 'function' ? Number(cart.getTotalItems()) || 0 : 0;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(homeHref);
  };

  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <View style={styles.left}>
          {!isRootPath(pathname) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nav.back')}
              onPress={goBack}
              style={styles.back}
            >
              <Ionicons name="arrow-back" size={20} color="#084424" />
              {!compact ? <Text style={styles.backText}>{t('nav.back')}</Text> : null}
            </Pressable>
          ) : null}

          <Pressable accessibilityRole="link" onPress={() => router.replace(homeHref)} style={styles.brand}>
            <View style={styles.logo}><Text style={styles.logoLetter}>A</Text></View>
            {!tiny ? (
              <Text style={styles.brandName}>
                Afro<Text style={styles.brandAccent}>Eats</Text>
              </Text>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.links}>
          {links.map((link) => {
            const active = link.match(pathname);
            return (
              <Pressable
                key={link.key}
                accessibilityRole="link"
                accessibilityLabel={t(`nav.${link.key}`)}
                onPress={() => router.navigate(link.href)}
                style={[styles.link, active && styles.linkActive]}
              >
                {compact ? (
                  <Ionicons name={link.icon} size={20} color={active ? '#084424' : '#606D5D'} />
                ) : (
                  <Text style={[styles.linkText, active && styles.linkTextActive]}>
                    {t(`nav.${link.key}`)}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.right}>
          {!isAuthenticated ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/auth/login')}
              style={styles.signIn}
            >
              {tiny ? (
                <Ionicons name="log-in-outline" size={18} color="#084424" />
              ) : (
                <Text style={styles.signInText}>{t('nav.signIn')}</Text>
              )}
            </Pressable>
          ) : null}
          {partner ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('nav.cart')}
            onPress={() => router.push('/cart')}
            style={styles.cart}
          >
            <Ionicons name="basket-outline" size={20} color="#FBF6EC" />
            {!compact ? <Text style={styles.cartText}>{t('nav.cart')}</Text> : null}
            {cartCount > 0 ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text></View>
            ) : null}
          </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    backgroundColor: '#FFFDF9',
    borderBottomWidth: 1,
    borderBottomColor: '#E3DECF',
    zIndex: 50,
  },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#F2ECE0',
  },
  backText: { color: '#084424', fontWeight: '700', fontSize: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#084424',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: { color: '#FBF6EC', fontWeight: '800', fontSize: 16 },
  brandName: { fontFamily: BrandFonts.display, fontSize: 20, color: '#0D1C11' },
  brandAccent: { color: '#C8331A' },
  links: { flexDirection: 'row', alignItems: 'center', gap: 0, flexShrink: 1 },
  link: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 999 },
  linkActive: { backgroundColor: '#F3E7CA' },
  linkText: { color: '#606D5D', fontWeight: '600', fontSize: 15 },
  linkTextActive: { color: '#084424' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  signIn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E3DECF',
    backgroundColor: '#FFFDF9',
  },
  signInText: { color: '#084424', fontWeight: '700', fontSize: 14 },
  cart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#084424',
  },
  cartText: { color: '#FBF6EC', fontWeight: '700', fontSize: 14 },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#EAB02F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#301904', fontSize: 11, fontWeight: '800' },
});
