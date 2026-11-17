import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Étoiles de 1 à 5 : modifiables (onChange) ou en lecture seule. */
export default function StarRating({ value = 0, onChange, size = 26, label = '' }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color="#EAB02F" />;
        if (!onChange) return <View key={n}>{icon}</View>;
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${n}/5`}
            accessibilityState={{ selected: n === value }}
            onPress={() => onChange(n)}
            hitSlop={6}
          >
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
}
