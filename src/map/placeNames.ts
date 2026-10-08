import type { MapPlace } from "./mapApi";

export function matchingPlaceName(place: MapPlace, query: string): string {
  const normalizedQuery = normalizePlaceName(query);
  if (!normalizedQuery) return place.canonicalName;
  const names = place.names?.length
    ? place.names
    : [{ value: place.canonicalName, preferred: true }];
  return (
    names.find((name) =>
      normalizePlaceName(name.value).startsWith(normalizedQuery),
    )?.value ||
    names.find((name) =>
      normalizePlaceName(name.value).includes(normalizedQuery),
    )?.value ||
    place.canonicalName
  );
}

export function normalizePlaceName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Map records use astronomical years internally: zero represents 1 BC. */
export function formatPlaceNameRange(from?: number, to?: number): string {
  if (from === undefined && to === undefined) return "";
  if (from !== undefined && to !== undefined)
    return ` · ${formatPlaceYear(from)}–${formatPlaceYear(to)}`;
  return from !== undefined
    ? ` · from ${formatPlaceYear(from)}`
    : ` · until ${formatPlaceYear(to as number)}`;
}

function formatPlaceYear(year: number): string {
  if (year <= 0) return `${1 - year} BC`;
  return year < 100 ? `${year} AD` : String(year);
}
