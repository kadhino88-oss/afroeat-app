import React, { useMemo, useState } from 'react';
import {
  Animated,
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const getVariantStyles = (variant) => {
  switch (normalizeText(variant, 'primary').toLowerCase()) {
    case 'secondary':
      return {
        container: styles.secondaryButton,
        text: styles.secondaryText,
        icon: '#084424',
        loader: '#084424',
      };

    case 'dark':
      return {
        container: styles.darkButton,
        text: styles.darkText,
        icon: '#FFFFFF',
        loader: '#FFFFFF',
      };

    case 'danger':
      return {
        container: styles.dangerButton,
        text: styles.dangerText,
        icon: '#FFFFFF',
        loader: '#FFFFFF',
      };

    case 'ghost':
      return {
        container: styles.ghostButton,
        text: styles.ghostText,
        icon: '#0D1C11',
        loader: '#0D1C11',
      };

    case 'primary':
    default:
      return {
        container: styles.primaryButton,
        text: styles.primaryText,
        icon: '#0D1C11',
        loader: '#0D1C11',
      };
  }
};

export default function PremiumButton({
  title,
  onPress,
  style,
  textStyle,
  disabled = false,
  loading = false,
  variant = 'primary',
  iconName = '',
  iconPosition = 'left',
  fullWidth = true,
  small = false,
}) {
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const isDisabled = Boolean(disabled || loading);
  const variantStyles = useMemo(() => getVariantStyles(variant), [variant]);
  const safeTitle = useMemo(() => normalizeText(title, 'Continuer'), [title]);

  const handlePressIn = () => {
    if (isDisabled) return;

    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 35,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        fullWidth && styles.fullWidth,
        { transform: [{ scale: scaleAnim }] },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.buttonBase,
          variantStyles.container,
          small && styles.buttonSmall,
          isDisabled && styles.buttonDisabled,
          pressed && !isDisabled && styles.buttonPressed,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={variantStyles.loader} />
        ) : (
          <View style={styles.contentRow}>
            {!!iconName && iconPosition !== 'right' ? (
              <Ionicons
                name={iconName}
                size={18}
                color={variantStyles.icon}
                style={styles.leftIcon}
              />
            ) : null}

            <Text
              style={[
                styles.textBase,
                variantStyles.text,
                small && styles.textSmall,
                textStyle,
              ]}
            >
              {safeTitle}
            </Text>

            {!!iconName && iconPosition === 'right' ? (
              <Ionicons
                name={iconName}
                size={18}
                color={variantStyles.icon}
                style={styles.rightIcon}
              />
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
  },

  fullWidth: {
    width: '100%',
  },

  buttonBase: {
    minHeight: 54,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },

  buttonSmall: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
  },

  primaryButton: {
    backgroundColor: '#EAB02F',
    borderColor: '#EAB02F',
  },

  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E3F0E8',
  },

  darkButton: {
    backgroundColor: '#0D1C11',
    borderColor: '#0D1C11',
  },

  dangerButton: {
    backgroundColor: '#C8331A',
    borderColor: '#C8331A',
  },

  ghostButton: {
    backgroundColor: 'transparent',
    borderColor: '#E3DECF',
    shadowOpacity: 0,
    elevation: 0,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonPressed: {
    opacity: 0.9,
  },

  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  textBase: {
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },

  textSmall: {
    fontSize: 14,
  },

  primaryText: {
    color: '#0D1C11',
  },

  secondaryText: {
    color: '#084424',
  },

  darkText: {
    color: '#FFFFFF',
  },

  dangerText: {
    color: '#FFFFFF',
  },

  ghostText: {
    color: '#0D1C11',
  },

  leftIcon: {
    marginRight: 8,
  },

  rightIcon: {
    marginLeft: 8,
  },
});
