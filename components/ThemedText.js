import React from 'react';
import { Text, StyleSheet } from 'react-native';
import FadeInView from './FadeInView';

export function ThemedText({ children, style, ...props }) {
  return (
    <FadeInView duration={400}>
      <Text style={[styles.text, style]} {...props}>
        {children}
      </Text>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#111',
    fontSize: 16,
    fontWeight: '500',
  },
});