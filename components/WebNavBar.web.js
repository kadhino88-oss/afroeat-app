import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

/**
 * Barre du haut du site web.
 * - Site public : même apparence que l'en-tête de la page d'accueil (logo, AFROEAT, liens).
 * - Administration : barre sombre « ADMINISTRATION », pour ne jamais confondre les deux espaces.
 */

/** Pages sans barre (la page d'accueil a son propre en-tête identique ; écrans de connexion). */
export const isNavHidden = (pathname) =>
  pathname === '/' || pathname.startsWith('/auth');

/** Pages principales : pas de bouton « retour ». */
const ROOT_PATHS = ['/', '/explore', '/orders', '/profile', '/index', '/restaurant/RestaurantDashboard', '/livraison', '/admin'];

export const isRootPath = (pathname) => ROOT_PATHS.includes(pathname);

const EXPLORE = '/(tabs)/explore';

/** Liens du site public : les mêmes que sur la page d'accueil. */
const SITE_LINKS = [
  { key: 'explore', labelKey: 'nav.explore', href: EXPLORE, match: (p) => p.startsWith('/explore'), icon: 'compass-outline' },
  { key: 'restaurants', label: 'Restaurants', href: { pathname: EXPLORE, params: { category: 'Africaine' } }, match: () => false, icon: 'restaurant-outline', wideOnly: true },
  { key: 'groceries', label: 'Épiceries', href: { pathname: EXPLORE, params: { category: 'Épicerie' } }, match: () => false, icon: 'basket-outline', wideOnly: true },
  { key: 'shops', label: 'Boutiques afro', href: { pathname: EXPLORE, params: { category: 'Boutique' } }, match: () => false, icon: 'storefront-outline', wideOnly: true },
  { key: 'orders', labelKey: 'nav.orders', href: '/(tabs)/orders', match: (p) => p.startsWith('/orders') || p.startsWith('/order'), icon: 'receipt-outline', authOnly: true },
];

const norm = (role) => String(role || '').trim().toLowerCase();

/** Liens et page d'accueil selon le rôle : un partenaire ne voit pas le menu du client. */
const LINKS_BY_ROLE = {
  restaurant: {
    home: '/restaurant/RestaurantDashboard',
    links: [
      { key: 'dashboard', labelKey: 'nav.dashboard', href: '/restaurant/RestaurantDashboard', match: (p) => p === '/restaurant/RestaurantDashboard', icon: 'speedometer-outline' },
      { key: 'orders', labelKey: 'nav.orders', href: '/restaurant/restaurant-orders', match: (p) => p.startsWith('/restaurant/restaurant-orders'), icon: 'receipt-outline' },
      { key: 'menu', labelKey: 'nav.menu', href: '/restaurant/MenuScreen', match: (p) => p.startsWith('/restaurant/MenuScreen') || p.includes('MenuItem'), icon: 'restaurant-outline' },
      { key: 'profile', labelKey: 'nav.profile', href: '/restaurant/restaurant-profile', match: (p) => p.startsWith('/restaurant/restaurant-profile') || p.startsWith('/restaurant/restaurant-settings'), icon: 'person-outline' },
    ],
  },
  livreur: {
    home: '/livraison',
    links: [
      { key: 'missions', labelKey: 'nav.missions', href: '/livraison', match: (p) => p === '/livraison' || p.startsWith('/livraison/orders'), icon: 'bicycle-outline' },
      { key: 'history', labelKey: 'nav.history', href: '/livraison/history', match: (p) => p.startsWith('/livraison/history'), icon: 'time-outline' },
      { key: 'profile', labelKey: 'nav.profile', href: '/livraison/profile', match: (p) => p.startsWith('/livraison/profile'), icon: 'person-outline' },
    ],
  },
  admin: {
    home: '/admin',
    links: [
      { key: 'dashboard', labelKey: 'nav.dashboard', href: '/admin', match: (p) => p === '/admin', icon: 'speedometer-outline' },
      { key: 'orders', labelKey: 'nav.orders', href: '/admin/orders', match: (p) => p.startsWith('/admin/orders'), icon: 'receipt-outline' },
      { key: 'partners', labelKey: 'nav.partners', href: '/admin/partner-applications', match: (p) => p.startsWith('/admin/partner-applications'), icon: 'people-outline' },
    ],
  },
};
LINKS_BY_ROLE.driver = LINKS_BY_ROLE.livreur;
LINKS_BY_ROLE.delivery = LINKS_BY_ROLE.livreur;

