import type { MapHistoricalNameRange, MapPlace } from "./mapApi";

/** Pick the historical name that best fits a caller's requested time range.
 * An explicitly searched alias still wins, while an empty search uses a
 * preferred matching-period name before falling back to the canonical label. */
export function matchingPlaceName(
  place: MapPlace,
  query: string,
  range: MapHistoricalNameRange = {},
): string {
  const normalizedQuery = normalizePlaceName(query);
  const names = place.names?.length
    ? place.names
    : [{ value: place.canonicalName, preferred: true }];
  const namesInRange = names.filter((name) => nameOverlapsRange(name, range));
  const candidates = namesInRange.length ? namesInRange : names;
  if (!normalizedQuery)
    return (
      candidates.find((name) => name.preferred)?.value ||
      candidates[0]?.value ||
      place.canonicalName
    );
  return (
    candidates.find((name) =>
      normalizePlaceName(name.value).startsWith(normalizedQuery),
    )?.value ||
    candidates.find((name) =>
      normalizePlaceName(name.value).includes(normalizedQuery),
    )?.value ||
    candidates.find((name) => name.preferred)?.value ||
    place.canonicalName
  );
}

function nameOverlapsRange(
  name: { validFrom?: number; validTo?: number },
  range: MapHistoricalNameRange,
): boolean {
  const nameFrom = name.validFrom ?? Number.NEGATIVE_INFINITY;
  const nameTo = name.validTo ?? Number.POSITIVE_INFINITY;
  const requestedFrom = range.from ?? Number.NEGATIVE_INFINITY;
  const requestedTo = range.to ?? Number.POSITIVE_INFINITY;
  return nameFrom <= requestedTo && nameTo >= requestedFrom;
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
