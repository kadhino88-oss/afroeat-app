import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import fr from './locales/fr.json';
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import it from './locales/it.json';
import zh from './locales/zh.json';

/**
 * =========================================================
 * I18N — AFROEAT
 * =========================================================
 * 6 langues supportees : fr, en, de, es, it, zh.
 * La langue effective est pilotee par context/LanguageContext.js
 * (detection auto + persistance AsyncStorage). Ce module se
 * contente d'initialiser i18next avec 'fr' par defaut ; la
 * langue reelle est appliquee au demarrage de l'app.
 */

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'de', 'es', 'it', 'zh'];
export const DEFAULT_LANGUAGE = 'fr';

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  de: { translation: de },
  es: { translation: es },
  it: { translation: it },
  zh: { translation: zh },
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    compatibilityJSON: 'v4',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
}

export default i18n;
