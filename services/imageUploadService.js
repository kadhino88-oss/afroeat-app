import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { apiPost } from './apiClient';
import { API_ENDPOINTS } from '../constants/api';

// Le serveur refuse au-delà de 900 Ko ; le base64 pèse ~4/3 du binaire.
const MAX_BASE64_LENGTH = 1_150_000;
const ATTEMPTS = [
  { width: 1000, compress: 0.7 },
  { width: 800, compress: 0.55 },
  { width: 600, compress: 0.45 },
];

export class ImageUploadError extends Error {
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
  throw new ImageUploadError('TOO_LARGE');
};

/**
 * Ouvre la galerie, réduit l'image, l'envoie au serveur et renvoie son URL.
 * Renvoie null si l'utilisateur annule.
 */
export const pickAndUploadImage = async (token, { aspect = [4, 3] } = {}) => {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission?.granted) throw new ImageUploadError('PERMISSION');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect,
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;

  const dataUrl = await compress(result.assets[0].uri);
  try {
    const response = await apiPost(API_ENDPOINTS.images.upload, { dataUrl }, token);
    if (!response?.url) throw new ImageUploadError('UPLOAD');
    return response.url;
  } catch (error) {
    if (error instanceof ImageUploadError) throw error;
    throw new ImageUploadError('UPLOAD', error?.message);
  }
};
