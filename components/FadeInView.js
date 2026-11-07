import React, { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

export default function FadeInView({
  children,
  style,
  duration = 500,
  delay = 0,
  translateY = 12,
}) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translate] = useState(() => new Animated.Value(translateY));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [duration, delay, opacity, translate]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY: translate }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
