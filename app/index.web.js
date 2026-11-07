import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { getNearbyPlaces } from '../services/placeService';
import { NEARBY_RADIUS_OPTIONS } from '../services/nearbySearchSettings';
import PlaceBrandMark from '../components/PlaceBrandMark';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1400&q=90';

const EXPLORE_CATEGORIES = [
  {
    title: 'Restaurants africains',
    description: 'Plats maison, grillades, cuisine de rue et spécialités du continent.',
    action: 'Explorer les restaurants',
    filter: 'Africaine',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85',
    icon: 'restaurant-outline',
  },
  {
    title: 'Épiceries africaines',
    description: 'Épices, farines, produits frais et ingrédients de nos cuisines.',
    action: 'Trouver une épicerie',
    filter: 'Épicerie',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=85',
    icon: 'basket-outline',
  },
  {
    title: 'Boutiques & salons afro',
    description: 'Mode, beauté, coiffure et commerces africains près de chez vous.',
    action: 'Voir les commerces',
    filter: 'Boutique',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=85',
    icon: 'storefront-outline',
  },
];

const CUISINE_REGIONS = [
  { title: "Afrique de l'Ouest", subtitle: 'Thieboudienne · Jollof · Mafé', query: 'thieboudienne' },
  { title: 'Afrique centrale', subtitle: 'Ndolé · Pondu · Poulet DG', query: 'ndolé' },
  { title: "Afrique de l'Est", subtitle: 'Injera · Doro wat · Grillades', query: 'injera' },
  { title: 'Afrique du Nord', subtitle: 'Tajines · Couscous · Harira', query: 'tajine' },
  { title: 'Afrique australe', subtitle: 'Braai · Peri-peri · Bobotie', query: 'peri-peri' },
];

const normalizeText = (value, fallback = '') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const displayRole = (value) => normalizeText(value).toLowerCase();

const getStaffRedirect = (role, user) => {
  const currentRole = displayRole(role || user?.role);
  if (['restaurant', 'resto', 'partner_restaurant'].includes(currentRole)) return '/restaurant/RestaurantDashboard';
  if (['livreur', 'driver', 'courier', 'delivery'].includes(currentRole)) return '/livraison';
  if (['admin', 'administrator', 'superadmin', 'super-admin', 'ops'].includes(currentRole)) return '/admin';
  return null;
};

const getCategoryLabel = (place) => {
  if (place?.category === 'african-grocery') return 'Épicerie africaine';
  if (place?.category === 'african-fast-food') return 'Fast-food africain';
  if (place?.category === 'african-salon') return 'Salon afro';
  if (place?.category === 'african-business') return 'Commerce africain';
  return 'Restaurant africain';
};

const isRealDirectoryPlace = (place) =>
  ['openstreetmap', 'public-directory'].includes(place?.source) || place?.isPublicListing === true;

