import apiClient, { apiDelete } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

/**
 * =========================================================
 * USER SERVICE
 * =========================================================
 * Gestion des actions liées aux utilisateurs
 * =========================================================
 */

export const registerUser = async (payload) => {
  try {
    const response = await apiClient.post('/users/register', payload);

    return response?.data || response;
  } catch (error) {
    console.log('REGISTER USER ERROR =>', error);

    throw new Error(
      error?.response?.data?.message ||
      error?.message ||
      "Erreur lors de l'inscription"
    );
  }
};

export const deleteMyAccount = async (password, token) => {
  const response = await apiDelete(API_ENDPOINTS.auth.deleteAccount, token, {
    body: { password, confirmation: true },
    isJson: true,
  });

  return response?.data || response;
};