const LOGO = require('../assets/images/icon.png');

export default function WebNavBar() {
  const { t } = useTranslation();
  const pathname = usePathname() || '/';
  const { width } = useWindowDimensions();
  const { isAuthenticated, role, user, logout } = useAuth() || {};
  const currentRole = norm(role || user?.role);
  const isAdmin = Boolean(isAuthenticated) && currentRole === 'admin';
  // L'administrateur a deux espaces distincts : le site public et l'administration (/admin).
  const onAdminArea = pathname === '/admin' || pathname.startsWith('/admin/');
  const partner =
    isAuthenticated && !(isAdmin && !onAdminArea) ? LINKS_BY_ROLE[currentRole] : null;
  const cart = useCart() || {};

  if (isNavHidden(pathname)) return null;

  const compact = width < 760;
  const tiny = width < 560;
  const wide = width >= 1080;
  const dark = Boolean(partner) && onAdminArea;
  const homeHref = partner ? partner.home : '/';
  const cartCount = typeof cart.getTotalItems === 'function' ? Number(cart.getTotalItems()) || 0 : 0;

  const links = partner
    ? partner.links
    : SITE_LINKS.filter(
        (link) => (!link.authOnly || isAuthenticated) && (!link.wideOnly || wide)
      );

  const label = (link) => (link.labelKey ? t(link.labelKey) : link.label);
  const userName = String(user?.firstName || user?.name || '').trim();

  const signOut = async () => {
    if (typeof logout === 'function') await logout();
    router.replace('/');
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(homeHref);
  };

  const ink = dark ? '#FBF6EC' : '#0D1C11';

  return (
    <View style={[styles.bar, dark && styles.barDark]}>
      <View style={[styles.inner, compact && styles.innerCompact]}>
        <View style={styles.left}>
          {!isRootPath(pathname) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nav.back')}
              onPress={goBack}
              style={[styles.back, dark && styles.backDark]}
            >
              <Ionicons name="arrow-back" size={18} color={ink} />
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="link"
            accessibilityLabel="AFROEAT"
            onPress={() => router.replace(homeHref)}
            style={[styles.brand, compact && styles.brandCompact]}
          >
            <Image source={LOGO} style={styles.logo} contentFit="cover" />
            {!tiny ? (
              <View>
                <Text style={[styles.brandName, { color: ink }]}>AFROEAT</Text>
                <Text style={styles.brandTagline}>
                  {dark ? 'ADMINISTRATION' : 'LES SAVEURS DE CHEZ NOUS'}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={[styles.nav, compact && styles.navCompact]}>
          {links.map((link) => {
            const active = link.match(pathname);
            return (
              <Pressable
                key={link.key}
                accessibilityRole="link"
                accessibilityLabel={label(link)}
                onPress={() => router.navigate(link.href)}
                style={styles.navItem}
              >
                {compact ? (
                  <Ionicons name={link.icon} size={20} color={active ? '#EAB02F' : ink} />
                ) : (
                  <Text style={[styles.navText, { color: ink }, active && styles.navTextActive]}>
                    {label(link)}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actions}>
          {isAdmin ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t(onAdminArea ? 'nav.viewSite' : 'nav.administration')}
              onPress={() => router.push(onAdminArea ? '/' : '/admin')}
              style={[styles.outline, dark && styles.outlineDark]}
            >
              <Ionicons
                name={onAdminArea ? 'globe-outline' : 'shield-checkmark-outline'}
                size={17}
                color={ink}
              />
              {!compact ? (
                <Text style={[styles.outlineText, { color: ink }]}>
                  {t(onAdminArea ? 'nav.viewSite' : 'nav.administration')}
                </Text>
              ) : null}
            </Pressable>
          ) : null}

          {partner ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nav.cart')}
              onPress={() => router.push('/cart')}
              style={styles.cartButton}
            >
              <Ionicons name="bag-handle-outline" size={20} color="#0D1C11" />
              {cartCount > 0 ? (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                </View>
              ) : null}
            </Pressable>
          )}

          {!isAuthenticated ? (
            <>
              {!compact ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push({ pathname: '/auth/login', params: { role: 'client' } })}
                  style={styles.loginButton}
                >
                  <Text style={styles.loginButtonText}>{t('nav.signIn')}</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push(compact ? '/auth/login' : '/auth/register-client')}
                style={[styles.signupButton, compact && styles.signupButtonCompact]}
              >
                <Text style={styles.signupButtonText}>
                  {compact ? t('nav.signIn') : 'S’inscrire'}
                </Text>
              </Pressable>
            </>
          ) : null}

          {isAuthenticated && !partner && !isAdmin ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('nav.profile')}
              onPress={() => router.push('/profile')}
              style={styles.outline}
            >
              <Ionicons name="person-circle-outline" size={18} color="#0D1C11" />
              {!compact ? (
                <Text style={styles.outlineText}>{userName || t('nav.profile')}</Text>
              ) : null}
            </Pressable>
          ) : null}

          {isAuthenticated && (partner || isAdmin) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.menu.logoutLabel')}
              onPress={signOut}
              style={[styles.outline, dark ? styles.signOutDark : styles.signOut]}
            >
              <Ionicons name="log-out-outline" size={17} color={dark ? '#F3E7CA' : '#C8331A'} />
              {!compact ? (
                <Text style={[styles.outlineText, { color: dark ? '#F3E7CA' : '#C8331A' }]}>
                  {t('profile.menu.logoutLabel')}
                </Text>
              ) : null}
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#FBF6EC',
    borderBottomWidth: 1,
    borderBottomColor: '#E3DECF',
    zIndex: 50,
  },
  barDark: { backgroundColor: '#0D1C11', borderBottomColor: '#0D1C11' },
  inner: {
    width: '100%',
    maxWidth: 1440,
    minHeight: 82,
    paddingHorizontal: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  innerCompact: { minHeight: 64, paddingHorizontal: 14, gap: 8 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0 },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E3DECF',
  },
  backDark: { backgroundColor: 'transparent', borderColor: '#3A4A3E' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandCompact: { gap: 7 },
  logo: { width: 42, height: 42, borderRadius: 13 },
  brandName: { fontSize: 18, fontWeight: '900', letterSpacing: 2.5 },
  brandTagline: { marginTop: 2, fontSize: 8, fontWeight: '700', letterSpacing: 1.25, color: '#EAB02F' },
  nav: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 27 },
  navCompact: { gap: 14 },
  navItem: { paddingVertical: 8 },
  navText: { fontSize: 13, fontWeight: '600' },
  navTextActive: { color: '#EAB02F', fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  cartButton: {
    position: 'relative',
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E3DECF',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAB02F',
  },
  cartBadgeText: { color: '#FBF6EC', fontSize: 9, fontWeight: '800' },
  loginButton: { height: 42, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  loginButtonText: { color: '#0D1C11', fontSize: 13, fontWeight: '700' },
  signupButton: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAB02F',
  },
  signupButtonCompact: { minHeight: 38, paddingHorizontal: 12 },
  signupButtonText: { color: '#FBF6EC', fontSize: 12, fontWeight: '800' },
  outline: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E3DECF',
    backgroundColor: '#FFFDF9',
  },
  outlineDark: { backgroundColor: 'transparent', borderColor: '#3A4A3E' },
  outlineText: { color: '#0D1C11', fontSize: 12, fontWeight: '700' },
  signOut: { borderColor: '#F0D2CB', backgroundColor: '#FFF6F3' },
  signOutDark: { backgroundColor: 'transparent', borderColor: '#3A4A3E' },
});
