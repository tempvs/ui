/** Browser engines with current Intl data expose the full IANA timezone list.
 * The fallback keeps the selector useful in older browsers. */
const FALLBACK_TIME_ZONES = [
  "UTC", "Africa/Cairo", "Africa/Johannesburg", "America/Anchorage",
  "America/Argentina/Buenos_Aires", "America/Chicago", "America/Denver",
  "America/Edmonton", "America/Halifax", "America/Los_Angeles",
  "America/Mexico_City", "America/New_York", "America/Phoenix",
  "America/Sao_Paulo", "America/Toronto", "Asia/Almaty", "Asia/Bangkok",
  "Asia/Beirut", "Asia/Dubai", "Asia/Hong_Kong", "Asia/Jerusalem",
  "Asia/Kolkata", "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore",
  "Asia/Tokyo", "Australia/Adelaide", "Australia/Brisbane",
  "Australia/Melbourne", "Australia/Perth", "Australia/Sydney", "Europe/Athens",
  "Europe/Berlin", "Europe/Bucharest", "Europe/Brussels", "Europe/Budapest",
  "Europe/Copenhagen", "Europe/Dublin", "Europe/Helsinki", "Europe/Istanbul",
  "Europe/Kyiv", "Europe/Lisbon", "Europe/London", "Europe/Madrid",
  "Europe/Paris", "Europe/Prague", "Europe/Rome", "Europe/Stockholm",
  "Europe/Vienna", "Europe/Warsaw", "Pacific/Auckland", "Pacific/Honolulu",
];

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: "timeZone") => string[];
};

export const EVENT_TIME_ZONES = (() => {
  const supported = (Intl as IntlWithSupportedValues).supportedValuesOf?.("timeZone");
  return Array.from(new Set(["UTC", ...(supported || FALLBACK_TIME_ZONES)])).sort(
    (left, right) => (left === "UTC" ? -1 : right === "UTC" ? 1 : left.localeCompare(right, "en")),
  );
})();

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
