import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Vrai si la personne a demandé « réduire les animations » dans les réglages de son appareil. */
export default function useReduceMotion() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => {
        if (active) setReduce(Boolean(value));
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (value) =>
      setReduce(Boolean(value))
    );
    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, []);

  return reduce;
}
