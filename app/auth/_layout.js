import React from 'react';
import { Stack } from 'expo-router';

/**
 * =========================================================
 * AUTH LAYOUT — AFROEAT
 * =========================================================
 * Bloc entièrement dédié à l'authentification + onboarding.
 * Aucun mélange avec les autres blocs métier.
 *
 * RÈGLE : name= doit correspondre EXACTEMENT au fichier physique.
 */

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor: '#FFF8F0',
        },
      }}
    >
      <Stack.Screen name="role" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="register-client" />
      <Stack.Screen name="register-restaurant" />
      <Stack.Screen name="register-driver" />
      {/* ⚠️ nom exact du fichier : pending-approval.js */}
      <Stack.Screen name="pending-approval" />
    </Stack>
  );
}
