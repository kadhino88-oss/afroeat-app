import React, { useMemo } from 'react';
import { Stack, Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeRole = (value) => normalizeText(value).toLowerCase();

const normalizeStatus = (value) => normalizeText(value).toLowerCase();

const isAdminRole = (role) => {
  return (
    role === 'admin' ||
    role === 'administrator' ||
    role === 'superadmin' ||
    role === 'super-admin'
  );
};

const isDriverRole = (role) => {
  return role === 'livreur' || role === 'driver' || role === 'delivery';
};

const getRestaurantStatus = (user) => {
  return normalizeStatus(
    user?.accountStatus ||
      user?.status ||
      user?.approvalStatus ||
      user?.restaurantStatus ||
      ''
  );
};

/**
 * =========================================================
 * LAYOUT
 * =========================================================
 *
 * RÈGLE : les noms déclarés dans Stack.Screen doivent
 * correspondre EXACTEMENT aux fichiers physiques présents
 * dans app/restaurant/
 *
 * Fichiers réels :
 *   RestaurantDashboard.js, restaurant-profile.js
 *   MenuScreen.js, AddMenuItem.js, EditMenuItem.js
 *   restaurant-orders.js, restaurant-analytics.js
 *   restaurant-settings.js, [id].js
 *   restaurant-orders-details/[id].js
 */

export default function RestaurantLayout() {
  const auth = useAuth() || {};

  const user = auth.user ?? null;
  const role = auth.role;
  const token = auth.token;
  const loading = Boolean(auth.loading);
  const isAuthenticated = Boolean(auth.isAuthenticated);

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role);
  }, [role, user]);

  const currentStatus = useMemo(() => {
    return getRestaurantStatus(user);
  }, [user]);

  const hasValidSession = Boolean(isAuthenticated && token);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#084424" />
      </View>
    );
  }

  // Les visiteurs non connectés peuvent voir la page restaurant/[id]
  if (!hasValidSession) {
    const isViewingRestaurantDetail =
      typeof window !== 'undefined'
        ? false
        : false; // expo-router gère ça via le Stack ci-dessous

    // Si pas de session ET rôle restaurant demandé → login
    if (currentRole === 'restaurant') {
      return (
        <Redirect
          href={{ pathname: '/auth/login', params: { role: 'restaurant' } }}
        />
      );
    }

    // Visiteur → peut voir la page detail [id] uniquement
    return (
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#FBF6EC' },
        }}
      >
        <Stack.Screen name="[id]" />
      </Stack>
    );
  }

  if (currentRole !== 'restaurant') {
    if (isAdminRole(currentRole)) {
      return <Redirect href="/admin" />;
    }

    if (isDriverRole(currentRole)) {
      return <Redirect href="/livraison" />;
    }

    // ✅ Les clients (et visiteurs) peuvent accéder à /restaurant/[id]
    // pour voir le menu et commander. On ne redirige PAS.
    // Seules les pages de gestion (dashboard, menu, orders) sont protégées.
    return (
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#FBF6EC' },
        }}
      >
        <Stack.Screen name="[id]" />
      </Stack>
    );
  }

  if (
    currentStatus === 'pending' ||
    currentStatus === 'pending_verification' ||
    currentStatus === 'submitted' ||
    currentStatus === 'draft'
  ) {
    return (
      <Redirect
        href={{ pathname: '/auth/pending-approval', params: { role: 'restaurant' } }}
      />
    );
  }

  if (
    currentStatus &&
    currentStatus !== 'approved' &&
    currentStatus !== 'active'
  ) {
    return <Redirect href="/auth/role" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#FBF6EC' },
      }}
    >
      {/* ================================================= */}
      {/* Noms exacts des fichiers physiques dans restaurant/ */}
      {/* ================================================= */}
      <Stack.Screen name="RestaurantDashboard" />
      <Stack.Screen name="restaurant-profile" />
      <Stack.Screen name="restaurant-settings" />
      <Stack.Screen name="delivery-settings" />
      <Stack.Screen name="restaurant-analytics" />
      <Stack.Screen name="MenuScreen" />
      <Stack.Screen name="AddMenuItem" />
      <Stack.Screen name="EditMenuItem" />
      <Stack.Screen name="restaurant-orders" />
      <Stack.Screen name="restaurant-orders-details/[id]" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#FBF6EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
});