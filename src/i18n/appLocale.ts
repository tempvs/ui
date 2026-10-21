import localeEn from "../translations/en.json";

/**
 * The catalogue registry is intentionally explicit. Adding a language later
 * requires adding its catalogue here, rather than accidentally adopting a
 * visitor's browser locale with only partial translations.
 */
export const LOCALE_CATALOGUES = {
  en: localeEn,
} as const;

export type AppLocale = keyof typeof LOCALE_CATALOGUES;

export const DEFAULT_APP_LOCALE: AppLocale = "en";

export function resolveAppLocale(browserLocale?: string | null): AppLocale {
  const language = browserLocale?.split(/[-_]/)[0]?.toLowerCase();
  return language && language in LOCALE_CATALOGUES
    ? (language as AppLocale)
    : DEFAULT_APP_LOCALE;
}

export function appLocaleMessages(locale: AppLocale) {
  return LOCALE_CATALOGUES[locale];
}

/** Use the selected app locale rather than the operating system locale. */
export function formatAppDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString(DEFAULT_APP_LOCALE);
}

/** Use this for date-only values such as a search result's date. */
export function formatAppDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString(DEFAULT_APP_LOCALE);
}

export function compareAppText(left: string, right: string): number {
  return left.localeCompare(right, DEFAULT_APP_LOCALE);
}
