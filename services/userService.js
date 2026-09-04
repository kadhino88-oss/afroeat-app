import apiClient from './apiClient';

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