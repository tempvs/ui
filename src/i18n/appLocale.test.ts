import {
  DEFAULT_APP_LOCALE,
  formatAppDateTime,
  resolveAppLocale,
} from "./appLocale";

test("falls back to English for unsupported browser languages", () => {
  expect(resolveAppLocale("pl-PL")).toBe(DEFAULT_APP_LOCALE);
  expect(resolveAppLocale("en-GB")).toBe("en");
});

test("formats dates with the app locale rather than the browser default", () => {
  expect(formatAppDateTime("2026-10-21T12:30:00.000Z")).toMatch(/2026/);
});
