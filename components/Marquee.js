import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import useReduceMotion from '../hooks/use-reduce-motion';

/**
 * Bandeau défilant en boucle (sans coupure) : le contenu est dessiné deux fois et glisse
 * d'exactement sa largeur. Immobile si « réduire les animations » est activé.
 *   items      : tableau d'éléments ; renderItem(item, index) → élément React
 *   speed      : pixels par seconde
 */
export default function Marquee({ items, renderItem, speed = 36, gap = 10, style }) {
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const { width: windowWidth } = useWindowDimensions();
  const [translateX] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion || !width) return undefined;
    translateX.setValue(0);
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: -width,
        duration: Math.max(1000, (width / speed) * 1000),
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, width, speed, translateX]);

  // Assez de copies pour couvrir la fenêtre (grands écrans compris) ; plafonné pour éviter tout emballement.
  const copies = width > 0 ? Math.min(6, Math.ceil(windowWidth / width) + 1) : 2;

  const row = (suffix, onLayout) => (
    <View
      key={suffix}
      onLayout={onLayout}
      style={[styles.row, { gap, paddingRight: gap }]}
    >
      {items.map((item, index) => (
        <React.Fragment key={`${suffix}-${index}`}>{renderItem(item, index)}</React.Fragment>
      ))}
    </View>
  );

  return (
    <View style={[styles.clip, style]} pointerEvents="none">
      <Animated.View style={[styles.track, { transform: [{ translateX }] }]}>
        {row('a', (event) => setWidth(event.nativeEvent.layout.width))}
        {Array.from({ length: copies - 1 }, (_, index) => row(`copy-${index}`))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', width: '100%', maxWidth: '100%', minWidth: 0 },
  track: { flexDirection: 'row', alignSelf: 'flex-start', flexShrink: 0 },
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
});
