import React, { useMemo } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FadeInView from './FadeInView';

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default function PremiumCard({
  title,
  subtitle,
  price,
  image,
  onPress,
  badge = '',
  rating,
  small = false,
}) {
  const safeTitle = useMemo(() => normalizeText(title, 'Titre'), [title]);
  const safeSubtitle = useMemo(() => normalizeText(subtitle), [subtitle]);
  const safePrice = useMemo(() => normalizeText(price), [price]);
  const safeBadge = useMemo(() => normalizeText(badge), [badge]);

  const safeRating = useMemo(() => {
    const r = normalizeNumber(rating, 0);
    if (r <= 0) return null;
    return r.toFixed(1);
  }, [rating]);

  return (
    <FadeInView style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          small && styles.cardSmall,
          pressed && styles.cardPressed,
        ]}
      >
        {image ? (
          <View style={styles.imageWrap}>
            <Image source={{ uri: image }} style={styles.image} />

            {!!safeBadge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{safeBadge}</Text>
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.title} numberOfLines={1}>
              {safeTitle}
            </Text>

            {safeRating ? (
              <View style={styles.ratingWrap}>
                <Ionicons name="star" size={12} color="#D4A017" />
                <Text style={styles.ratingText}>{safeRating}</Text>
              </View>
            ) : null}
          </View>

          {!!safeSubtitle && (
            <Text style={styles.subtitle} numberOfLines={2}>
              {safeSubtitle}
            </Text>
          )}

          <View style={styles.bottomRow}>
            {!!safePrice && (
              <Text style={styles.price}>{safePrice}</Text>
            )}

            <View style={styles.arrowWrap}>
              <Ionicons name="chevron-forward" size={16} color="#888" />
            </View>
          </View>
        </View>
      </Pressable>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EEE4D8',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },

  cardSmall: {
    borderRadius: 18,
  },

  cardPressed: {
    opacity: 0.9,
  },

  imageWrap: {
    position: 'relative',
  },

  image: {
    width: '100%',
    height: 150,
    backgroundColor: '#F3E6D7',
  },

  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#F4C95D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1E1E1E',
  },

  content: {
    padding: 16,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
    marginRight: 10,
  },

  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8EA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },

  ratingText: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
    color: '#111111',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: '#777777',
    lineHeight: 18,
  },

  bottomRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  price: {
    fontSize: 15,
    fontWeight: '900',
    color: '#D96C2D',
  },

  arrowWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F5EFE8',
    justifyContent: 'center',
    alignItems: 'center',
  },
});