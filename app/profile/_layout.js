import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeRole = (role) => {
  const normalized = String(role ?? 'client').trim().toLowerCase();

  if (normalized === 'restaurant' || normalized === 'resto') {
    return 'restaurant';
  }

  if (
    normalized === 'livreur' ||
    normalized === 'driver' ||
    normalized === 'delivery' ||
    normalized === 'courier'
  ) {
    return 'livreur';
  }

  if (
    normalized === 'admin' ||
    normalized === 'administrator' ||
    normalized === 'superadmin'
  ) {
    return 'admin';
  }

  return 'client';
};

const getRoleRedirect = (role) => {
  const normalized = normalizeRole(role);

  if (normalized === 'restaurant') {
    return '/restaurant/RestaurantDashboard';
  }

  if (normalized === 'livreur') {
    return '/livraison';
  }

  if (normalized === 'admin') {
    return '/admin';
  }

  return null;
};

/**
 * =========================================================
 * PROFILE SUB-ROUTES LAYOUT
 * =========================================================
 * Ce layout gère toutes les sous-pages du compte client :
 * - /profile
 * - /profile/info
 * - /profile/address
 * - /profile/payment
 * - /profile/help
 *
 * IMPORTANT :
 * - réservé au bloc client
 * - restaurant / livreur / admin interdits
 * - navigation stable et isolée
 */

export default function ProfileLayout() {
  const auth = useAuth() || {};

  const loading = Boolean(auth.loading);
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const user = auth.user ?? null;
  const role = normalizeRole(auth.role || user?.role);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#EAB02F" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/role" />;
  }

  const roleRedirect = getRoleRedirect(role);

  if (roleRedirect) {
    return <Redirect href={roleRedirect} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: styles.scene,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="info" />
      <Stack.Screen name="address" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="help" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#F2ECE0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  scene: {
    backgroundColor: '#F2ECE0',
  },
});