import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

// Affiche UNIQUEMENT la photo propre au commerce ou au plat.
// Sans photo : fond neutre et icône, jamais une photo d'illustration trompeuse.
export default function OwnImage({ uri, style, icon = 'restaurant-outline', iconSize = 28 }) {
  const cleanUri = typeof uri === 'string' ? uri.trim() : '';

  if (cleanUri) {
    return (
      <Image
        source={{ uri: cleanUri }}
        style={style}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={160}
      />
    );
  }

  return (
    <View style={[style, styles.placeholder]}>
      <Ionicons name={icon} size={iconSize} color="#606D5D" />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1C11',
  },
});
