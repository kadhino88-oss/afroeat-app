import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import PlaceBrandMark from './PlaceBrandMark';
import { BrandFonts } from '../constants/brand';

/**
 * Visuel d'un commerce répertorié : sa vraie image de présentation (reprise de son site) si elle existe,
 * sinon un panneau clair aux couleurs AFROEAT avec son logo (ou l'icône de sa catégorie), jamais un bloc noir.
 */
const TINTS = [
  ['#F3E7CA', '#E9D3A3'],
  ['#E6EFE6', '#CFE0CF'],
  ['#F6E1D7', '#EBC4B1'],
  ['#EFE8DC', '#DDD0BA'],
];

// Initiales du commerce (« Afri K Food » → « AK »), sans les mots de liaison.
const SKIP = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'd', 'l', 'et', 'chez', 'the', 'o']);
export const initialsOf = (name) => {
  const words = String(name || '')
    .replace(/[’']/g, ' ')
    .split(/[^A-Za-zÀ-ÿ0-9]+/)
    .filter((w) => w && !SKIP.has(w.toLowerCase()));
  const letters = words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return letters || '•';
};

const tintFor = (name) => {
  const text = String(name || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
};

export default function PlaceCover({ place, style, markSize = 84 }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = String(place?.imageUrl || '').trim();
  const [base, accent] = tintFor(place?.name);

  if (imageUrl && !imageFailed) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[styles.fill, style]}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={180}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <View style={[styles.fill, styles.panel, { backgroundColor: base }, style]}>
      <View style={[styles.circle, styles.circleTop, { backgroundColor: accent }]} />
      <View style={[styles.circle, styles.circleBottom, { backgroundColor: accent }]} />
      <View style={styles.markShadow}>
        {place?.logoUrl || place?.website ? (
          <PlaceBrandMark
            logoUrl={place?.logoUrl}
            website={place?.website}
            category={place?.category}
            size={markSize}
          />
        ) : (
          <View style={[styles.monogram, { width: markSize, height: markSize, borderRadius: markSize * 0.28 }]}>
            <Text style={[styles.monogramText, { fontSize: markSize * 0.38 }]}>{initialsOf(place?.name)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  panel: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  circle: { position: 'absolute', width: 220, height: 220, borderRadius: 110, opacity: 0.55 },
  circleTop: { top: -120, right: -60 },
  circleBottom: { bottom: -140, left: -70 },
  monogram: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  monogramText: { color: '#084424', fontFamily: BrandFonts.display, fontWeight: '700', letterSpacing: 1 },
  markShadow: {
    borderRadius: 24,
    shadowColor: '#0D1C11',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
});
