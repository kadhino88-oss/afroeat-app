import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import PlaceBrandMark from './PlaceBrandMark';

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
        <PlaceBrandMark
          logoUrl={place?.logoUrl}
          website={place?.website}
          category={place?.category}
          size={markSize}
        />
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
  markShadow: {
    borderRadius: 24,
    shadowColor: '#0D1C11',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
});
