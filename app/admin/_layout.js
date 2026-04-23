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

const isRestaurantRole = (role) => {
  return role === 'restaurant' || role === 'restaurateur';
};

const getAccountStatus = (user) => {
  return normalizeStatus(
    user?.accountStatus ||
      user?.status ||
      user?.approvalStatus ||
      user?.adminStatus ||
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
 * dans app/admin/
 *
 * Fichiers réels :
 *   index.js, AdminDashboard.js, ops.js
 *   users.js, restaurants.js, drivers.js
 *   orders.js, audit-logs.js
 *   users-details/[id].js, restaurants-details/[id].js
 *   drivers-details/[id].js, orders-details/[id].js
 *   audit-log-details/[id].js
 */

export default function AdminLayout() {
  const auth = useAuth() || {};

  const user = auth.user ?? null;
  const role = auth.role;
  const token = auth.token;
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const loading = Boolean(auth.loading);

  const currentRole = useMemo(() => {
    return normalizeRole(role || user?.role);
  }, [role, user]);

  const currentStatus = useMemo(() => {
    return getAccountStatus(user);
  }, [user]);

  const hasValidSession = Boolean(isAuthenticated && token);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#5A32A3" />
      </View>
    );
  }

  if (!hasValidSession) {
    return (
      <Redirect
        href={{ pathname: '/auth/login', params: { role: 'admin' } }}
      />
    );
  }

  if (!isAdminRole(currentRole)) {
    if (isRestaurantRole(currentRole)) {
      return <Redirect href="/restaurant/RestaurantDashboard" />;
    }

    if (isDriverRole(currentRole)) {
      return <Redirect href="/livraison" />;
    }

    return <Redirect href="/(tabs)" />;
  }

  if (
    currentStatus === 'pending' ||
    currentStatus === 'pending_verification' ||
    currentStatus === 'submitted'
  ) {
    return (
      <Redirect
        href={{ pathname: '/auth/pending-approval', params: { role: 'admin' } }}
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
        contentStyle: { backgroundColor: '#F7F4FB' },
      }}
    >
      {/* ================================================= */}
      {/* Noms exacts des fichiers physiques dans admin/     */}
      {/* ================================================= */}
      <Stack.Screen name="index" />
      <Stack.Screen name="AdminDashboard" />
      <Stack.Screen name="ops" />

      {/* Blocs principaux */}
      <Stack.Screen name="users" />
      <Stack.Screen name="restaurants" />
      <Stack.Screen name="drivers" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="audit-logs" />

      {/* Détails */}
      <Stack.Screen name="users-details/[id]" />
      <Stack.Screen name="restaurants-details/[id]" />
      <Stack.Screen name="drivers-details/[id]" />
      <Stack.Screen name="orders-details/[id]" />
      <Stack.Screen name="audit-log-details/[id]" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#F7F4FB',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
