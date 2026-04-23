import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const normalizeRole = (value) => {
  const role = String(value || 'client').trim().toLowerCase();

  if (role === 'restaurant') {
    return 'restaurant';
  }

  if (role === 'livreur' || role === 'driver' || role === 'delivery') {
    return 'livreur';
  }

  return 'client';
};

/**
 * =========================================================
 * SCREEN
 * =========================================================
 * Ce fichier garde la compatibilité avec les anciens appels
 * vers /auth/register tout en redirigeant vers le bon écran
 * d’inscription spécialisé par rôle.
 */

export default function RegisterRedirectScreen() {
  const params = useLocalSearchParams();

  const rawRole = Array.isArray(params?.role) ? params.role[0] : params?.role;
  const role = normalizeRole(rawRole);

  if (role === 'restaurant') {
    return <Redirect href="/auth/register-restaurant" />;
  }

  if (role === 'livreur') {
    return <Redirect href="/auth/register-driver" />;
  }

  return <Redirect href="/auth/register-client" />;
}