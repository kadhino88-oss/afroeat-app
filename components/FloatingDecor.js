import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import useReduceMotion from '../hooks/use-reduce-motion';

// Soleils et anneaux aux couleurs de la marque : formes simples qui flottent doucement.
const SHAPES = [
  { size: 120, top: -44, right: -26, color: 'rgba(234,176,47,0.16)', ring: false, drift: 10, ms: 5200 },
  { size: 54, top: 70, right: 52, color: 'rgba(200,51,26,0.16)', ring: true, drift: 7, ms: 4300 },
  { size: 34, top: 28, left: 28, color: 'rgba(8,68,36,0.14)', ring: false, drift: 6, ms: 3900 },
  { size: 78, top: 120, left: -30, color: 'rgba(234,176,47,0.18)', ring: true, drift: 9, ms: 6100 },
];

function Floater({ shape, delay, still }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (still) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: shape.ms,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: shape.ms,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [still, progress, shape.ms, delay]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-shape.drift, shape.drift] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] });

  const position = {
    top: shape.top,
    ...(shape.left !== undefined ? { left: shape.left } : {}),
    ...(shape.right !== undefined ? { right: shape.right } : {}),
  };

  return (
    <Animated.View
      style={[
        styles.shape,
        position,
        {
          width: shape.size,
          height: shape.size,
          borderRadius: shape.size / 2,
          transform: [{ translateY }, { scale }],
        },
        shape.ring
          ? { borderWidth: Math.max(3, shape.size / 12), borderColor: shape.color }
          : { backgroundColor: shape.color },
      ]}
    />
  );
}

/** Décor flottant en arrière-plan d'un en-tête (ne capte aucun toucher). */
export default function FloatingDecor() {
  const reduceMotion = useReduceMotion();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {SHAPES.map((shape, index) => (
        <Floater key={index} shape={shape} delay={index * 350} still={reduceMotion} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shape: { position: 'absolute' },
});
