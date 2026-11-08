import { Alert, Platform } from 'react-native';

/**
 * Sur le web, Alert.alert de React Native ne fait rien : les messages d'erreur
 * (champ manquant, mot de passe trop faible…) restaient invisibles. On le remplace
 * par les boîtes du navigateur. Sur iOS / Android, rien ne change.
 */
export const showWebAlert = (title, message, buttons) => {
  const text = [title, message].filter(Boolean).join('\n\n');
  const list = Array.isArray(buttons) ? buttons : [];

  if (list.length <= 1) {
    window.alert(text);
    if (typeof list[0]?.onPress === 'function') list[0].onPress();
    return;
  }

  const cancel = list.find((button) => button?.style === 'cancel');
  const action = list.find((button) => button !== cancel) || list[0];
  const accepted = window.confirm(text);
  const chosen = accepted ? action : cancel;
  if (typeof chosen?.onPress === 'function') chosen.onPress();
};

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = showWebAlert;
}
