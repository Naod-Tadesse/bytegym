import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/i18n/locales/en/common.json';

/**
 * Single source of truth for every language the app ships. `supportedLngs` and
 * any future language picker both derive from this, so they cannot drift.
 */
export const SUPPORTED_LANGUAGES = [{ code: 'en', label: 'English' }] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

/** Namespace name matches the filename — do not let these drift apart. */
export const defaultNS = 'common';

/**
 * Statically bundled. No backend, no CDN, no network at runtime.
 * Do NOT annotate this with i18next's `Resource` type — i18next.d.ts reads
 * `typeof resources`, and an i18next-typed annotation creates a real cycle.
 */
export const resources = {
  en: { common: en },
};

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES.map((language) => language.code),
  ns: [defaultNS],
  defaultNS,
  interpolation: {
    // React already escapes interpolated values.
    escapeValue: false,
  },
  debug: import.meta.env.DEV,
});

export default i18n;