export default function WebDiscoveryHome() {
  const { t } = useTranslation();
  const auth = useAuth() || {};
  const cart = useCart() || {};
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const tablet = width >= 720 && width < 1080;
  const [search, setSearch] = useState('');
  const [distance, setDistance] = useState(10);
  const [nearby, setNearby] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbySearched, setNearbySearched] = useState(false);
  const [notice, setNotice] = useState('');

  const staffRedirect = useMemo(
    () => auth.isAuthenticated ? getStaffRedirect(auth.role, auth.user) : null,
    [auth.isAuthenticated, auth.role, auth.user]
  );

  const cartCount = typeof cart.getTotalItems === 'function'
    ? Number(cart.getTotalItems()) || 0
    : 0;

  const openExplorer = useCallback((category = '', query = '') => {
    const params = {};
    if (category) params.category = category;
    if (query) params.q = query;
    router.push(Object.keys(params).length
      ? { pathname: '/(tabs)/explore', params }
      : '/(tabs)/explore');
  }, []);

  const showNotice = useCallback((message) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 3600);
  }, []);

  const findNearby = useCallback(() => {
    const geolocation = globalThis?.navigator?.geolocation;
    if (!geolocation) {
      showNotice('La géolocalisation n’est pas disponible dans ce navigateur.');
      return;
    }

    setNearbyLoading(true);
    geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await getNearbyPlaces({
            latitude: coords.latitude,
            longitude: coords.longitude,
            radius: distance,
            token: auth.token || null,
          });
          const places = [
            ...(Array.isArray(result?.restaurants) ? result.restaurants : []),
            ...(Array.isArray(result?.fastFoods) ? result.fastFoods : []),
            ...(Array.isArray(result?.groceries) ? result.groceries : []),
            ...(Array.isArray(result?.businesses) ? result.businesses : []),
          ].filter(isRealDirectoryPlace);
          setNearby(places);
          setNearbySearched(true);
        } catch (error) {
          showNotice(error?.message || 'Les commerces proches sont momentanément indisponibles.');
        } finally {
          setNearbyLoading(false);
        }
      },
      (error) => {
        setNearbyLoading(false);
        showNotice(error?.code === 1
          ? 'Autorisez la localisation pour afficher les adresses africaines près de vous.'
          : 'Impossible de récupérer votre position. Vous pouvez aussi rechercher une ville.');
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
  }, [auth.token, distance, showNotice]);

  const openPlace = useCallback((place) => {
    router.push({
      pathname: '/place/[id]',
      params: {
        id: String(place?.id || place?.osmId || ''),
        source: normalizeText(place?.source, 'openstreetmap'),
        name: normalizeText(place?.name),
        category: normalizeText(place?.category),
        address: normalizeText(place?.address),
        cuisine: normalizeText(place?.cuisine),
        origin: normalizeText(place?.origin),
        city: normalizeText(place?.city),
        country: normalizeText(place?.country),
        distanceKm: place?.distanceKm == null ? '' : String(place.distanceKm),
        phone: normalizeText(place?.phone),
        email: normalizeText(place?.email),
        website: normalizeText(place?.website),
        menuUrl: normalizeText(place?.menuUrl),
        logoUrl: normalizeText(place?.logoUrl),
        imageUrl: normalizeText(place?.imageUrl),
        openingHours: normalizeText(place?.openingHours),
        description: normalizeText(place?.description),
        brand: normalizeText(place?.brand),
        operator: normalizeText(place?.operator),
        osmType: normalizeText(place?.osmType),
        osmId: normalizeText(place?.osmId),
        osmUrl: normalizeText(place?.osmUrl),
      },
    });
  }, []);

  if (auth.loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.gold} />
        <Text style={styles.loadingText}>{t('entry.loadingExperience')}</Text>
      </View>
    );
  }

  if (staffRedirect) return <Redirect href={staffRedirect} />;

  const userName = normalizeText(auth.user?.firstName || auth.user?.name);

  return (
    <View style={styles.page}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.paper} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.header, compact && styles.headerCompact]}>
          <Pressable style={[styles.brand, compact && styles.brandCompact]} onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="AFROEAT accueil">
            <Image source={require('../assets/images/icon.png')} style={styles.logo} contentFit="cover" />
            <View>
              <Text style={styles.brandName}>AFROEAT</Text>
              <Text style={styles.brandTagline}>LES SAVEURS DE CHEZ NOUS</Text>
            </View>
          </Pressable>

          {!compact ? (
            <View style={styles.nav}>
              <Pressable onPress={() => openExplorer()}><Text style={styles.navText}>Explorer</Text></Pressable>
              <Pressable onPress={() => openExplorer('Africaine')}><Text style={styles.navText}>Restaurants</Text></Pressable>
              <Pressable onPress={() => openExplorer('Épicerie')}><Text style={styles.navText}>Épiceries</Text></Pressable>
              <Pressable onPress={() => openExplorer('Boutique')}><Text style={styles.navText}>Boutiques afro</Text></Pressable>
              <Pressable onPress={() => scrollToSection('origines')}><Text style={styles.navText}>Nos cuisines</Text></Pressable>
            </View>
          ) : null}

          <View style={styles.headerActions}>
            <Pressable style={styles.cartButton} onPress={() => router.push('/cart')} accessibilityRole="button" accessibilityLabel={t('cart.title')}>
              <Ionicons name="bag-handle-outline" size={20} color={COLORS.ink} />
              {cartCount > 0 ? <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text></View> : null}
            </Pressable>
            {auth.isAuthenticated ? (
              <Pressable style={styles.accountButton} onPress={() => router.push('/profile')}>
                <Ionicons name="person-circle-outline" size={18} color={COLORS.ink} />
                {!compact ? <Text style={styles.accountButtonText}>{userName || 'Mon compte'}</Text> : null}
              </Pressable>
            ) : (
              <>
                {!compact ? <Pressable style={styles.loginButton} onPress={() => router.push({ pathname: '/auth/login', params: { role: 'client' } })}><Text style={styles.loginButtonText}>Connexion</Text></Pressable> : null}
                <Pressable style={[styles.signupButton, compact && styles.signupButtonCompact]} onPress={() => router.push('/auth/register-client')}><Text style={styles.signupButtonText}>S’inscrire</Text></Pressable>
              </>
            )}
          </View>
        </View>

        {compact ? (
          <View style={styles.mobileNav}>
            <Pressable onPress={() => openExplorer()}><Text style={styles.navText}>Explorer</Text></Pressable>
            <Pressable onPress={() => openExplorer('Épicerie')}><Text style={styles.navText}>Épiceries</Text></Pressable>
            <Pressable onPress={() => openExplorer('Boutique')}><Text style={styles.navText}>Boutiques</Text></Pressable>
          </View>
        ) : null}

        <View style={[styles.hero, compact && styles.heroCompact]}>
          <Image source={{ uri: HERO_IMAGE }} style={[styles.heroImage, compact && styles.heroImageCompact]} contentFit="cover" transition={180} />
          <View style={[styles.heroShade, compact && styles.heroShadeCompact]} />
          <View style={[styles.heroCopy, compact && styles.heroCopyCompact]}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrow}>LES SAVEURS DE CHEZ NOUS, À VOTRE PORTE</Text>
            </View>
            <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
              L’Afrique dans votre assiette, <Text style={styles.heroTitleAccent}>près de chez vous.</Text>
            </Text>
            <Text style={styles.heroDescription}>
              Découvrez les restaurants, épiceries et commerces africains de votre région — et les cuisines qui nous rassemblent.
            </Text>

            <View style={[styles.searchForm, compact && styles.searchFormCompact]}>
              <View style={styles.searchInputWrap}>
                <Ionicons name="search-outline" size={20} color={COLORS.muted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  onSubmitEditing={() => openExplorer('', search.trim())}
                  placeholder="Un plat, un commerce ou une ville…"
                  placeholderTextColor={COLORS.muted}
                  style={styles.searchInput}
                  returnKeyType="search"
                  accessibilityLabel="Rechercher un plat, commerce ou ville"
                />
                {search ? <Pressable onPress={() => setSearch('')} accessibilityLabel="Effacer la recherche"><Ionicons name="close-circle" size={18} color={COLORS.muted} /></Pressable> : null}
              </View>
              <Pressable style={styles.searchButton} onPress={() => openExplorer('', search.trim())} accessibilityRole="button">
                <Text style={styles.searchButtonText}>Explorer</Text>
                <Ionicons name="arrow-forward" size={17} color={COLORS.ink} />
              </Pressable>
            </View>

            <Pressable style={styles.locationAction} onPress={findNearby} accessibilityRole="button">
              <Ionicons name="navigate-outline" size={16} color="#F3C96B" />
              <Text style={styles.locationActionText}>Trouver les adresses africaines autour de moi</Text>
            </Pressable>
          </View>
          <View style={styles.heroImageCaption}>
            <Ionicons name="restaurant-outline" size={16} color="#F3C96B" />
            <Text style={styles.heroImageCaptionText}>Restaurants & commerces africains</Text>
          </View>
          <View style={styles.heroOrnament} />
        </View>

        <View style={[styles.content, compact && styles.contentCompact]}>
          <View style={[styles.trustRow, compact && styles.trustRowCompact]}>
            <View style={styles.trustItem}><Ionicons name="earth-outline" size={19} color={COLORS.gold} /><Text style={styles.trustText}>Des cuisines de tout le continent</Text></View>
            <View style={styles.trustItem}><Ionicons name="location-outline" size={19} color={COLORS.gold} /><Text style={styles.trustText}>Des adresses proches de vous</Text></View>
            <View style={styles.trustItem}><Ionicons name="storefront-outline" size={19} color={COLORS.gold} /><Text style={styles.trustText}>Restaurants, épiceries & boutiques</Text></View>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionEyebrow}>DÉCOUVREZ AFROEAT</Text>
            <Text style={styles.sectionTitle}>Tout ce qui nous rapproche, <Text style={styles.sectionTitleAccent}>livré.</Text></Text>
            <Text style={styles.sectionSubtitle}>Une seule adresse pour retrouver les saveurs, les produits et les commerces de la communauté africaine.</Text>
          </View>

          <View style={[styles.offerGrid, compact && styles.offerGridCompact, tablet && styles.offerGridTablet]}>
            {EXPLORE_CATEGORIES.map((offer) => (
              <Pressable
                key={offer.title}
                style={({ pressed }) => [styles.offerCard, pressed && styles.offerCardPressed, { width: compact ? '100%' : tablet ? '48.5%' : '31.8%' }]}
                onPress={() => openExplorer(offer.filter)}
                accessibilityRole="button"
              >
                <View style={styles.offerImageWrap}>
                  <Image source={{ uri: offer.image }} style={styles.offerImage} contentFit="cover" transition={180} />
                  <View style={styles.offerImageShade} />
                  <View style={styles.offerIcon}><Ionicons name={offer.icon} size={20} color={COLORS.ink} /></View>
                </View>
                <View style={styles.offerBody}>
                  <Text style={styles.offerTitle}>{offer.title}</Text>
                  <Text style={styles.offerDescription}>{offer.description}</Text>
                  <View style={styles.offerLink}><Text style={styles.offerLinkText}>{offer.action}</Text><Ionicons name="arrow-forward" size={16} color={COLORS.gold} /></View>
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.nearbySection}>
            <View style={[styles.nearbyHeading, compact && styles.nearbyHeadingCompact]}>
              <View style={styles.nearbyHeadingCopy}>
                <Text style={styles.sectionEyebrow}>AUTOUR DE VOUS</Text>
                <Text style={styles.nearbyTitle}>Les adresses africaines à découvrir</Text>
                <Text style={styles.nearbySubtitle}>Les lieux affichés viennent de l’annuaire public et de la position que vous choisissez.</Text>
              </View>
              <Pressable style={styles.nearbyButton} onPress={findNearby} disabled={nearbyLoading}>
                {nearbyLoading ? <ActivityIndicator size="small" color={COLORS.ink} /> : <Ionicons name="locate-outline" size={17} color={COLORS.ink} />}
                <Text style={styles.nearbyButtonText}>{nearbyLoading ? 'Recherche…' : 'Autour de moi'}</Text>
              </Pressable>
            </View>

            <View style={styles.distanceRow}>
              <Text style={styles.distanceLabel}>Rayon</Text>
              {NEARBY_RADIUS_OPTIONS.map((km) => (
                <Pressable key={km} style={[styles.distanceChip, distance === km && styles.distanceChipActive]} onPress={() => setDistance(km)} accessibilityRole="button" accessibilityState={{ selected: distance === km }}>
                  <Text style={[styles.distanceChipText, distance === km && styles.distanceChipTextActive]}>{km} km</Text>
                </Pressable>
              ))}
            </View>

            {nearby.length > 0 ? (
              <View style={[styles.nearbyGrid, compact && styles.nearbyGridCompact]}>
                {nearby.slice(0, 6).map((place) => (
                  <Pressable key={`${place.source}-${place.id || place.osmId}`} style={({ pressed }) => [styles.placeCard, { width: compact ? '100%' : tablet ? '48.5%' : '31.8%', minWidth: compact ? 0 : 235 }, pressed && styles.offerCardPressed]} onPress={() => openPlace(place)} accessibilityRole="button">
                    <View style={styles.placeImageWrap}>
                      {place.imageUrl || place.logoUrl ? (
                        <Image source={{ uri: place.imageUrl || place.logoUrl }} style={styles.placeImage} contentFit="cover" />
                      ) : (
                          <View style={styles.placeFallback}><PlaceBrandMark category={place.category} website={place.website} logoUrl={place.logoUrl} size={60} /></View>
                      )}
                      <View style={styles.placeType}><Text style={styles.placeTypeText}>{getCategoryLabel(place)}</Text></View>
                    </View>
                    <View style={styles.placeBody}>
                      <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
                      <Text style={styles.placeAddress} numberOfLines={1}>{place.city || place.address || place.country || 'Adresse répertoriée'}</Text>
                      {place.distanceKm != null ? <Text style={styles.placeDistance}>{Number(place.distanceKm).toFixed(1)} km</Text> : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={[styles.nearbyEmpty, compact && styles.nearbyEmptyCompact]}>
                <View style={styles.nearbyEmptyIcon}><Ionicons name={nearbySearched ? 'search-outline' : 'map-outline'} size={23} color={COLORS.gold} /></View>
                <View style={styles.nearbyEmptyCopy}>
                  <Text style={styles.nearbyEmptyTitle}>{nearbySearched ? 'Aucune adresse trouvée dans ce rayon' : 'L’annuaire se révèle selon votre position'}</Text>
                  <Text style={styles.nearbyEmptyText}>{nearbySearched ? 'Essayez un rayon plus large ou relancez la recherche depuis Explorer.' : 'Autorisez la localisation pour voir les restaurants, épiceries et commerces africains réellement répertoriés autour de vous.'}</Text>
                </View>
                <Pressable style={styles.nearbyEmptyAction} onPress={() => openExplorer()}><Text style={styles.nearbyEmptyActionText}>Explorer l’annuaire</Text><Ionicons name="arrow-forward" size={15} color={COLORS.gold} /></Pressable>
              </View>
            )}
          </View>

          <View style={styles.originsSection} nativeID="origines">
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionEyebrow}>VOYAGEZ PAR LES SAVEURS</Text>
              <Text style={styles.sectionTitle}>L’Afrique, <Text style={styles.sectionTitleAccent}>une région à la fois.</Text></Text>
              <Text style={styles.sectionSubtitle}>Parcourez les grandes traditions culinaires et retrouvez les adresses africaines qui les font vivre près de vous.</Text>
            </View>
            <View style={[styles.regionsGrid, compact && styles.regionsGridCompact, tablet && styles.regionsGridTablet]}>
              {CUISINE_REGIONS.map((region, index) => (
                <Pressable key={region.title} style={({ pressed }) => [styles.regionCard, index === 0 && styles.regionCardFeatured, pressed && styles.offerCardPressed, { width: compact ? '100%' : tablet ? '48.5%' : '31.8%' }]} onPress={() => openExplorer('', region.query)}>
                  <View style={styles.regionIndex}><Text style={styles.regionIndexText}>0{index + 1}</Text></View>
                  <Text style={styles.regionTitle}>{region.title}</Text>
                  <Text style={styles.regionSubtitle}>{region.subtitle}</Text>
                  <View style={styles.regionArrow}><Ionicons name="arrow-forward" size={18} color={index === 0 ? COLORS.cream : COLORS.gold} /></View>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.partnerBanner, compact && styles.partnerBannerCompact]}>
            <View style={styles.partnerBannerIcon}><Ionicons name="storefront-outline" size={26} color={COLORS.gold} /></View>
            <View style={styles.partnerBannerCopy}>
              <Text style={styles.partnerBannerEyebrow}>VOUS ÊTES COMMERÇANT ?</Text>
              <Text style={styles.partnerBannerTitle}>Faites découvrir votre adresse à la communauté.</Text>
              <Text style={styles.partnerBannerText}>Restaurants, épiceries, salons et boutiques africaines peuvent rejoindre AFROEAT.</Text>
            </View>
            <Pressable style={styles.partnerBannerButton} onPress={() => router.push({ pathname: '/auth/role', params: { role: 'restaurant' } })}>
              <Text style={styles.partnerBannerButtonText}>Rejoindre AFROEAT</Text>
              <Ionicons name="arrow-forward" size={17} color={COLORS.ink} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.footer, compact && styles.footerCompact]}>
          <View style={styles.footerBrand}><Text style={styles.footerBrandName}>AFROEAT</Text><Text style={styles.footerTagline}>Les saveurs de chez nous, chez vous.</Text></View>
          <View style={styles.footerLinks}>
            <Pressable onPress={() => openExplorer()}><Text style={styles.footerLink}>Restaurants</Text></Pressable>
            <Pressable onPress={() => openExplorer('Épicerie')}><Text style={styles.footerLink}>Épiceries</Text></Pressable>
            <Pressable onPress={() => openExplorer('Boutique')}><Text style={styles.footerLink}>Commerces africains</Text></Pressable>
            <Pressable onPress={() => router.push('/auth/role')}><Text style={styles.footerLink}>Devenir partenaire</Text></Pressable>
          </View>
          <Text style={styles.footerCopy}>© {new Date().getFullYear()} AFROEAT</Text>
        </View>
      </ScrollView>

      {notice ? (
        <View style={styles.notice} accessibilityRole="alert"><Ionicons name="information-circle-outline" size={18} color="#F3C96B" /><Text style={styles.noticeText}>{notice}</Text></View>
      ) : null}
    </View>
  );
}

const scrollToSection = (id) => {
  if (typeof document !== 'undefined') document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const COLORS = {
  paper: '#FBF8F1',
  cream: '#FFF9EF',
  ink: '#241C16',
  cocoa: '#0F0D0A',
  gold: '#BD861D',
  goldLight: '#C9A14A',
  border: '#E4DAC9',
  muted: '#776D60',
  card: '#FFFDF8',
  surface: '#F3EEE4',
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.paper },
  scrollContent: { alignItems: 'center' },
  loading: { flex: 1, minHeight: 500, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: COLORS.paper },
  loadingText: { color: COLORS.muted, fontSize: 14 },
  header: { width: '100%', maxWidth: 1440, minHeight: 82, paddingHorizontal: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.paper, zIndex: 5 },
  headerCompact: { minHeight: 68, paddingHorizontal: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, minWidth: 185 },
  brandCompact: { minWidth: 0, gap: 7 },
  logo: { width: 42, height: 42, borderRadius: 13 },
  brandName: { fontSize: 18, fontWeight: '900', letterSpacing: 2.5, color: COLORS.ink },
  brandTagline: { marginTop: 2, fontSize: 8, fontWeight: '700', letterSpacing: 1.25, color: COLORS.gold },
  nav: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 27 },
  navText: { color: COLORS.ink, fontSize: 13, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartButton: { position: 'relative', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  cartBadge: { position: 'absolute', top: -3, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gold },
  cartBadgeText: { color: COLORS.cream, fontSize: 9, fontWeight: '800' },
  loginButton: { height: 42, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center' },
  loginButtonText: { color: COLORS.ink, fontSize: 13, fontWeight: '700' },
  accountButton: { height: 42, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  accountButtonText: { color: COLORS.ink, fontSize: 12, fontWeight: '700' },
  signupButton: { minHeight: 42, paddingHorizontal: 18, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gold },
  signupButtonCompact: { minHeight: 38, paddingHorizontal: 11 },
  signupButtonText: { color: COLORS.cream, fontSize: 12, fontWeight: '800' },
  mobileNav: { width: '100%', paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-around', borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.paper },
  hero: { width: '100%', maxWidth: 1440, minHeight: 530, paddingVertical: 68, paddingHorizontal: 70, justifyContent: 'center', backgroundColor: COLORS.cocoa, overflow: 'hidden', position: 'relative' },
  heroImage: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', height: '100%', opacity: 0.68 },
  heroImageCompact: { width: '100%', opacity: 0.34 },
  heroShade: { position: 'absolute', top: 0, bottom: 0, right: '25%', width: '30%', backgroundColor: 'rgba(15,13,10,0.64)' },
  heroShadeCompact: { left: 0, right: 0, width: '100%', backgroundColor: 'rgba(15,13,10,0.6)' },
  heroCopy: { width: '60%', maxWidth: 760, zIndex: 2 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 19 },
  eyebrowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.goldLight },
  eyebrow: { fontSize: 10, letterSpacing: 2, color: COLORS.goldLight, fontWeight: '800' },
  heroTitle: { maxWidth: 720, fontSize: 58, lineHeight: 66, color: COLORS.cream, fontFamily: 'Georgia', fontWeight: '600', letterSpacing: -1.5 },
  heroTitleAccent: { color: COLORS.goldLight, fontStyle: 'italic' },
  heroDescription: { maxWidth: 570, marginTop: 16, color: '#EDE4D7', fontSize: 15, lineHeight: 25 },
  searchForm: { maxWidth: 750, marginTop: 31, padding: 7, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, backgroundColor: COLORS.card },
  searchInputWrap: { flex: 1, minWidth: 0, height: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13 },
  searchInput: { flex: 1, minWidth: 0, color: COLORS.ink, fontSize: 13, outlineStyle: 'none' },
  searchButton: { height: 50, paddingHorizontal: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 7, backgroundColor: COLORS.goldLight },
  searchButtonText: { color: COLORS.ink, fontSize: 12, fontWeight: '800' },
  locationAction: { alignSelf: 'flex-start', marginTop: 17, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationActionText: { color: COLORS.cream, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  heroImageCaption: { position: 'absolute', bottom: 29, right: 45, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 2 },
  heroImageCaptionText: { color: COLORS.cream, fontSize: 11, fontWeight: '700' },
  heroOrnament: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 1, borderColor: 'rgba(201,161,74,0.22)', right: '40%', top: -145 },
  content: { width: '100%', maxWidth: 1300, paddingHorizontal: 36 },
  contentCompact: { paddingHorizontal: 20 },
  trustRow: { paddingVertical: 25, flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  trustRowCompact: { flexDirection: 'column', gap: 12 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trustText: { color: COLORS.ink, fontSize: 12, fontWeight: '700' },
  sectionHeading: { maxWidth: 740, marginTop: 70, marginBottom: 28 },
  sectionEyebrow: { color: COLORS.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  sectionTitle: { marginTop: 9, color: COLORS.ink, fontFamily: 'Georgia', fontSize: 38, lineHeight: 45, fontWeight: '600' },
  sectionTitleAccent: { color: COLORS.gold, fontStyle: 'italic' },
  sectionSubtitle: { marginTop: 9, maxWidth: 640, color: COLORS.muted, fontSize: 13, lineHeight: 21 },
  offerGrid: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 },
  offerGridCompact: { flexDirection: 'column', gap: 15 },
  offerGridTablet: { justifyContent: 'space-between', gap: 14 },
  offerCard: { overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.card, marginBottom: 2 },
  offerCardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  offerImageWrap: { height: 185, position: 'relative', backgroundColor: COLORS.surface },
  offerImage: { width: '100%', height: '100%' },
  offerImageShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 85, backgroundColor: 'rgba(15,13,10,0.24)' },
  offerIcon: { position: 'absolute', left: 15, bottom: 14, width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.goldLight },
  offerBody: { padding: 18 },
  offerTitle: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 20, fontWeight: '600' },
  offerDescription: { minHeight: 44, marginTop: 8, color: COLORS.muted, fontSize: 12, lineHeight: 19 },
  offerLink: { marginTop: 17, flexDirection: 'row', alignItems: 'center', gap: 8 },
  offerLinkText: { color: COLORS.ink, fontSize: 11, fontWeight: '800' },
  nearbySection: { marginTop: 78, paddingVertical: 40, paddingHorizontal: 34, borderRadius: 16, backgroundColor: COLORS.surface },
  nearbyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 25 },
  nearbyHeadingCompact: { flexDirection: 'column', alignItems: 'flex-start' },
  nearbyHeadingCopy: { flex: 1 },
  nearbyTitle: { marginTop: 8, color: COLORS.ink, fontFamily: 'Georgia', fontSize: 30, lineHeight: 37, fontWeight: '600' },
  nearbySubtitle: { marginTop: 8, color: COLORS.muted, fontSize: 12, lineHeight: 20 },
  nearbyButton: { minHeight: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, backgroundColor: COLORS.goldLight },
  nearbyButtonText: { color: COLORS.ink, fontSize: 11, fontWeight: '800' },
  distanceRow: { marginTop: 22, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  distanceLabel: { marginRight: 5, color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  distanceChip: { minWidth: 51, height: 31, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  distanceChipActive: { backgroundColor: COLORS.cocoa, borderColor: COLORS.cocoa },
  distanceChipText: { color: COLORS.ink, fontSize: 10, fontWeight: '700' },
  distanceChipTextActive: { color: COLORS.cream },
  nearbyGrid: { marginTop: 21, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  nearbyGridCompact: { flexDirection: 'column' },
  placeCard: { width: '31.8%', minWidth: 235, overflow: 'hidden', borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  placeImageWrap: { height: 145, position: 'relative', backgroundColor: '#EDE5D8' },
  placeImage: { width: '100%', height: '100%' },
  placeFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  placeType: { position: 'absolute', left: 10, bottom: 10, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 5, backgroundColor: COLORS.card },
  placeTypeText: { color: COLORS.ink, fontSize: 9, fontWeight: '800' },
  placeBody: { padding: 13 },
  placeName: { color: COLORS.ink, fontFamily: 'Georgia', fontSize: 16, fontWeight: '600' },
  placeAddress: { marginTop: 5, color: COLORS.muted, fontSize: 10 },
  placeDistance: { marginTop: 8, color: COLORS.gold, fontSize: 10, fontWeight: '800' },
  nearbyEmpty: { marginTop: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  nearbyEmptyCompact: { flexDirection: 'column', alignItems: 'flex-start' },
  nearbyEmptyIcon: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0E1BC' },
  nearbyEmptyCopy: { flex: 1 },
  nearbyEmptyTitle: { color: COLORS.ink, fontSize: 12, fontWeight: '800' },
  nearbyEmptyText: { marginTop: 4, color: COLORS.muted, fontSize: 11, lineHeight: 17 },
  nearbyEmptyAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nearbyEmptyActionText: { color: COLORS.ink, fontSize: 10, fontWeight: '800' },
  originsSection: { marginBottom: 72 },
  regionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14 },
  regionsGridCompact: { flexDirection: 'column' },
  regionsGridTablet: { justifyContent: 'space-between' },
  regionCard: { minHeight: 154, padding: 19, borderRadius: 11, backgroundColor: COLORS.cream, borderWidth: 1, borderColor: COLORS.border, position: 'relative' },
  regionCardFeatured: { backgroundColor: COLORS.cocoa, borderColor: COLORS.cocoa },
  regionIndex: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0E1BC' },
  regionIndexText: { color: COLORS.ink, fontSize: 10, fontWeight: '800' },
  regionTitle: { marginTop: 20, color: COLORS.ink, fontFamily: 'Georgia', fontSize: 18, fontWeight: '600' },
  regionSubtitle: { marginTop: 6, color: COLORS.muted, fontSize: 10, lineHeight: 16 },
  regionArrow: { position: 'absolute', right: 16, top: 20 },
  partnerBanner: { marginBottom: 72, padding: 30, flexDirection: 'row', alignItems: 'center', gap: 20, borderRadius: 13, backgroundColor: '#EDE4D4' },
  partnerBannerCompact: { flexDirection: 'column', alignItems: 'flex-start', padding: 21 },
  partnerBannerIcon: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },
  partnerBannerCopy: { flex: 1 },
  partnerBannerEyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.6 },
  partnerBannerTitle: { marginTop: 7, color: COLORS.ink, fontFamily: 'Georgia', fontSize: 21, fontWeight: '600' },
  partnerBannerText: { marginTop: 5, color: COLORS.muted, fontSize: 11, lineHeight: 17 },
  partnerBannerButton: { minHeight: 43, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 7, backgroundColor: COLORS.goldLight },
  partnerBannerButtonText: { color: COLORS.ink, fontSize: 10, fontWeight: '800' },
  footer: { width: '100%', paddingHorizontal: 42, paddingVertical: 38, backgroundColor: COLORS.cocoa },
  footerCompact: { paddingHorizontal: 20 },
  footerBrandName: { color: COLORS.cream, fontSize: 17, fontWeight: '900', letterSpacing: 3 },
  footerTagline: { marginTop: 6, color: '#C8BDB0', fontSize: 11 },
  footerLinks: { marginTop: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 21 },
  footerLink: { color: '#F1E8DA', fontSize: 10 },
  footerCopy: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#493D31', color: '#C8BDB0', fontSize: 9 },
  notice: { position: 'absolute', bottom: 24, left: 20, right: 20, maxWidth: 540, minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 8, backgroundColor: COLORS.cocoa, elevation: 8, zIndex: 20 },
  noticeText: { color: COLORS.cream, fontSize: 11, flex: 1, lineHeight: 16 },
  heroCompact: { minHeight: 520, paddingHorizontal: 22, paddingVertical: 42, justifyContent: 'flex-end' },
  heroCopyCompact: { width: '100%' },
  heroTitleCompact: { fontSize: 39, lineHeight: 46 },
  searchFormCompact: { flexDirection: 'column', alignItems: 'stretch', backgroundColor: 'transparent', padding: 0 },
});
