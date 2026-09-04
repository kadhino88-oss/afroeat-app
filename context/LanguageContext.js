import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import i18n, { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../i18n';

/**
 * =========================================================
 * LANGUAGE CONTEXT — AFROEAT
 * =========================================================
 * Gere la langue active de l'application :
 * 1. Au demarrage, lit la langue sauvegardee (AsyncStorage).
 * 2. Si aucune langue sauvegardee, detecte la langue du
 *    telephone (expo-localization) et prend la premiere
 *    langue supportee correspondante, sinon fr par defaut.
 * 3. Expose setLanguage() pour le selecteur (ex: profil),
 *    qui met a jour i18next ET persiste le choix.
 *
 * 6 langues supportees, demande explicite du fondateur :
 * francais, anglais, allemand, espagnol, italien, chinois.
 */

const STORAGE_KEY = '@afroeat_language';

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  isReady: false,
  supportedLanguages: SUPPORTED_LANGUAGES,
});

const detectDeviceLanguage = () => {
  try {
    const locales = Localization.getLocales?.() || [];
    for (const locale of locales) {
      const code = (locale?.languageCode || '').toLowerCase();
      if (SUPPORTED_LANGUAGES.includes(code)) {
        return code;
      }
    }
  } catch (error) {
    console.log('Erreur detection langue appareil :', error);
  }
  return DEFAULT_LANGUAGE;
};

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      let nextLanguage = DEFAULT_LANGUAGE;
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
          nextLanguage = saved;
        } else {
          nextLanguage = detectDeviceLanguage();
        }
      } catch (error) {
        console.log('Erreur lecture langue sauvegardee :', error);
        nextLanguage = detectDeviceLanguage();
      }

      if (isMounted) {
        await i18n.changeLanguage(nextLanguage);
        setLanguageState(nextLanguage);
        setIsReady(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (nextLanguage) => {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage)) {
      return;
    }
    await i18n.changeLanguage(nextLanguage);
    setLanguageState(nextLanguage);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, nextLanguage);
    } catch (error) {
      console.log('Erreur sauvegarde langue :', error);
    }
  }, []);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      isReady,
      supportedLanguages: SUPPORTED_LANGUAGES,
    }),
    [language, setLanguage, isReady]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
