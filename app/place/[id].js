import React, { useMemo } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import PlaceBrandMark from '../../components/PlaceBrandMark';

const firstParam = (value) => (Array.isArray(value) ? value[0] : value);
const normalizeText = (value) => String(firstParam(value) || '').trim();

const toSafeWebUrl = (value) => {
  const url = normalizeText(value);
  return /^https?:\/\//i.test(url) ? url : null;
};

export default function PublicPlaceScreen() {
  const params = useLocalSearchParams();
  const { t } = useTranslation();
  const place = useMemo(() => ({
    id: normalizeText(params.id),
    source: normalizeText(params.source),
    name: normalizeText(params.name),
    category: normalizeText(params.category),
    address: normalizeText(params.address),
    cuisine: normalizeText(params.cuisine),
    origin: normalizeText(params.origin),
    city: normalizeText(params.city),
    country: normalizeText(params.country),
    distanceKm: normalizeText(params.distanceKm),
    phone: normalizeText(params.phone),
    email: normalizeText(params.email),
    website: toSafeWebUrl(params.website),
    menuUrl: toSafeWebUrl(params.menuUrl),
    logoUrl: toSafeWebUrl(params.logoUrl),
    imageUrl: toSafeWebUrl(params.imageUrl),
    openingHours: normalizeText(params.openingHours),
    description: normalizeText(params.description),
    brand: normalizeText(params.brand),
    operator: normalizeText(params.operator),
    osmUrl: toSafeWebUrl(params.osmUrl),
  }), [params]);

  const categoryLabel =
    place.category === 'african-fast-food'
      ? t('publicPlace.fastFood')
      : place.category === 'african-salon'
        ? t('publicPlace.salon')
        : place.category === 'restaurant'
      ? t('publicPlace.restaurant')
      : place.category === 'african-grocery'
        ? t('publicPlace.grocery')
        : t('publicPlace.business');
  const catalogueUrl = place.menuUrl || place.website;
  const catalogueAction = ['restaurant', 'african-fast-food'].includes(place.category)
    ? t('publicPlace.viewMenu')
    : t('publicPlace.viewCatalog');

  const openLink = async (url) => {
    if (!url) return;
    try {
      const webUrl = toSafeWebUrl(url);
      if (webUrl) {
        await WebBrowser.openBrowserAsync(webUrl);
      } else {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.log('Impossible d’ouvrir ce lien :', error);
    }
  };

  const openPhone = () => {
    if (place.phone) openLink(`tel:${place.phone.replace(/[^+\d]/g, '')}`);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#155B38" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('publicPlace.back')}
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/explore')}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={21} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroIcon}>
            <PlaceBrandMark
              logoUrl={place.logoUrl}
              website={place.website}
              category={place.category}
              size={68}
            />
          </View>
          <Text style={styles.category}>{categoryLabel}</Text>
          <Text style={styles.title}>{place.name || t('publicPlace.titleFallback')}</Text>
          <Text style={styles.heroCaption}>{t('publicPlace.publicListing')}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>{t('publicPlace.about')}</Text>
          {!!place.cuisine && (
            <InfoRow icon="restaurant-outline" label={t('publicPlace.cuisine')} value={place.cuisine} />
          )}
          {!!place.origin && (
            <InfoRow icon="earth-outline" label={t('publicPlace.origin')} value={place.origin} />
          )}
          {!!place.address && (
            <InfoRow icon="location-outline" label={t('publicPlace.address')} value={place.address} />
          )}
          {!!place.city && place.city !== place.address && (
            <InfoRow icon="business-outline" label={t('publicPlace.city')} value={place.city} />
          )}
          {!!place.country && (
            <InfoRow icon="earth-outline" label={t('publicPlace.country')} value={place.country} />
          )}
          {!!place.brand && (
            <InfoRow icon="pricetag-outline" label={t('publicPlace.brand')} value={place.brand} />
          )}
          {!!place.operator && (
            <InfoRow icon="person-outline" label={t('publicPlace.operator')} value={place.operator} />
          )}
          {!!place.distanceKm && (
            <InfoRow icon="navigate-outline" label={t('publicPlace.distanceLabel')} value={t('publicPlace.distance', { distance: place.distanceKm })} />
          )}
          {!!place.openingHours && (
            <InfoRow icon="time-outline" label={t('publicPlace.openingHours')} value={place.openingHours} />
          )}
          {!!place.description && (
            <InfoRow icon="information-circle-outline" label={t('publicPlace.description')} value={place.description} />
          )}
          {!place.cuisine && !place.origin && !place.address && !place.city && !place.country && !place.brand && !place.operator && !place.openingHours && !place.description && (
            <Text style={styles.mutedText}>{t('publicPlace.limitedDetails')}</Text>
          )}
        </View>

        <View style={styles.menuCard}>
          <View style={styles.menuIcon}>
            <Ionicons name="book-outline" size={22} color="#1F6F43" />
          </View>
          <Text style={styles.menuTitle}>{t('publicPlace.catalogueTitle')}</Text>
          <Text style={styles.menuText}>
            {catalogueUrl ? t('publicPlace.catalogueAvailable') : t('publicPlace.catalogueUnavailable')}
          </Text>
          {catalogueUrl ? (
            <ActionButton
              icon="open-outline"
              label={catalogueAction}
              onPress={() => openLink(catalogueUrl)}
            />
          ) : (
            <Text style={styles.noteText}>{t('publicPlace.catalogueNote')}</Text>
          )}
        </View>

        {(place.phone || place.email || place.website) && (
          <View style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>{t('publicPlace.contact')}</Text>
            {!!place.phone && <ActionButton icon="call-outline" label={place.phone} onPress={openPhone} />}
            {!!place.email && <ActionButton icon="mail-outline" label={place.email} onPress={() => openLink(`mailto:${place.email}`)} />}
            {!!place.website && <ActionButton icon="globe-outline" label={t('publicPlace.visitWebsite')} onPress={() => openLink(place.website)} />}
          </View>
        )}

        {!!place.osmUrl && (
          <Pressable style={styles.attribution} onPress={() => openLink(place.osmUrl)}>
            <Ionicons name="open-outline" size={14} color="#7C7164" />
            <Text style={styles.attributionText}>{t('publicPlace.attribution')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color="#1F6F43" />
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ActionButton({ icon, label, onPress }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={18} color="#1F6F43" />
      <Text style={styles.actionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color="#968A7A" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { paddingBottom: 36 },
  hero: { minHeight: 260, paddingTop: 68, paddingHorizontal: 24, paddingBottom: 26, backgroundColor: '#155B38', alignItems: 'center', justifyContent: 'center' },
  backButton: { position: 'absolute', top: 48, left: 18, width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  heroIcon: { width: 62, height: 62, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 13 },
  category: { color: '#F6CA58', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  title: { marginTop: 7, color: '#FFFFFF', fontSize: 27, lineHeight: 33, fontWeight: '900', textAlign: 'center' },
  heroCaption: { marginTop: 7, color: '#DDEBE2', fontSize: 13, fontWeight: '600' },
  infoCard: { margin: 16, padding: 18, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0E6D9' },
  sectionTitle: { color: '#171717', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F4EEE7' },
  infoCopy: { flex: 1, marginLeft: 11 },
  infoLabel: { color: '#867A6C', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { marginTop: 3, color: '#24211E', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  mutedText: { color: '#82796E', fontSize: 14, lineHeight: 21 },
  menuCard: { marginHorizontal: 16, padding: 20, borderRadius: 22, backgroundColor: '#F2F7F2', borderWidth: 1, borderColor: '#DCEBDD', alignItems: 'flex-start' },
  menuIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#FFFFFF', marginBottom: 12 },
  menuTitle: { color: '#183B28', fontSize: 18, fontWeight: '900' },
  menuText: { marginTop: 7, color: '#5C675F', fontSize: 14, lineHeight: 21 },
  noteText: { marginTop: 11, color: '#7C7164', fontSize: 12, lineHeight: 18 },
  actionsCard: { margin: 16, padding: 18, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0E6D9' },
  actionButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F4EEE7' },
  actionLabel: { flex: 1, marginHorizontal: 10, color: '#26382D', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  attribution: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12 },
  attributionText: { marginLeft: 6, color: '#7C7164', fontSize: 11, textDecorationLine: 'underline' },
});
