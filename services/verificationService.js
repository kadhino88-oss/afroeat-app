import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { apiGet, apiPost, apiPatch, apiDelete } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

// Le serveur refuse au-delà de 900 Ko. Une pièce d'identité doit rester lisible : on garde
// une définition plus élevée que pour une photo de plat.
const MAX_BASE64_LENGTH = 1_150_000;
const ATTEMPTS = [
  { width: 1500, compress: 0.7 },
  { width: 1300, compress: 0.6 },
  { width: 1100, compress: 0.5 },
];

export class VerificationUploadError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const compress = async (uri) => {
  for (const attempt of ATTEMPTS) {
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: attempt.width } }],
      { compress: attempt.compress, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (out?.base64 && out.base64.length <= MAX_BASE64_LENGTH) {
      return `data:image/jpeg;base64,${out.base64}`;
    }
  }
  throw new VerificationUploadError('TOO_LARGE');
};

export const getMyVerification = async (token) => apiGet(API_ENDPOINTS.verification.me, token);

/**
 * Choisit une photo (galerie ou appareil), la réduit et l'envoie chiffrée au serveur.
 * `consent` doit être vrai : le partenaire a accepté le traitement de sa pièce.
 * Renvoie null si la personne annule.
 */
export const pickAndUploadDocument = async (token, kind, consent) => {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission?.granted) throw new VerificationUploadError('PERMISSION');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;

  const dataUrl = await compress(result.assets[0].uri);
  const response = await apiPost(
    API_ENDPOINTS.verification.documents,
    { kind, dataUrl, consent: consent === true },
    token
  );
  return response?.document || null;
};

export const deleteMyDocument = async (id, token) =>
  apiDelete(API_ENDPOINTS.verification.documentById(id), token);

/* ADMIN */
export const listVerificationDocuments = async (status, token) => {
  const response = await apiGet(API_ENDPOINTS.verification.adminList(status), token);
  return Array.isArray(response?.items) ? response.items : [];
};

export const getVerificationFile = async (id, token) => {
  const response = await apiGet(API_ENDPOINTS.verification.adminFile(id), token);
  return response?.dataUrl || '';
};

export const reviewVerificationDocument = async (id, decision, reason, token) =>
  apiPatch(API_ENDPOINTS.verification.adminReview(id), { decision, reason }, token);
