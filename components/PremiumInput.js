import React, { useMemo, useState } from 'react';
import {
  TextInput,
  Animated,
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

export default function PremiumInput({
  label = '',
  placeholder = '',
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline = false,
  numberOfLines = 1,
  error = '',
  iconName = '',
  editable = true,
  style,
  inputStyle,
  maxLength,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [borderAnim] = useState(() => new Animated.Value(0));

  const safeLabel = useMemo(() => normalizeText(label), [label]);
  const safePlaceholder = useMemo(
    () => normalizeText(placeholder),
    [placeholder]
  );
  const safeError = useMemo(() => normalizeText(error), [error]);

  const animateTo = (toValue) => {
    Animated.timing(borderAnim, {
      toValue,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  const handleFocus = () => {
    setIsFocused(true);
    animateTo(1);
  };

  const handleBlur = () => {
    setIsFocused(false);
    animateTo(0);
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      safeError ? '#D97B7B' : '#E8DED2',
      safeError ? '#C8331A' : '#EAB02F',
    ],
  });

  const backgroundColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', '#FFFDF8'],
  });

  return (
    <View style={[styles.wrapper, style]}>
      {!!safeLabel && <Text style={styles.label}>{safeLabel}</Text>}

      <Animated.View
        style={[
          styles.container,
          {
            borderColor,
            backgroundColor,
          },
          !editable && styles.containerDisabled,
          multiline && styles.containerMultiline,
        ]}
      >
        {!!iconName && (
          <View style={styles.iconWrap}>
            <Ionicons
              name={iconName}
              size={18}
              color={isFocused ? '#EAB02F' : '#8B8176'}
            />
          </View>
        )}

        <TextInput
          style={[
            styles.input,
            !!iconName && styles.inputWithIcon,
            multiline && styles.inputMultiline,
            !editable && styles.inputDisabled,
            inputStyle,
          ]}
          placeholder={safePlaceholder}
          placeholderTextColor="#A39A90"
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          maxLength={maxLength}
        />
      </Animated.View>

      {!!safeError && <Text style={styles.errorText}>{safeError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },

  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#5F554C',
    marginBottom: 8,
  },

  container: {
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  containerMultiline: {
    alignItems: 'flex-start',
    paddingTop: 14,
    paddingBottom: 8,
  },

  containerDisabled: {
    opacity: 0.75,
    backgroundColor: '#F8F4EE',
  },

  iconWrap: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: '#0D1C11',
    paddingVertical: 14,
    fontWeight: '600',
  },

  inputWithIcon: {
    paddingLeft: 0,
  },

  inputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
    paddingTop: 0,
  },

  inputDisabled: {
    color: '#7E746A',
  },

  errorText: {
    marginTop: 8,
    color: '#C8331A',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
});
