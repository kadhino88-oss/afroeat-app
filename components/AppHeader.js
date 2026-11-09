import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCart } from '../context/CartContext';

export default function AppHeader({ showCart = true }) {
  const { getTotalItems } = useCart();

  const cartCount =
    typeof getTotalItems === 'function' ? getTotalItems() : 0;

  return (
    <View style={styles.container}>
      {/* LOGO */}
      <Pressable onPress={() => router.push('/(tabs)/explore')}>
        <Image
          source={require('../assets/images/icon.png')}
          style={styles.logo}
        />
      </Pressable>

      {/* RIGHT SIDE */}
      {showCart && (
        <Pressable
          style={styles.cart}
          onPress={() => router.push('/cart')}
        >
          <Ionicons name="cart-outline" size={22} color="#111" />

          {cartCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{cartCount}</Text>
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 70,
    paddingHorizontal: 16,
    backgroundColor: '#FBF6EC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  logo: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },

  cart: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF3D8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EAB02F',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },

  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
  },
});