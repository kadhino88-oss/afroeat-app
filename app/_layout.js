import '../services/webAlert';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StyleSheet, StatusBar } from 'react-native';
import AppStripeProvider from '../components/AppStripeProvider';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import { LanguageProvider } from '../context/LanguageContext';
import { setupPushNotifications } from '../services/notificationService';
import '../i18n';

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
  const { isAuthenticated, token } = useAuth();

  /**
   * =========================================================
   * NOTIFICATIONS PUSH
   * =========================================================
   * Dès qu'un utilisateur est authentifié (login OU session
   * restaurée au démarrage), on demande la permission
   * notifications et on synchronise le token Expo avec le
   * backend. Ne bloque jamais l'app en cas d'échec/refus.
   */
  useEffect(() => {
    if (!isAuthenticated || !token) {
      return;
    }

    let isMounted = true;

    setupPushNotifications(token).catch((error) => {
      if (isMounted) {
        console.log('Erreur setupPushNotifications :', error);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, token]);

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
        <Stack.Screen name="place/[id]" />
        <Stack.Screen name="partner-apply" />

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
    <LanguageProvider>
      <AppStripeProvider>
        <AuthProvider>
          <CartProvider>
            <AppStack />
          </CartProvider>
        </AuthProvider>
      </AppStripeProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
});
