import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const getSiteIconUrl = (website) => {
  try {
    const site = new URL(String(website || ''));
    if (!['http:', 'https:'].includes(site.protocol)) return '';
    return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(site.origin)}&sz=128`;
  } catch {
    return '';
  }
};

export default function PlaceBrandMark({
  logoUrl,
  website,
  category,
  size = 56,
}) {
  const sources = useMemo(
    () => [...new Set([String(logoUrl || '').trim(), getSiteIconUrl(website)].filter(Boolean))],
    [logoUrl, website]
  );
  const sourceKey = sources.join('|');
  const [failedSourceState, setFailedSourceState] = useState({
    sourceKey: '',
    failedSources: [],
  });
  const iconName =
    category === 'african-fast-food'
      ? 'fast-food-outline'
      : category === 'african-salon'
        ? 'cut-outline'
        : category === 'restaurant'
          ? 'restaurant-outline'
          : 'storefront-outline';
  const failedSources =
    failedSourceState.sourceKey === sourceKey
      ? failedSourceState.failedSources
      : [];
  const imageUri = sources.find((source) => !failedSources.includes(source));
  const handleImageError = () => {
    if (!imageUri) return;
    setFailedSourceState((current) => {
      const previousFailures =
        current.sourceKey === sourceKey ? current.failedSources : [];
      if (previousFailures.includes(imageUri)) return current;
      return {
        sourceKey,
        failedSources: [...previousFailures, imageUri],
      };
    });
  };

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size * 0.28 }]}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{ width: size * 0.78, height: size * 0.78 }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={120}
          onError={handleImageError}
        />
      ) : (
        <Ionicons name={iconName} size={size * 0.48} color="#084424" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E1D8',
  },
});
