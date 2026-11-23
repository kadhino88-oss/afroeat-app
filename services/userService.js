import { apiDelete, apiGet, apiPost } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

/**
 * =========================================================
 * USER SERVICE
 * =========================================================
 * Gestion des actions liées aux utilisateurs
 * =========================================================
 */

export const deleteMyAccount = async (password, token) => {
  const response = await apiDelete(API_ENDPOINTS.auth.deleteAccount, token, {
    body: { password, confirmation: true },
    isJson: true,
  });

  return response?.data || response;
};

/** Carnet d'adresses de livraison du client (5 maximum). */
export const listMyAddresses = async (token) => {
  const response = await apiGet(API_ENDPOINTS.auth.addresses, token);
  return Array.isArray(response?.addresses) ? response.addresses : [];
};

export const saveMyAddress = async ({ address, label = '', isDefault = false }, token) => {
  const response = await apiPost(API_ENDPOINTS.auth.addresses, { address, label, isDefault }, token);
  return Array.isArray(response?.addresses) ? response.addresses : [];
};

export const removeMyAddress = async (id, token) => {
  const response = await apiDelete(`${API_ENDPOINTS.auth.addresses}/${encodeURIComponent(id)}`, token);
  return Array.isArray(response?.addresses) ? response.addresses : [];
};
