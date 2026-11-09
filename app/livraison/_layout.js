import React, { useMemo } from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

const getDriverStatus = (user, auth) => {
  return normalizeStatus(
    user?.accountStatus ||
      user?.status ||
      user?.approvalStatus ||
      user?.driverStatus ||
      auth?.status ||
      ''
  );
};

const isDriverRole = (role) => {
  return (
    role === 'livreur' ||
    role === 'driver' ||
    role === 'delivery'
  );
};

/**
 * =========================================================
 * LAYOUT
 * =========================================================
 *
 * RÈGLE : les noms déclarés dans Stack.Screen doivent
 * correspondre EXACTEMENT aux fichiers physiques présents
 * dans app/livraison/
 *
 * Fichiers réels :
 *   index.js, orders.js, history.js, profile.js
 *   OrderTracking.js, [id].js
 */

export default function DriverLayout() {
  const auth = useAuth() || {};

  const user = auth.user ?? null;
  const role = auth.role;
  const loading = Boolean(auth.loading);
  const isAuthenticated = Boolean(auth.isAuthenticated);

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role);
  }, [role, user]);

  const currentStatus = useMemo(() => {
    return getDriverStatus(user, auth);
  }, [user, auth]);

  /**
   * LOADING
   */
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#C8331A" />
      </View>
    );
  }

  /**
   * AUTH GUARD
   */
  if (!isAuthenticated) {
    return (
      <Redirect
        href={{ pathname: '/auth/login', params: { role: 'livreur' } }}
      />
    );
  }

  /**
   * ROLE GUARD
   */
  if (!isDriverRole(currentRole)) {
    if (currentRole === 'admin') {
      return <Redirect href="/admin" />;
    }

    if (currentRole === 'restaurant') {
      return <Redirect href="/restaurant/RestaurantDashboard" />;
    }

    return <Redirect href="/(tabs)" />;
  }

  /**
   * STATUS GUARD
   */
  if (
    currentStatus === 'pending' ||
    currentStatus === 'pending_verification' ||
    currentStatus === 'submitted' ||
    currentStatus === 'draft'
  ) {
    return (
      <Redirect
        href={{ pathname: '/auth/pending-approval', params: { role: 'livreur' } }}
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
      {/* Noms exacts des fichiers physiques dans livraison/ */}
      {/* ================================================= */}
      <Stack.Screen name="index" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="history" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="OrderTracking" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}

/**
 * STYLES
 */

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#FBF6EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
