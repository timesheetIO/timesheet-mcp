/**
 * i18n Configuration
 * Detects locale from MCP App host context and loads appropriate translations
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';
import deTranslations from './locales/de.json';

// Get locale from browser (MCP Apps provides locale via host context,
// which is applied reactively via McpAppProvider/useHostStyles)
const getInitialLocale = (): string => {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.split('-')[0];
  }
  return 'en';
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
    },
    lng: getInitialLocale(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;

/**
 * Update i18n language from MCP App host context locale.
 * Call this when the host context changes.
 */
export function updateLocaleFromHostContext(locale?: string) {
  if (locale) {
    const lang = locale.split('-')[0];
    if (lang !== i18n.language) {
      i18n.changeLanguage(lang);
    }
  }
}
