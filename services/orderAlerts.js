import { Platform, Vibration } from 'react-native';

/**
 * Alertes « nouvelle commande / nouvelle course » dans l'appli ouverte, comme les tablettes
 * Uber Eats : sonnerie, vibration, notification du navigateur et titre d'onglet qui clignote.
 * Les notifications push (appli fermée) sont envoyées par l'API.
 */
let audioContext = null;

const getAudioContext = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  return audioContext;
};

/** À appeler sur un geste de l'utilisateur (clic) : les navigateurs bloquent le son sinon. */
export const unlockAlertSound = () => {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
};

/** Sonnerie courte en trois notes, bien audible en cuisine. */
export const playAlertSound = () => {
  if (Platform.OS !== 'web') {
    Vibration.vibrate([0, 400, 200, 400]);
    return;
  }
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const notes = [880, 1175, 1568];
  notes.forEach((freq, i) => {
    const start = ctx.currentTime + i * 0.22;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.21);
  });
};

export const requestBrowserNotifications = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission === 'default') window.Notification.requestPermission().catch?.(() => {});
};

export const showBrowserNotification = (title, body) => {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission !== 'granted') return;
  try {
    const n = new window.Notification(title, { body, tag: 'afroeat-alert', renotify: true });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Certains navigateurs mobiles n'autorisent les notifications que via un service worker.
  }
};

let titleTimer = null;
let baseTitle = '';

/** Fait clignoter le titre de l'onglet tant que l'alerte n'est pas vue. */
export const flashTabTitle = (message) => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (titleTimer) return;
  baseTitle = document.title;
  let on = false;
  titleTimer = setInterval(() => {
    on = !on;
    document.title = on ? message : baseTitle;
  }, 1000);
};

export const stopTabTitle = () => {
  if (!titleTimer || typeof document === 'undefined') return;
  clearInterval(titleTimer);
  titleTimer = null;
  document.title = baseTitle;
};

/** Renvoie les identifiants apparus depuis la dernière liste (le premier chargement ne sonne pas). */
export const createNewIdsTracker = () => {
  let known = null;
  return (ids) => {
    const list = ids.map(String);
    if (known === null) {
      known = new Set(list);
      return [];
    }
    const fresh = list.filter((id) => !known.has(id));
    known = new Set(list);
    return fresh;
  };
};
