import React from 'react';
import { Stack } from 'expo-router';
import { StyleSheet, StatusBar } from 'react-native';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';

/**
 * =========================================================
 * ROOT LAYOUT — AFROEAT
 * =========================================================
 *
 * RÈGLE CRITIQUE expo-router :
 * Le <Stack> doit TOUJOURS être rendu sans condition.
 * Le loading auth est géré dans app/index.js.
 */

function AppStack() {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <Stack
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: styles.scene,
        }}
      >
        {/* ================================================= */}
        {/* ENTRY */}
        {/* ================================================= */}
        <Stack.Screen name="index" />

        {/* ================================================= */}
        {/* AUTH */}
        {/* ================================================= */}
        <Stack.Screen name="auth" />

        {/* ================================================= */}
        {/* NOTIFICATIONS */}
        {/* ================================================= */}
        <Stack.Screen name="notifications" />

        {/* ================================================= */}
        {/* CLIENT TABS */}
        {/* ================================================= */}
        <Stack.Screen name="(tabs)" />

        {/* ================================================= */}
        {/* CLIENT SCREENS */}
        {/* ================================================= */}
        <Stack.Screen name="cart" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="favorites" />
        <Stack.Screen name="map" />
        <Stack.Screen
          name="modal"
          options={{
            presentation: 'modal',
            animation: 'fade_from_bottom',
          }}
        />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="profile" />

        {/* ================================================= */}
        {/* RESTAURANT */}
        {/* ================================================= */}
        <Stack.Screen name="restaurant" />

        {/* ================================================= */}
        {/* LIVRAISON */}
        {/* ================================================= */}
        <Stack.Screen name="livraison" />

        {/* ================================================= */}
        {/* ADMIN */}
        {/* ================================================= */}
        <Stack.Screen name="admin" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppStack />
      </CartProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
});