import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { updateMyProfile } from './authService';

/**
 * =========================================================
 * NOTIFICATION SERVICE — AFROEAT
 * =========================================================
 *
 * Gère l'enregistrement de l'appareil pour les notifications
 * push Expo, et la synchronisation du token avec le backend
 * (PUT /users/me, champ pushToken).
 *
 * Utilisation : appelé depuis app/_layout.js dès qu'un
 * utilisateur est authentifié (voir usePushNotificationsSync).
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Demande la permission notifications et retourne le token
 * push Expo de l'appareil, ou null si indisponible/refusé.
 */
export const registerForPushNotificationsAsync = async () => {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B00',
      });
    }

    if (!Device.isDevice) {
      console.log(
        'Notifications push indisponibles : nécessite un appareil physique.'
      );
      return null;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permission notifications refusée par l’utilisateur.');
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      null;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    return tokenResponse?.data || null;
  } catch (error) {
    console.log('Erreur registerForPushNotificationsAsync :', error);
    return null;
  }
};

/**
 * Envoie le token push au backend pour qu'il soit stocké sur
 * le profil utilisateur (User.pushToken).
 */
export const syncPushTokenWithBackend = async (pushToken, authToken) => {
  try {
    if (!pushToken || !authToken) {
      return false;
    }

    await updateMyProfile({ pushToken }, authToken);
    return true;
  } catch (error) {
    console.log('Erreur syncPushTokenWithBackend :', error);
    return false;
  }
};

/**
 * Enchaîne l'enregistrement + la synchronisation en un seul appel.
 * Ne lève jamais — un échec de notifications ne doit jamais
 * bloquer l'usage de l'app.
 */
export const setupPushNotifications = async (authToken) => {
  const pushToken = await registerForPushNotificationsAsync();

  if (pushToken) {
    await syncPushTokenWithBackend(pushToken, authToken);
  }

  return pushToken;
};
