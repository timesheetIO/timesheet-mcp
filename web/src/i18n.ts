/**
 * i18n Configuration
 * Detects locale from OpenAI SDK and loads appropriate translations
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';
import deTranslations from './locales/de.json';

// Get locale from OpenAI SDK
const getOpenAILocale = (): string => {
  if (typeof window !== 'undefined' && window.openai?.locale) {
    return window.openai.locale;
  }
  return 'en'; // Default to English
};

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations,
      },
      de: {
        translation: deTranslations,
      },
      // Add more languages here as needed
      // fr: { translation: frTranslations },
      // es: { translation: esTranslations },
    },
    lng: getOpenAILocale(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

// Update language when OpenAI locale changes
if (typeof window !== 'undefined') {
  // Listen for locale changes from OpenAI SDK
  const originalSetGlobals = window.openai?.setWidgetState;
  if (originalSetGlobals) {
    window.openai.setWidgetState = function(...args) {
      const result = originalSetGlobals.apply(this, args);
      const newLocale = getOpenAILocale();
      if (newLocale !== i18n.language) {
        i18n.changeLanguage(newLocale);
      }
      return result;
    };
  }
}

export default i18n;
